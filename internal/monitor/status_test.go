package monitor

// P2a 红线单测：先写、先红，再落实现（docs/backup-monitor.md §11.2）。
// 🔴 不写需要真实 SSH 的单测：采集与判定靠 ScriptRunner 注入假输出分离。
//
// 三条红线：
//  1. 时间新鲜度只在远端算（固定 epoch fixture，换 TZ 结果不变）；
//  2. `-` 不是 0（未采到是 null / collected=false）；
//  3. 连不上仍返回完整快照（四段齐全 + danger）。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

// fullFixture 与 docs/backup-monitor.md §3.1 的示例一致（DISK 带 % 后缀）。
const fullFixture = `==META
backup-01
1762500000
==PG
2026-11-07 03:00:12
1762464000
1762495200|130000000|/data/backups/postgres/daily/passup_20261107.dump
820000
==MINIO
2026-11-07 02:00:11
1762483211
3200
-
==DISK
102400|20480|80%
`

const dashFixture = `==META
backup-01
1762500000
==PG
-
-
-
-
==MINIO
-
-
-
-
==DISK
-
`

type fakeRunner struct {
	out    string
	err    error
	script string
	calls  int
}

func (f *fakeRunner) RunScript(_ context.Context, script string) (string, error) {
	f.calls++
	f.script = script
	return f.out, f.err
}

func testFloat(v float64) *float64 { return &v }

func testConfig() Config {
	return Config{
		PGRoot:          "/data/backups/postgres",
		PGLog:           "/var/log/pg-backup",
		MinioLog:        "/var/log/minio-backup",
		Disk:            "/data",
		PGStaleHours:    26,
		MinioStaleHours: 26,
		DiskWarnPct:     90,
	}
}

func near(t *testing.T, got *float64, want float64, label string) {
	t.Helper()
	if got == nil {
		t.Errorf("%s 未采到（nil），想要 %.1f", label, want)
		return
	}
	d := *got - want
	if d < -0.05 || d > 0.05 {
		t.Errorf("%s = %.3f，想要 %.3f", label, *got, want)
	}
}

// 红线 1：新鲜度 = 远端 now_epoch - 远端 last_epoch，本机时区不参与。
func TestFreshnessUsesRemoteEpochs(t *testing.T) {
	for _, tz := range []string{"UTC", "Asia/Shanghai", "America/Los_Angeles"} {
		t.Run(tz, func(t *testing.T) {
			t.Setenv("TZ", tz)
			s := parseSections(fullFixture)
			if s.RemoteHost != "backup-01" {
				t.Errorf("remote_host = %q", s.RemoteHost)
			}
			if !s.PG.Collected || !s.PG.HasSuccess {
				t.Fatalf("PG 段没采到：%+v", s.PG)
			}
			if s.PG.LastSuccessRaw != "2026-11-07 03:00:12" {
				t.Errorf("心跳原文丢了：%q", s.PG.LastSuccessRaw)
			}
			// 1762500000 - 1762464000 = 36000 秒 = 10 小时。
			near(t, s.PG.LastSuccessAgeHours, 10, "PG 心跳年龄(h)")
			// 1762500000 - 1762495200 = 4800 秒 = 1.3 小时。
			near(t, s.PG.LatestAgeHours, 1.3, "最新 dump 年龄(h)")
			// 130000000 字节 / 1024^2，820000 KB / 1024。
			near(t, s.PG.LatestSizeMB, 124.0, "最新 dump 大小(MB)")
			near(t, s.PG.TotalMB, 800.8, "PG 备份根占用(MB)")
			if s.PG.LatestPath != "/data/backups/postgres/daily/passup_20261107.dump" {
				t.Errorf("latest_path = %q", s.PG.LatestPath)
			}
			if !s.PG.HasLatest {
				t.Error("has_latest 应为 true")
			}
			if !s.MinIO.Collected || !s.MinIO.HasSuccess {
				t.Fatalf("MINIO 段没采到：%+v", s.MinIO)
			}
			// 1762500000 - 1762483211 = 16789 秒 ≈ 4.7 小时。
			near(t, s.MinIO.LastSuccessAgeHours, 4.7, "MinIO 心跳年龄(h)")
			near(t, s.MinIO.LogSizeMB, 3.1, "MinIO 日志占用(MB)")
			if s.MinIO.DataSizeMB != nil {
				t.Errorf("未配置数据目录时 data_size_mb 必须是 null：%v", *s.MinIO.DataSizeMB)
			}
			if !s.Disk.Collected {
				t.Fatal("DISK 段没采到")
			}
			near(t, s.Disk.TotalMB, 102400, "磁盘总量(MB)")
			near(t, s.Disk.FreeMB, 20480, "磁盘剩余(MB)")
			near(t, s.Disk.UsedPct, 80, "磁盘已用率(%)")
		})
	}
}

