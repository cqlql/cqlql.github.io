package restore

// 只读采集：候选恢复点 + 恢复目标回显。CLI 与网页共用这一条链路。
//
// 🔴 远端脚本只 source 两份 backup.env 取**白名单非凭证字段**、find / sha256sum -c /
//    pg_restore -l / df / date / test -f：不写文件、不提权、不读 crontab、
//    不连生产端 MinIO、不 `mc alias set`（不碰 ~/.mc）、不回显凭证。
//    MinIO 桶对来自 backup.env 的 SRC_BUCKETS + DEST_BUCKET_PREFIX；对象数 /
//    最近同步工具不采集，显示 —（分册 §5.2「采不到标 collected=false」，硬约束 3）。
// 🔴 候选路径由远端脚本给出相对路径、Go 侧再验一次白名单；执行时按 Snapshot.PGRoot
//    拼绝对路径，接口永远不接收任意路径。
// 🔴 连不上 / 没配好都回完整空快照（Collected=false + — + blockers），不白屏、
//    不缓存失败结果。错误统一过 safeError，私钥路径不进 JSON / 日志。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"fmt"
	"path"
	"strconv"
	"strings"
	"time"
)

// CollectTimeout 是整段 ssh 采集的上限（含 pg_restore -l 的只读归档检查）。
const CollectTimeout = 60 * time.Second

// ScriptRunner 让采集 / 判定与真实 ssh 分离：*shared.SSHTarget 隐式实现，
// 单测注入假输出，全项目不写需要真实 SSH 的单测。
type ScriptRunner interface {
	RunScript(ctx context.Context, script string) (string, error)
}

func restoreScriptPath(cfg *shared.Config, comp string) string {
	name := "pg_restore.sh"
	dir := "postgres"
	if comp == CompMinio {
		name = "minio_restore.sh"
		dir = "minio"
	}
	return path.Join(cfg.DeployDir, dir, name)
}

func envScriptPath(cfg *shared.Config, comp string) string {
	dir := "postgres"
	if comp == CompMinio {
		dir = "minio"
	}
	return path.Join(cfg.DeployDir, dir, "backup.env")
}

