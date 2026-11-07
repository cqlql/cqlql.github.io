package shared

import (
	"errors"
	"fmt"
	"strings"
)

// ops.env 的键只在这里定义一次。
//
// 以前同一个键抄了三遍：`configTemplate` 里的 KEY=默认值、注释；`defaultConfig()`
// 里的运行时默认值；`LoadConfig()` 的 switch 分支。`ops init` 生成的模板、
// 解析时的赋值语义、文档键表因此各说各话，新增键要记得改三处。
// 现在 `opsEnvKeys` 是唯一事实源：`RenderOpsEnvTemplate()` 生成模板，
// `LoadConfig()` 查表派发，`go test` 断言模板与文档键名都没漂移。
//
// 🔴 与 backup.env 的分工见 docs/config.md §4：那边的键在 env-schema.json，
// 这边是**本机** ops.env（含路径覆盖），两者互不重叠。
const OpsEnvPrefix = "PASS_UP_OPS_"

// DefaultBackupDeployDir 是模板字面量与运行时默认值共用的远端部署目录。
const DefaultBackupDeployDir = "/opt/passup-backup"

// OpsEnvKeyDef 是 ops.env 一个键的完整定义。
// TemplateValue 是 `ops init` 模板里 = 后面的字面量（空 = 留空用运行时默认）；
// Apply 把解析后的值写进 Config，空值语义由各键自己决定。
type OpsEnvKeyDef struct {
	Key           string
	Label         string
	TemplateValue string
	Notes         []string
	GapBefore     bool // 模板里该键前空一行，用于分段
	Apply         func(*Config, string)
}