// 红线 2：`-` 是「没采到」，不是 0；problems 恒为空 slice（不能编成 null）。
func TestDashMeansNotCollected(t *testing.T) {
	s := parseSections(dashFixture)
	if s.PG.Collected || s.MinIO.Collected || s.Disk.Collected {
		t.Errorf("全 `-` 的分节必须 collected=false：PG=%v MINIO=%v DISK=%v",
			s.PG.Collected, s.MinIO.Collected, s.Disk.Collected)
	}
	if s.PG.LastSuccessAgeHours != nil || s.PG.LatestSizeMB != nil ||
		s.PG.LatestAgeHours != nil || s.PG.TotalMB != nil ||
		s.MinIO.LastSuccessAgeHours != nil || s.MinIO.LogSizeMB != nil ||
		s.MinIO.DataSizeMB != nil || s.Disk.TotalMB != nil ||
		s.Disk.FreeMB != nil || s.Disk.UsedPct != nil {
		t.Errorf("`-` 必须解析成 nil，不许用 0 兜底：%+v", s)
	}
	if s.PG.HasSuccess || s.MinIO.HasSuccess || s.PG.HasLatest {
		t.Error("`-` 不许伪装成「有成功记录 / 有最新备份」")
	}
	if s.Problems == nil || len(s.Problems) != 0 {
		t.Errorf("parseSections 的 problems 必须是非空空 slice，得到 %#v", s.Problems)
	}
	b, err := json.Marshal(s)
	if err != nil {
		t.Fatal(err)
	}
	text := string(b)
	for _, want := range []string{
		`"total_mb":null`, `"used_pct":null`, `"last_success_age_hours":null`,
		`"data_size_mb":null`, `"problems":[]`, `"collected":false`,
	} {
		if !strings.Contains(text, want) {
			t.Errorf("JSON 缺少 %s：%s", want, text)
		}
	}
	for _, bad := range []string{`"total_mb":0`, `"used_pct":0`, `"problems":null`} {
		if strings.Contains(text, bad) {
			t.Errorf("JSON 出现 0 / null 兜底：%s", bad)
		}
	}
}

// 红线 3：连不上也要回完整快照，且错误里不出现私钥路径。
func TestConnectionFailureReturnsFullSnapshot(t *testing.T) {
	r := &fakeRunner{err: errors.New(
		"ssh 连接失败（exit 255）：Permission denied for /home/ro/.ssh/id_ed25519_ro")}
	s := Collect(context.Background(), r, testConfig(), "ro-user@backup-01:22")

	if s.Connection.OK {
		t.Error("connection.ok 必须为 false")
	}
	if s.Connection.Error == "" {
		t.Error("connection.error 不能为空")
	}
	if strings.Contains(s.Connection.Error, "id_ed25519_ro") ||
		strings.Contains(s.Connection.Error, ".ssh/") {
		t.Errorf("错误信息泄露私钥路径：%q", s.Connection.Error)
	}
	if s.Host != "ro-user@backup-01:22" || s.CheckedAt == "" {
		t.Errorf("host / checked_at 缺失：%q / %q", s.Host, s.CheckedAt)
	}
	if s.PG.Collected || s.MinIO.Collected || s.Disk.Collected {
		t.Error("连不上时四段都该是 collected=false，不许猜状态")
	}
	if !hasDanger(s) {
		t.Errorf("连不上必须给 danger：%+v", s.Problems)
	}
	if s.Problems == nil {
		t.Error("problems 不能是 nil")
	}
	if r.calls != 1 || !strings.Contains(r.script, "==META") {
		t.Errorf("Collect 仍应发起一次采集：calls=%d script=%q", r.calls, r.script)
	}

	b, err := json.Marshal(s)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]json.RawMessage
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"host", "checked_at", "remote_host", "connection", "pg", "minio", "disk", "problems"} {
		if _, ok := m[key]; !ok {
			t.Errorf("完整快照缺少顶层字段 %s", key)
		}
	}
}