// collectScript 生成远端只读脚本。测试会锁住「没有 sudo / crontab / 删改动作 /
// mc alias set / cat backup.env」，防止有人顺手把写操作加回只读链路。
func collectScript(cfg *shared.Config, comp string) string {
	pgEnv := shared.ShQuote(envScriptPath(cfg, CompPG))
	minioEnv := shared.ShQuote(envScriptPath(cfg, CompMinio))
	pgScript := shared.ShQuote(restoreScriptPath(cfg, CompPG))
	minioScript := shared.ShQuote(restoreScriptPath(cfg, CompMinio))

	var b strings.Builder
	b.WriteString(`set -u
emit() { printf '@META\t%s\t%s\n' "$1" "$2"; }
clean() { printf '%s' "$1" | tr -d '\t\r\n' | cut -c1-200; }
host_of() { v="${1#*://}"; v="${v#*@}"; printf '%s' "${v%%/*}"; }
[ -f ` + pgEnv + ` ] && . ` + pgEnv + `
[ -f ` + minioEnv + ` ] && . ` + minioEnv + `
emit now_epoch "$(date +%s 2>/dev/null)"
emit pg_root "$(clean "${PG_BACKUP_ROOT:-}")"
emit pg_host "$(clean "${PG_SSH_HOST:-}")"
emit pg_port "$(clean "${PG_SSH_PORT:-}")"
emit pg_user "$(clean "${PG_SSH_USER:-}")"
emit pg_db "$(clean "${PG_DB_NAME:-}")"
emit pg_container "$(clean "${PG_CONTAINER_NAME:-}")"
emit pg_jobs "$(clean "${PG_RESTORE_JOBS:-}")"
emit src_url "$(host_of "${SRC_URL:-}")"
emit src_buckets "$(clean "${SRC_BUCKETS:-}")"
emit dest_url "$(host_of "${DEST_URL:-}")"
emit dest_prefix "$(clean "${DEST_BUCKET_PREFIX:-}")"
log_dir="${PG_BACKUP_LOG_DIR:-/var/log/pg-backup}"
if [ -r "$log_dir/last_success.txt" ]; then emit heartbeat "$(head -n 1 "$log_dir/last_success.txt" | tr -d '\t\r\n' | cut -c1-40)"; fi
root="${PG_BACKUP_ROOT:-}"
if [ -n "$root" ] && [ -d "$root" ]; then
  emit disk_free_kb "$(df -Pk "$root" 2>/dev/null | tail -n 1 | awk '{print $4}')"
else
  emit disk_free_kb ""
fi
scripts_ok=0
if [ -f ` + pgScript + ` ] && [ -f ` + minioScript + ` ]; then scripts_ok=1; fi
emit scripts_ok "$scripts_ok"
pg_restore_bin=0
if command -v pg_restore >/dev/null 2>&1; then pg_restore_bin=1; fi
emit pg_restore_bin "$pg_restore_bin"
`)

	if comp == CompPG {
		b.WriteString(`if [ -n "$root" ] && [ -d "$root" ]; then
  find "$root" -maxdepth 2 -type f \( -name '*.dump' -o -name '*.sql' \) ! -name 'globals_*' -printf '%T@\t%p\t%s\n' 2>/dev/null \
    | sort -rn | head -n 30 | while IFS="$(printf '\t')" read -r epoch full size; do
    [ -n "$full" ] || continue
    base=$(basename "$full")
    rel=${full#"$root"/}
    case "$base" in *[!A-Za-z0-9._-]*) continue ;; esac
    case "$rel" in *[!A-Za-z0-9._/-]*|/*|*..*) continue ;; esac
    dir=$(dirname "$full")
    grade='—'
    case "$full" in */daily/*) grade=daily ;; */weekly/*) grade=weekly ;; */monthly/*) grade=monthly ;; esac
    sha='缺失'
    if [ -f "$full.sha256" ]; then
      if (cd "$dir" && sha256sum -c "$base.sha256" --status >/dev/null 2>&1); then sha='通过'; else sha='失败'; fi
    fi
    arc='不适用'
    case "$base" in
      *.dump)
        if [ "$pg_restore_bin" = 1 ]; then
          if pg_restore -l "$full" >/dev/null 2>&1; then arc='可解析'; else arc='不可解析'; fi
        else
          arc='未采集'
        fi ;;
    esac
    mtime=$(date -r "$full" '+%m-%d %H:%M' 2>/dev/null || printf '—')
    printf '@CAND\tpg\t%s\t%s\t\t%s\t%s\t%s\t%s\t%s\t%s\t—\t—\n' \
      "$rel" "$base" "$size" "$mtime" "$grade" "$sha" "$arc" "$epoch"
  done
fi
`)
	} else {
		b.WriteString(`for bucket in ${SRC_BUCKETS:-}; do
  case "$bucket" in *[!A-Za-z0-9._-]*) continue ;; esac
  printf '@CAND\tminio\t%s\t%s%s\t%s\t—\t—\t—\t不适用\t不适用\t0\t—\t—\n' \
    "$bucket" "${DEST_BUCKET_PREFIX:-}" "$bucket" "$bucket"
done
`)
	}
	b.WriteString("printf '@END\\n'\n")
	return b.String()
}