var opsEnvKeys = []OpsEnvKeyDef{
	{
		Key:   "PASS_UP_OPS_SERVERS_FILE",
		Label: "服务器清单路径",
		Notes: []string{
			"服务器清单（主机 / 用户 / 私钥 / sudo 凭据只写在这里指向的 JSON）",
			`留空使用默认路径：Windows %AppData%\pass-up\servers.json，其它 ~/.config/pass-up/servers.json`,
		},
		Apply: func(c *Config, v string) {
			if v != "" {
				c.ServersFile = resolveLocalPath(v)
			}
		},
	},
	{
		Key:   "PASS_UP_OPS_DEFAULT_SERVER",
		Label: "默认服务器名",
		Notes: []string{
			"省略 --server 时的默认服务器名；留空则取清单里的 default，再退化为唯一的 backup",
		},
		Apply: func(c *Config, v string) { c.DefaultServer = v },
	},
	{
		Key:           "PASS_UP_OPS_BACKUP_DEPLOY_DIR",
		Label:         "远端备份脚本目录",
		TemplateValue: DefaultBackupDeployDir,
		GapBefore:     true,
		Notes: []string{
			"备份能力安装（P1；目标机由 --server 选择）",
		},
		Apply: func(c *Config, v string) { c.DeployDir = v },
	},
	{
		Key:   "PASS_UP_OPS_BACKUP_SRC_DIR",
		Label: "本机脚本目录（调试用）",
		Notes: []string{
			"备份脚本默认用编进二进制的那份（deploy/backup 已嵌入）；",
			"只有调试时才填本机目录覆盖，留空即可。",
		},
		Apply: func(c *Config, v string) {
			if v != "" {
				c.SrcDir = resolveLocalPath(v)
			}
		},
	},
	{
		Key:       "PASS_UP_OPS_BACKUP_PG_ENV_FILE",
		Label:     "本机 PG 备份配置（含凭证）",
		GapBefore: true,
		Notes: []string{
			"已填好的备份配置（含凭证，不入 Git；留空用配置目录 backup/{postgres,minio}.env）",
			"模板用 ops backup env 生成",
		},
		Apply: func(c *Config, v string) {
			if v != "" {
				c.PGEnvFile = resolveLocalPath(v)
			}
		},
	},
	{
		Key:   "PASS_UP_OPS_BACKUP_MINIO_ENV_FILE",
		Label: "本机 MinIO 备份配置（含凭证）",
		Apply: func(c *Config, v string) {
			if v != "" {
				c.MinioEnvFile = resolveLocalPath(v)
			}
		},
	},
	{
		Key:           "PASS_UP_OPS_PG_ROOT",
		Label:         "PG 备份根目录",
		TemplateValue: DefaultMonitorPGRoot,
		GapBefore:     true,
		Notes: []string{
			"备份监控（P2a；只读采集，路径都是备份机上的远端绝对路径）",
			"含 daily/weekly/monthly；留空用默认值",
		},
		Apply: func(c *Config, v string) { c.setMonitorPath(&c.Monitor.PGRoot, v) },
	},
	{
		Key:           "PASS_UP_OPS_PG_LOG",
		Label:         "PG 心跳 / 日志目录",
		TemplateValue: DefaultMonitorPGLog,
		Apply:         func(c *Config, v string) { c.setMonitorPath(&c.Monitor.PGLog, v) },
	},
	{
		Key:           "PASS_UP_OPS_MINIO_LOG",
		Label:         "MinIO 心跳 / 日志目录",
		TemplateValue: DefaultMonitorMinioLog,
		Apply:         func(c *Config, v string) { c.setMonitorPath(&c.Monitor.MinioLog, v) },
	},
	{
		Key:   "PASS_UP_OPS_MINIO_DATA",
		Label: "MinIO 数据目录（可选）",
		Notes: []string{
			"留空 = 不采数据目录占用（对象多时全量 du 很慢）；填了必须是远端绝对路径",
		},
		Apply: func(c *Config, v string) { c.Monitor.MinioData = v },
	},
	{
		Key:           "PASS_UP_OPS_DISK",
		Label:         "df 的挂载点",
		TemplateValue: DefaultMonitorDisk,
		Apply:         func(c *Config, v string) { c.setMonitorPath(&c.Monitor.Disk, v) },
	},
	{
		Key:           "PASS_UP_OPS_PG_STALE_HOURS",
		Label:         "PG 心跳超时阈值（小时）",
		TemplateValue: fmt.Sprint(DefaultMonitorPGStaleHours),
		GapBefore:     true,
		Notes:         []string{"每天一次，留 2h 余量；超过即判异常"},
		Apply: func(c *Config, v string) {
			c.setMonitorNumber("PASS_UP_OPS_PG_STALE_HOURS", v, &c.Monitor.PGStaleHours, 0)
		},
	},
	{
		Key:           "PASS_UP_OPS_MINIO_STALE_HOURS",
		Label:         "MinIO 心跳超时阈值（小时）",
		TemplateValue: fmt.Sprint(DefaultMonitorMinioStaleHours),
		Apply: func(c *Config, v string) {
			c.setMonitorNumber("PASS_UP_OPS_MINIO_STALE_HOURS", v, &c.Monitor.MinioStaleHours, 0)
		},
	},
	{
		Key:           "PASS_UP_OPS_DISK_WARN_PCT",
		Label:         "磁盘已用率告警阈值（%）",
		TemplateValue: fmt.Sprint(DefaultMonitorDiskWarnPct),
		Notes:         []string{"达到即判异常；取值 1–100"},
		Apply: func(c *Config, v string) {
			c.setMonitorNumber("PASS_UP_OPS_DISK_WARN_PCT", v, &c.Monitor.DiskWarnPct, 100)
		},
	},
}

// OpsEnvKeys 返回键定义副本（Notes 也复制，别让调用方改到事实源）。
func OpsEnvKeys() []OpsEnvKeyDef {
	out := make([]OpsEnvKeyDef, len(opsEnvKeys))
	copy(out, opsEnvKeys)
	for i := range out {
		out[i].Notes = append([]string(nil), out[i].Notes...)
	}
	return out
}

func opsEnvKeyIndex() map[string]OpsEnvKeyDef {
	m := make(map[string]OpsEnvKeyDef, len(opsEnvKeys))
	for _, d := range opsEnvKeys {
		m[d.Key] = d
	}
	return m
}

// RenderOpsEnvTemplate 生成 `ops init` 写出的 ops.env 模板。
// 注释与分段都来自键定义，不再手抄第二份。
func RenderOpsEnvTemplate() string {
	var b strings.Builder
	b.WriteString("# PassUp 本地运维工具配置\n")
	for _, d := range opsEnvKeys {
		if d.GapBefore {
			b.WriteString("\n")
		}
		for _, n := range d.Notes {
			fmt.Fprintf(&b, "# %s\n", n)
		}
		fmt.Fprintf(&b, "%s=%s\n", d.Key, d.TemplateValue)
	}
	return b.String()
}