// 解析 fixture 边界：空输出 / 乱序分节 / CRLF / 超大数 / % 后缀 / 缺行 / 坏数值。
func TestParseSectionsBoundaries(t *testing.T) {
	t.Run("空输出", func(t *testing.T) {
		s := parseSections("")
		if s.PG.Collected || s.MinIO.Collected || s.Disk.Collected {
			t.Error("空输出不该有任何一段 collected=true")
		}
		if s.Problems == nil {
			t.Error("problems 必须是空 slice 而不是 nil")
		}
	})

	t.Run("乱序分节", func(t *testing.T) {
		s := parseSections(`==DISK
102400|20480|80
==MINIO
2026-11-07 02:00:11
1762483211
3200
-
==PG
2026-11-07 03:00:12
1762464000
1762495200|130000000|/data/backups/x.dump
820000
==META
backup-01
1762500000
`)
		if s.RemoteHost != "backup-01" || !s.PG.Collected || !s.MinIO.Collected || !s.Disk.Collected {
			t.Fatalf("分节顺序可乱，解析结果不该漂移：%+v", s)
		}
		near(t, s.PG.LastSuccessAgeHours, 10, "乱序后的 PG 心跳年龄(h)")
		near(t, s.Disk.UsedPct, 80, "无 % 后缀的已用率")
	})

	t.Run("CRLF", func(t *testing.T) {
		s := parseSections(strings.ReplaceAll(fullFixture, "\n", "\r\n"))
		if s.RemoteHost != "backup-01" || !s.PG.Collected || !s.Disk.Collected {
			t.Fatalf("CRLF 不该破坏分节解析：%+v", s)
		}
		near(t, s.Disk.UsedPct, 80, "CRLF + % 后缀")
	})

	t.Run("超大数与坏数值", func(t *testing.T) {
		s := parseSections(`==META
h
1762500000
==PG
2026-11-07 03:00:12
1762464000
999999999999999999|nan|/data/backups/big.dump
820000
==MINIO
-
-
-
-
==DISK
bad|20480|80%
`)
		// 超大 epoch 不许 panic / 溢出成 0；坏数值只影响它自己那个字段。
		if s.PG.LatestAgeHours == nil {
			t.Error("超大 mtime 仍应解析（float64 不溢出）")
		}
		if s.PG.LatestSizeMB != nil {
			t.Errorf("坏 size 必须 nil，得到 %v", *s.PG.LatestSizeMB)
		}
		if s.Disk.TotalMB != nil || s.Disk.FreeMB == nil || s.Disk.UsedPct == nil {
			t.Errorf("坏字段只该影响自己：%+v", s.Disk)
		}
	})

	t.Run("缺行", func(t *testing.T) {
		s := parseSections(`==META
backup-01
1762500000
==PG
2026-11-07 03:00:12
1762464000
==MINIO
-
-
-
-
==DISK
-
`)
		if s.PG.Collected {
			t.Error("PG 缺两行必须 collected=false，不许按行错位取值")
		}
		if !s.PG.HasSuccess {
			t.Error("已经采到的心跳仍应保留（缺行不等于全丢）")
		}
	})
}

func healthyStatus() Status {
	s := emptyStatus()
	s.Connection.OK = true
	s.PG.Collected, s.PG.HasSuccess, s.PG.HasLatest = true, true, true
	s.PG.LastSuccessAgeHours = testFloat(26)
	s.PG.LatestAgeHours = testFloat(1)
	s.PG.LatestSizeMB = testFloat(123)
	s.PG.TotalMB = testFloat(800)
	s.MinIO.Collected, s.MinIO.HasSuccess = true, true
	s.MinIO.LastSuccessAgeHours = testFloat(26)
	s.MinIO.LogSizeMB = testFloat(3)
	s.Disk.Collected = true
	s.Disk.TotalMB, s.Disk.FreeMB, s.Disk.UsedPct = testFloat(102400), testFloat(20480), testFloat(80)
	return s
}

func countLevel(s Status, level string) int {
	n := 0
	for _, p := range s.Problems {
		if p.Level == level {
			n++
		}
	}
	return n
}

