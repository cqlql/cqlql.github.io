package main

import (
	"io/fs"
	"os"
	"strings"
	"testing"
)

// 嵌入产物必须够 `ops backup deploy` 跑完整流程：
// 上传 → install.sh → logrotate → preflight → 首跑。
// 少一个文件的后果不是编译失败，而是远端跑到一半才 command not found。
func TestEmbeddedBackupScriptsComplete(t *testing.T) {
	need := []string{
		"deploy/backup/preflight_check.sh",
		"deploy/backup/preflight_pg.sh",
		"deploy/backup/preflight_minio.sh",
		"deploy/backup/lib/common.sh",
		"deploy/backup/postgres/install.sh",
		"deploy/backup/postgres/pg_backup.sh",
		"deploy/backup/postgres/pg_backup.logrotate",
		"deploy/backup/postgres/backup.env.example",
		"deploy/backup/minio/install.sh",
		"deploy/backup/minio/minio_backup.sh",
		"deploy/backup/minio/minio_backup.logrotate",
		"deploy/backup/minio/backup.env.example",
	}
	for _, n := range need {
		if _, err := fs.Stat(backupScripts, n); err != nil {
			t.Errorf("嵌入产物缺少 %s：%v", n, err)
		}
	}
}

// 二进制会被拷来拷去，绝不能带着真实凭证。
// 真实配置在配置目录 backup/{postgres,minio}.env（见 docs/config.md），
// 由 backup deploy 打包时以 0600 单独注入。
func TestEmbeddedBackupScriptsHaveNoCredentials(t *testing.T) {
	err := fs.WalkDir(backupScripts, "deploy/backup", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		base := d.Name()
		switch {
		case base == "backup.env", base == "sync.env", base == "last_success.txt",
			strings.HasSuffix(base, ".log"):
			t.Errorf("嵌入产物里出现了凭证/运行时文件：%s", p)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

// 脚本被截断或写空时，远端会以「莫名奇妙的语法错误」失败。
// 这里只做最便宜的三条：非空 + 以 shebang 开头（.sh 才要求）+ 不含 CR。
//
// 🔴 CR 那条不是洁癖：这些文件跑在 Linux 上，CRLF 会让 bash 报
// `$'\r': command not found`，而本机（Windows）跑得好好的，极难定位。
// `.env.example` 也要查：它被 `source` 时 CRLF 会让变量值末尾带 \r，
// 例如 PG_SSH_OPTS 多出一个坏参数。.gitattributes 管的是 checkout，
// 管不住「有人用会存 CRLF 的编辑器改文件」或属性生效前就 checkout 的旧工作区。
func TestEmbeddedShellScriptsLookSane(t *testing.T) {
	err := fs.WalkDir(backupScripts, "deploy/backup", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		if !strings.HasSuffix(p, ".sh") && !strings.HasSuffix(p, ".logrotate") &&
			!strings.HasSuffix(p, ".env.example") {
			return nil
		}
		data, err := fs.ReadFile(backupScripts, p)
		if err != nil {
			return err
		}
		if len(data) == 0 {
			t.Errorf("%s 是空文件", p)
		}
		if strings.ContainsRune(string(data), '\r') {
			t.Errorf("%s 含 CR：CRLF 脚本在 Linux 上会报 $'\\r': command not found", p)
		}
		if strings.HasSuffix(p, ".sh") && !strings.HasPrefix(string(data), "#!") {
			t.Errorf("%s 缺少 shebang", p)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

// 脚本同步已被 ops backup deploy 取代：rsync 那套在 Windows 上跑不了，
// 也不注入本机 backup.env、不装 logrotate、不跑 preflight。
func TestEmbeddedBackupScriptsDroppedRsyncSync(t *testing.T) {
	for _, n := range []string{"deploy/backup/backup_sync.sh", "deploy/backup/sync.env.example"} {
		if _, err := fs.Stat(backupScripts, n); err == nil {
			t.Errorf("%s 应已删除（同步由 ops backup deploy 负责）", n)
		}
	}
}

// PG_SSH_OPTS 的兜底默认值散在四个文件里，任一处漏掉 accept-new，
// 首次连一台没进「当前执行身份」known_hosts 的主机就会在 BatchMode=yes 下直接失败。
// preflight_pg.sh 最容易漏：它曾硬编码 BatchMode=yes 却不带 accept-new，
// 漏一次就出现「真机手工能连、远端自检说连不上」的假阴性（2026-11-06 踩过）。
// 从**嵌入产物**读，顺带挡住「改了脚本没重新 build」的口径漂移；
// 界面 placeholder 用的是同一串，也一起锁住（web 源码不在时跳过）。
func TestEmbeddedBackupSSHDefaultsAligned(t *testing.T) {
	const want = "-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"
	files := []string{
		"deploy/backup/postgres/pg_backup.sh",
		"deploy/backup/postgres/pg_restore.sh",
		"deploy/backup/postgres/backup.env.example",
		"deploy/backup/preflight_pg.sh",
	}
	for _, n := range files {
		data, err := fs.ReadFile(backupScripts, n)
		if err != nil {
			t.Fatalf("读取嵌入产物 %s 失败：%v", n, err)
		}
		if !strings.Contains(string(data), want) {
			t.Errorf("%s 缺少统一的 SSH 默认值 %q", n, want)
		}
	}
	ui, err := os.ReadFile("web/src/features/config/utils/draft.ts")
	if err == nil && !strings.Contains(string(ui), want) {
		t.Errorf("web/src/features/config/utils/draft.ts 的 PG_SSH_OPTS_DEFAULT 与脚本默认值不一致")
	}
}

// 自检的 SSH 探测必须复用 PG_SSH_OPTS，且不能把 ssh 的 stderr 整个丢掉：
// 否则失败只剩一句「SSH 无法连通」，无法区分 host key / 认证 / 网络 / 超时。
func TestEmbeddedPreflightSSHProbeKeepsDiagnosis(t *testing.T) {
	data, err := fs.ReadFile(backupScripts, "deploy/backup/preflight_pg.sh")
	if err != nil {
		t.Fatalf("读取嵌入产物 preflight_pg.sh 失败：%v", err)
	}
	s := string(data)
	if !strings.Contains(s, "PG_SSH_OPTS:-") {
		t.Error("preflight_pg.sh 没有读 PG_SSH_OPTS（会与 pg_backup.sh 口径漂移）")
	}
	if strings.Contains(s, ">/dev/null 2>&1") {
		t.Error("preflight_pg.sh 把 ssh 的 stderr 丢进了 /dev/null，失败原因无从排查")
	}
	if !strings.Contains(s, "why=") || !strings.Contains(s, "主机密钥未收录或已变更") {
		t.Error("preflight_pg.sh 缺少归类后的失败原因输出")
	}
}

// 运行身份迁移：root 只剩安装期的系统级写操作，装出来的 crontab / 目录属主 /
// 自检身份都得落到清单 user。任一处漏掉都会让「自检 / 备份 / 手工 ssh」又读到
// 三份不同的 known_hosts 与 ~/.mc。从嵌入产物读，顺带挡住「改了脚本没 build」。
func TestEmbeddedInstallRunsAsNonRoot(t *testing.T) {
	wantInstall := []string{
		"BACKUP_RUN_USER",
		`crontab -u "$RUN_USER" -`,
		`sudo -n -u "$RUN_USER" -H bash "$PREFLIGHT"`,
		`chown -R "${RUN_USER}:${RUN_GROUP}"`,
		`crontab -u root -l`,
		`CRON_HOME="${CRON_HOME:-$RUN_HOME}"`,
	}
	for _, n := range []string{
		"deploy/backup/postgres/install.sh",
		"deploy/backup/minio/install.sh",
	} {
		data, err := fs.ReadFile(backupScripts, n)
		if err != nil {
			t.Fatalf("读取嵌入产物 %s 失败：%v", n, err)
		}
		s := string(data)
		for _, w := range wantInstall {
			if !strings.Contains(s, w) {
				t.Errorf("%s 缺少运行身份迁移的关键片段 %q", n, w)
			}
		}
		if strings.Contains(s, `CRON_HOME="${CRON_HOME:-/root}"`) {
			t.Errorf("%s 仍把 CRON_HOME 写死 /root", n)
		}
		if strings.Contains(s, "| crontab - ") {
			t.Errorf("%s 仍把定时任务装进当前（root）crontab", n)
		}
		// cron 默认 SHELL=/bin/sh：>(...) 是 bash 语法、% 是 crontab 特殊字符、
		// 双引号里的 $(date) 会在安装期展开成固定时间戳。三者都不许回来。
		if strings.Contains(s, "2> >(") || strings.Contains(s, "$(date +%Y") {
			t.Errorf("%s 的 cron 行仍带 bash process substitution / 安装期展开的 date", n)
		}
		if !strings.Contains(s, "2>>") {
			t.Errorf("%s 缺少 /bin/sh 可用的 stderr 兜底重定向", n)
		}
	}
	for _, n := range []string{
		"deploy/backup/postgres/pg_backup.logrotate",
		"deploy/backup/minio/minio_backup.logrotate",
	} {
		data, err := fs.ReadFile(backupScripts, n)
		if err != nil {
			t.Fatalf("读取嵌入产物 %s 失败：%v", n, err)
		}
		if !strings.Contains(string(data), "su __BACKUP_USER__ __BACKUP_GROUP__") {
			t.Errorf("%s 缺少 su 占位符（目录属主非 root 时 logrotate 会跳过轮转）", n)
		}
	}
	for _, n := range []string{
		"deploy/backup/postgres/Makefile",
		"deploy/backup/minio/Makefile",
	} {
		data, err := fs.ReadFile(backupScripts, n)
		if err != nil {
			t.Fatalf("读取嵌入产物 %s 失败：%v", n, err)
		}
		if strings.Contains(string(data), "CRON_HOME := /root") {
			t.Errorf("%s 仍把 CRON_HOME 写死 /root", n)
		}
		if strings.Contains(string(data), "2> >(") || strings.Contains(string(data), "$(date +%Y") {
			t.Errorf("%s 的 cron 行仍带 bash process substitution / make 变量形式的 date", n)
		}
	}
}

// 手动备份与 cron 可能撞车：两个备份脚本必须各自带 flock -n，且锁在任何
// 实际动作之前拿到。minio_backup.sh 以前没有锁，两条 mc mirror --overwrite
// 会并发写同一批对象（docs/backup-once.md §4.1）。锁放在脚本内部，
// 定时任务与 ops backup once 天然共用，工具不解析 crontab、也不改 crontab 行。
func TestEmbeddedBackupScriptsHaveLocks(t *testing.T) {
	for _, n := range []string{
		"deploy/backup/postgres/pg_backup.sh",
		"deploy/backup/minio/minio_backup.sh",
	} {
		data, err := fs.ReadFile(backupScripts, n)
		if err != nil {
			t.Fatalf("读取嵌入产物 %s 失败：%v", n, err)
		}
		s := string(data)
		if !strings.Contains(s, "flock -n 9") || !strings.Contains(s, "exec 9>") {
			t.Errorf("%s 缺少 flock -n 防并发锁", n)
		}
		if !strings.Contains(s, "LOCK_FILE=\"${LOG_DIR}/") {
			t.Errorf("%s 的锁文件没有放在日志目录", n)
		}
		lock := strings.Index(s, "flock -n 9")
		// 两个脚本都在拿到锁之后才打「开始执行」；拿注释里的 pg_dump 当动作
		// 起点会误判，所以统一用这行日志当界标。
		start := strings.Index(s, `log info "开始执行`)
		if start < 0 {
			t.Errorf("%s 找不到「开始执行」日志，锁的位置无法核对", n)
		} else if lock > start {
			t.Errorf("%s 的锁加在实际备份动作之后，等于没锁", n)
		}
	}
}

// pg_restore.sh 的二次确认必须能读到脚本 stdin（2026-11-08 真机写演练抓到）：
// 2a 连通性检查 / 2b 容器健康的内部 ssh 默认转发脚本 stdin，会把工具经
// StreamWith 喂进来的确认串读光，第 3 步 read 拿到 EOF →「数据库名称不匹配，
// 恢复操作已取消」。人在备份机本地终端交互执行不容易踩到，工具一定会踩到。
// 🔴 修法只给 remote_exec 加 -n；remote_docker_stdin 必须保留 stdin 转发，
// 否则 globals_*.sql / .sql 的内容送不进容器内的 psql（docs/backup-restore.md §4 第 10 条）。
// 从**嵌入产物**读，顺带挡住「改了脚本没重新 build」的口径漂移。
func TestEmbeddedPGRestoreKeepsConfirmationStdin(t *testing.T) {
	const name = "deploy/backup/postgres/pg_restore.sh"
	data, err := fs.ReadFile(backupScripts, name)
	if err != nil {
		t.Fatalf("读取嵌入产物 %s 失败：%v", name, err)
	}
	s := string(data)
	fnBody := func(fn string) string {
		i := strings.Index(s, fn+"() {")
		if i < 0 {
			t.Fatalf("%s 找不到函数 %s", name, fn)
		}
		rest := s[i:]
		j := strings.Index(rest, "\n}")
		if j < 0 {
			t.Fatalf("%s 的 %s 函数体没有结束", name, fn)
		}
		return rest[:j]
	}
	exec := fnBody("remote_exec")
	withStdin := fnBody("remote_docker_stdin")
	if !strings.Contains(exec, `"${SSH_BASE[@]}" -n "$SSH_TARGET"`) {
		t.Errorf("%s 的 remote_exec 没带 -n，内部 ssh 会吞掉二次确认的 stdin", name)
	}
	if strings.Contains(withStdin, ` -n `) ||
		!strings.Contains(withStdin, `"${SSH_BASE[@]}" "$SSH_TARGET"`) {
		t.Errorf("%s 的 remote_docker_stdin 必须保留 stdin 转发（globals_*.sql 靠它喂 psql）", name)
	}
	if strings.Contains(s, "SSH_BASE=(ssh -n") {
		t.Errorf("%s 把 -n 加进了基础数组：两条链路会一起失去 stdin 转发", name)
	}
	if !strings.Contains(s, `read -r -p "确认继续？`) {
		t.Errorf("%s 的二次确认 read 不见了：不许用绕过确认的方式修 stdin 坑", name)
	}
}

// psql 默认遇 SQL 错误仍返回 0：只打 ERROR 就继续跑完，光看退出码会把失败当成功。
// 2026-11-10 真机抓到 globals_*.sql 里 CREATE ROLE postgres 报 already exists 被吞、
// 脚本照打「✅ 全局对象恢复完成」（docs/backup-restore.md §7.6 / §7.7）。
// 🔴 globals 分支【不能】靠开 ON_ERROR_STOP 来修：pg_dumpall --globals-only 里的
//
//	CREATE ROLE postgres 在目标端必然已存在，开了会在第一条错误处截断，后面的
//	ALTER ROLE / 其它角色反而不执行 —— 比吞错误更危险，还会打断刚跑通的恢复链路。
//	正解是让 psql 跑完所有语句、捕获输出逐行判错：「对象已存在」白名单放行并
//	醒目告警要求值守核对，其余 ERROR 与链路失败一律中止。
//	业务库 .sql 分支没有这个幂等问题，必须开 ON_ERROR_STOP 让失败真中止。
//
// 从**嵌入产物**读，顺带挡住「改了脚本没重新 build」的口径漂移。
func TestEmbeddedPGRestoreChecksPSQLErrors(t *testing.T) {
	const name = "deploy/backup/postgres/pg_restore.sh"
	data, err := fs.ReadFile(backupScripts, name)
	if err != nil {
		t.Fatalf("读取嵌入产物 %s 失败：%v", name, err)
	}
	s := string(data)

	gi := strings.Index(s, "正在恢复全局对象（角色/权限）")
	gj := strings.Index(s, "未找到 globals_*.sql")
	if gi < 0 || gj < 0 || gj <= gi {
		t.Fatalf("%s 找不到 globals 分支的起止标记", name)
	}
	globals := s[gi:gj]

	// 必须用「行首 + 恰好 4 空格」锚定：参数解析里的 case 分支是 8 空格 `*)`，
	// 直接找 "    *)" 会先命中它的后半段，把 .sql 分支切成空串。
	si := strings.Index(s, "\n    *.sql)")
	se := strings.Index(s, "\n    *)\n")
	if si < 0 || se < 0 || se <= si {
		t.Fatalf("%s 找不到 .sql 分支的起止标记（si=%d se=%d）", name, si, se)
	}
	sqlBranch := s[si:se]

	for _, w := range []string{
		"GLOBALS_OUT=", // 必须捕获输出，不能只看退出码
		"GLOBALS_RC=$?",
		"grep 'ERROR:'",                 // 逐行判错
		"GLOBALS_FATAL",                 // 非白名单错误单独挑出来
		"'already exists'",              // 幂等白名单
		"exit 1",                        // 真失败必须中止
		"remote_docker_stdin",           // 仍走 stdin 转发链路，不许改成 remote_exec
		"if [ -n \"$GLOBALS_ERRORS\" ]", // ✅ 只能在无错误时打
	} {
		if !strings.Contains(globals, w) {
			t.Errorf("%s 的 globals 分支缺少关键片段 %q", name, w)
		}
	}
	if !strings.Contains(globals, "全局对象恢复完成，但以下") ||
		!strings.Contains(globals, "请逐行核对") {
		t.Errorf("%s 的 globals 分支必须把「已存在」错误显式告警，不许无条件打 ✅ 完成", name)
	}
	if strings.Contains(globals, "psql -v ON_ERROR_STOP") {
		t.Errorf("%s 的 globals 分支不许开 ON_ERROR_STOP：会在第一条 already exists 处截断后续 ALTER ROLE（§7.7）", name)
	}
	if !strings.Contains(sqlBranch, "psql -v ON_ERROR_STOP=1") {
		t.Errorf("%s 的 .sql 分支必须开 ON_ERROR_STOP=1，否则 SQL 报错仍返回 0、会被当成成功", name)
	}
}