// retiredOpsEnvKeys：文档里出现过、但当前版本不读的键。
//
// 2026-11-07 诊断抓到 20 个 P2/P3「幽灵键」在 Go 里 0 命中（原在 config.md §3/§5）；
// P2a 落地后 8 个 P2 键已登记进 opsEnvKeys，剩下 12 个 P3 方案键留在 deploy.md §8。
// 另有已删除的旧主机键，以及三个其实是进程环境变量、不是文件键的覆盖键。
// 人照着方案文档把它们填进 ops.env 时，笼统回一句「未知键」会让人以为自己拼错了；
// 这里给出「为什么它不生效、去哪看」的一句人话。方案落地时这张表要同步瘦身。
func retiredOpsEnvKeys() map[string]string {
	m := map[string]string{}
	put := func(reason string, keys ...string) {
		for _, k := range keys {
			m[k] = reason
		}
	}
	put("这是进程环境变量，不写进 ops.env；请在启动环境里设置（见 docs/config.md §1）",
		"PASS_UP_OPS_ENV", "PASS_UP_OPS_CONFIG_DIR", "PASS_UP_OPS_DESKTOP_DIR")
	put("已迁移到服务器清单 servers.json，旧键删除且不保留兼容（见 docs/config.md §2）",
		"PASS_UP_OPS_BACKUP_HOST", "PASS_UP_OPS_BACKUP_PORT", "PASS_UP_OPS_BACKUP_USER", "PASS_UP_OPS_BACKUP_KEY",
		"PASS_UP_OPS_BACKUP_ADMIN_USER", "PASS_UP_OPS_BACKUP_ADMIN_KEY", "PASS_UP_OPS_BACKUP_ADMIN_PASSWORD",
		"PASS_UP_OPS_DEPLOY_HOST", "PASS_UP_OPS_DEPLOY_PORT", "PASS_UP_OPS_DEPLOY_USER", "PASS_UP_OPS_DEPLOY_KEY")
	put("应用部署（P3–P4）方案尚未实现，当前版本不读取该键（见 docs/deploy.md §8）",
		"PASS_UP_OPS_DEPLOY_DIR", "PASS_UP_OPS_DEPLOY_IMAGE_PREFIX", "PASS_UP_OPS_DEPLOY_REGISTRY",
		"PASS_UP_OPS_BACKEND_DIR", "PASS_UP_OPS_AI_DIR", "PASS_UP_OPS_WEB_DIR", "PASS_UP_OPS_IMAGE_TAG",
		"PASS_UP_OPS_BACKEND_HEALTH", "PASS_UP_OPS_AI_HEALTH", "PASS_UP_OPS_WEB_HEALTH",
		"PASS_UP_OPS_DEPLOY_HEALTH_TIMEOUT", "PASS_UP_OPS_DEPLOY_KEEP_PREVIOUS")
	return m
}

// RetiredOpsEnvKeyReason 给测试与错误信息用：返回「已知但不可用」的原因。
func RetiredOpsEnvKeyReason(key string) (string, bool) {
	r, ok := retiredOpsEnvKeys()[key]
	return r, ok
}

// unknownOpsEnvKeyError 把「键不被支持」讲清楚：是幽灵键、环境变量、旧键，还是拼错了。
func unknownOpsEnvKeyError(path string, lineNo int, key string) error {
	var b strings.Builder
	fmt.Fprintf(&b, "%s 第 %d 行：不支持的配置键 %s。\n", path, lineNo, key)
	if reason, ok := RetiredOpsEnvKeyReason(key); ok {
		fmt.Fprintf(&b, "原因：%s\n", reason)
	} else {
		fmt.Fprintf(&b, "本版本没有这个键（可能是拼写错误）；自定义变量请改用不带 %s 前缀的名字。\n", OpsEnvPrefix)
	}
	b.WriteString("本版本支持的 ops.env 键（见 docs/config.md §1 / §2 / §4）：\n")
	for _, d := range opsEnvKeys {
		fmt.Fprintf(&b, "  %s\n", d.Key)
	}
	return errors.New(strings.TrimRight(b.String(), "\n"))
}