// parseCollect 把分节纯文本解析成完整快照。未知行忽略：远端脚本升级后
// 本工具仍能读旧字段，不会因为多一行就整页打白。
func parseCollect(server, component, out string) Snapshot {
	s := emptySnapshot(server, component, "")
	s.Error = ""
	s.Collected = true
	s.Blockers = []string{}
	s.Candidates = []Candidate{}
	s.Direction = directionMinio
	if component == CompPG {
		s.Direction = directionPG
	}

	meta := map[string]string{}
	rows := [][]string{}
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimRight(line, "\r")
		switch {
		case strings.HasPrefix(line, "@META\t"):
			f := strings.SplitN(strings.TrimPrefix(line, "@META\t"), "\t", 2)
			if len(f) == 2 {
				meta[f[0]] = f[1]
			}
		case strings.HasPrefix(line, "@CAND\t"):
			f := strings.Split(strings.TrimPrefix(line, "@CAND\t"), "\t")
			if len(f) >= 12 {
				rows = append(rows, f)
			}
		}
	}
	now, _ := strconv.ParseInt(meta["now_epoch"], 10, 64)

	s.PGRoot = orDash(meta["pg_root"])
	s.PGHost = orDash(meta["pg_host"])
	s.PGPort = orDash(meta["pg_port"])
	s.PGDB = orDash(meta["pg_db"])
	s.PGContainer = orDash(meta["pg_container"])
	s.PGJobs = orDash(meta["pg_jobs"])
	s.SrcURL = orDash(meta["src_url"])
	s.SrcBuckets = orDash(meta["src_buckets"])
	s.DestURL = orDash(meta["dest_url"])
	s.DestPrefix = orDash(meta["dest_prefix"])
	s.Heartbeat = orDash(meta["heartbeat"])
	s.ScriptsOK = meta["scripts_ok"] == "1"
	if freeKB, err := strconv.ParseInt(meta["disk_free_kb"], 10, 64); err == nil && freeKB > 0 {
		s.DiskFreeKB = &freeKB
		s.DiskFree = humanBytes(freeKB * 1024)
	}

	for _, f := range rows {
		// f: comp,id,label,target,size,time,grade,sha,archive,epoch,objects,synced
		c := Candidate{
			ID:          f[1],
			Label:       f[2],
			Target:      f[3],
			Time:        orDash(f[5]),
			Grade:       orDash(f[6]),
			Checksum:    f[7],
			Archive:     f[8],
			Objects:     orDash(f[10]),
			Synced:      orDash(f[11]),
			RowBlockers: []string{},
		}
		if !ValidCandidateID(c.ID) {
			continue
		}
		if f[0] == CompPG {
			c.Size = NotCollected
			if n, err := strconv.ParseInt(f[4], 10, 64); err == nil && n > 0 {
				c.SizeBytes = n
				c.Size = humanBytes(n)
			}
			// GNU find 的 %T@ 带小数秒（如 1794133122.3018926360），
			// ParseInt 会直接失败把新鲜度变成 —；先按浮点解析再取整。
			epoch := int64(0)
			if v, err := strconv.ParseFloat(f[9], 64); err == nil && v > 0 {
				epoch = int64(v)
			}
			if epoch > 0 && now > 0 && now >= epoch {
				hours := float64(now-epoch) / 3600
				c.Freshness = fmt.Sprintf("%.1f 小时前", hours)
				if hours >= 24 {
					c.Freshness = fmt.Sprintf("%.1f 天前", hours/24)
				}
			} else {
				c.Freshness = NotCollected
			}
			switch {
			case c.Checksum != "通过":
				c.RowBlockers = append(c.RowBlockers, "缺 .sha256 或校验和不通过：脚本只警告跳过，工具不把它当校验通过（分册 §4 第 6 条）")
			case c.Archive == "不可解析":
				// 🔴 2026-11-08 真机演练：备份机 pg_restore 16.15 读不了归档 1.16，
				//    但正式恢复用的是**主服务器容器内** pg_restore 18.6，能读。
				//    这里必须如实说清「判的是哪一侧」，不能把 dump 说成坏了。
				c.RowBlockers = append(c.RowBlockers,
					"备份机上的 pg_restore 客户端无法解析该归档（版本可能低于生成 dump 的 pg_dump，例如 16 读 1.16）；"+
						"🔴 正式恢复用的是主服务器容器内的 pg_restore，版本可能更高、能读。工具不连生产端校验，"+
						"请按 §3.1 在目标容器内人工跑 pg_restore -l 复核；工具不提供绕过开关，必要时升级备份机客户端或走 §3 人工 SOP")
			case c.Archive == "未采集":
				c.RowBlockers = append(c.RowBlockers, "备份机没有 pg_restore，无法校验归档目录；先在「备份能力部署」页安装缺少依赖")
			}
		} else {
			c.Size = NotCollected
			c.Freshness = NotCollected
			if !bucketRe.MatchString(c.ID) {
				c.RowBlockers = append(c.RowBlockers, "桶名不符合命名白名单（只认字母 / 数字 / . _ -）")
			}
			if c.Label == c.ID {
				c.RowBlockers = append(c.RowBlockers, "DEST_BUCKET_PREFIX 为空：备份端桶与生产端桶同名，方向有误先核对配置")
			}
		}
		c.Selectable = len(c.RowBlockers) == 0
		s.Candidates = append(s.Candidates, c)
	}

	// 全局阻塞：只来自「采集事实 + 人的前置声明」，不来自 crontab（R1）。
	if !s.ScriptsOK {
		s.Blockers = append(s.Blockers, "备份机上找不到 pg_restore.sh / minio_restore.sh：先运行 ops backup deploy 把脚本装到备份机")
	}
	if component == CompPG {
		if !safeRemotePath(s.PGRoot) || s.PGRoot == NotCollected {
			s.Blockers = append(s.Blockers, "PG_BACKUP_ROOT 没配好或不是安全绝对路径：候选路径一律不拼，先去「配置」页核对远端 backup.env")
		}
		if len(s.Candidates) == 0 {
			s.Blockers = append(s.Blockers, "没找到可用的 PG 恢复点（备份根目录下没有符合命名白名单的 .dump / .sql）")
		}
	} else {
		if s.SrcURL == NotCollected || s.DestURL == NotCollected || s.SrcBuckets == NotCollected {
			s.Blockers = append(s.Blockers, "远端 minio/backup.env 的 SRC_URL / DEST_URL / SRC_BUCKETS 没配齐：桶对清单不可信，不执行恢复")
		}
		if len(s.Candidates) == 0 {
			s.Blockers = append(s.Blockers, "SRC_BUCKETS 为空或桶名不合法：没有可恢复的桶对")
		}
	}
	s.Warnings = []string{
		"恢复是「补齐 + 覆盖」，不是精确回滚：PG 的 --clean 只清 dump 里有的对象，MinIO 的 mc mirror 不带 --remove；多余对象一律保留、由人比对。",
		"停定时备份 / 停写 / 留现场是人的前置声明，工具不读 crontab、不探活应用、不自动停或装定时任务。",
		"报告只报脚本结果：应用可用性、Flyway schema 兼容性、关键表与对象核对都是人工步骤（分册 §3.3 / 硬约束 7）。",
	}
	return s
}

func orDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return NotCollected
	}
	return strings.TrimSpace(s)
}

// Collect 跑一次只读采集；连接失败不提前 return，仍回完整快照。
func Collect(ctx context.Context, r ScriptRunner, cfg *shared.Config, server, component, identity string) Snapshot {
	if !ValidComponent(component) {
		return emptySnapshot(server, component, "未知组件（可选 pg / minio）")
	}
	s := emptySnapshot(server, component, "")
	s.Identity = orDash(identity)
	s.Host = orDash(identity)
	s.Direction = directionMinio
	if component == CompPG {
		s.Direction = directionPG
	}
	ctx, cancel := context.WithTimeout(ctx, CollectTimeout)
	defer cancel()
	out, err := r.RunScript(ctx, collectScript(cfg, component))
	if err != nil {
		return emptySnapshot(server, component, safeError(err.Error()))
	}
	s = parseCollect(server, component, out)
	s.Identity = orDash(identity)
	s.Host = orDash(identity)
	return s
}

// CollectForServer 是 CLI 与网页共用的入口：清单选机 → StatusSSHTarget（清单
// user/key、不带 sudo 密码）→ Collect。err 只表示「本机没配好」。
func CollectForServer(ctx context.Context, cfg *shared.Config, list *shared.ServerList, name, component string) (Snapshot, error) {
	if cfg == nil || list == nil {
		return emptySnapshot(name, component, "配置还没准备好"), fmt.Errorf("配置还没准备好")
	}
	srv, err := list.Resolve(name, cfg.DefaultServer)
	if err != nil {
		return emptySnapshot(name, component, safeError("选择目标机失败："+err.Error())), err
	}
	t := srv.StatusSSHTarget()
	t.SudoPassword = ""
	identity := fmt.Sprintf("%s@%s:%d（清单 user，不提权）", t.User, t.Host, t.Port)
	return Collect(ctx, t, cfg, name, component, identity), nil
}

// CandidateByID 从**本次采集**里查表；执行路径永远从这里拼，接口不收绝对路径。
func (s Snapshot) CandidateByID(id string) (Candidate, bool) {
	for _, c := range s.Candidates {
		if c.ID == id {
			return c, true
		}
	}
	return Candidate{}, false
}

// RemoteFile 是 PG 候选的远端绝对路径；目录必须在 backup.env 里配成安全绝对路径。
func (s Snapshot) RemoteFile(c Candidate) (string, error) {
	if s.Component != CompPG || !ValidCandidateID(c.ID) || !safeRemotePath(s.PGRoot) {
		return "", fmt.Errorf("候选路径不合法（只认备份根目录下本次采集到的文件）")
	}
	return path.Join(s.PGRoot, c.ID), nil
}