// 判定阈值只在 assess 里定义一次：stale 边界、0 字节是 warn、df 失败才是 danger。
func TestAssessThresholds(t *testing.T) {
	cfg := testConfig()

	t.Run("恰好等于阈值不告警", func(t *testing.T) {
		s := healthyStatus()
		assess(&s, cfg)
		if hasDanger(s) || s.Problems == nil || len(s.Problems) != 0 {
			t.Errorf("健康快照不该有 danger：%+v", s.Problems)
		}
	})

	t.Run("超过 stale 阈值", func(t *testing.T) {
		s := healthyStatus()
		s.PG.LastSuccessAgeHours = testFloat(26.1)
		s.MinIO.LastSuccessAgeHours = testFloat(27)
		assess(&s, cfg)
		if countLevel(s, "danger") != 2 {
			t.Errorf("PG / MinIO 超时各应一条 danger：%+v", s.Problems)
		}
	})

	t.Run("0 字节 dump 是 warn", func(t *testing.T) {
		s := healthyStatus()
		s.PG.LatestSizeMB = testFloat(0)
		assess(&s, cfg)
		if countLevel(s, "warn") != 1 || hasDanger(s) {
			t.Errorf("0 字节只该是 warn：%+v", s.Problems)
		}
	})

	t.Run("有成功记录但找不到 dump 是 warn", func(t *testing.T) {
		s := healthyStatus()
		s.PG.HasLatest = false
		s.PG.LatestPath = ""
		assess(&s, cfg)
		if countLevel(s, "warn") != 1 || hasDanger(s) {
			t.Errorf("找不到 dump 只该是 warn：%+v", s.Problems)
		}
	})

	t.Run("df 失败是 danger，剩余 0MB 不是", func(t *testing.T) {
		s := healthyStatus()
		s.Disk.Collected = false
		s.Disk.FreeMB = testFloat(0)
		assess(&s, cfg)
		if countLevel(s, "danger") != 1 || !strings.Contains(s.Problems[0].Text, "df") {
			t.Errorf("df 失败必须报成 danger 且写清是 df：%+v", s.Problems)
		}

		s = healthyStatus()
		s.Disk.FreeMB = testFloat(0)
		s.Disk.UsedPct = testFloat(50)
		assess(&s, cfg)
		if hasDanger(s) {
			t.Errorf("剩余 0MB 但 df 成功不该判成 df 失败：%+v", s.Problems)
		}
	})

	t.Run("磁盘达到告警阈值", func(t *testing.T) {
		s := healthyStatus()
		s.Disk.UsedPct = testFloat(90)
		assess(&s, cfg)
		if countLevel(s, "danger") != 1 {
			t.Errorf("达到 90%% 应有一条 danger：%+v", s.Problems)
		}
	})

	t.Run("配了数据目录却读不到是 warn", func(t *testing.T) {
		s := healthyStatus()
		cfg2 := cfg
		cfg2.MinioData = "/data/minio"
		assess(&s, cfg2)
		if countLevel(s, "warn") != 1 || hasDanger(s) {
			t.Errorf("配了数据目录读不到只该 warn：%+v", s.Problems)
		}
	})

	t.Run("读不到心跳是 danger", func(t *testing.T) {
		s := healthyStatus()
		s.PG.HasSuccess = false
		s.PG.LastSuccessAgeHours = nil
		assess(&s, cfg)
		if countLevel(s, "danger") != 1 || !strings.Contains(s.Problems[0].Text, "心跳") {
			t.Errorf("读不到 PG 心跳必须是 danger：%+v", s.Problems)
		}
	})

	t.Run("连不上是 danger", func(t *testing.T) {
		s := healthyStatus()
		s.Connection.OK = false
		s.Connection.Error = "ssh 连接失败"
		assess(&s, cfg)
		if countLevel(s, "danger") != 1 {
			t.Errorf("连不上必须有一条 danger：%+v", s.Problems)
		}
	})

	t.Run("重复调用不叠加问题", func(t *testing.T) {
		s := healthyStatus()
		assess(&s, cfg)
		assess(&s, cfg)
		if len(s.Problems) != 0 {
			t.Errorf("assess 应幂等：%+v", s.Problems)
		}
	})
}

func TestConfigFromSharedConfigAndTimeout(t *testing.T) {
	c := &shared.Config{}
	c.Monitor.PGRoot = "/x/pg"
	c.Monitor.PGLog = "/x/pg-log"
	c.Monitor.MinioLog = "/x/minio-log"
	c.Monitor.MinioData = "/x/minio-data"
	c.Monitor.Disk = "/mnt/data"
	c.Monitor.PGStaleHours = 30
	c.Monitor.MinioStaleHours = 31
	c.Monitor.DiskWarnPct = 95
	got := ConfigFrom(c)
	if got.PGRoot != "/x/pg" || got.MinioData != "/x/minio-data" || got.Disk != "/mnt/data" ||
		got.PGStaleHours != 30 || got.MinioStaleHours != 31 || got.DiskWarnPct != 95 {
		t.Errorf("ConfigFrom 没把 shared.Config.Monitor 完整搬过来：%+v", got)
	}
	if CollectTimeout != 30*time.Second {
		t.Errorf("CollectTimeout = %v，想要 30s", CollectTimeout)
	}
}
