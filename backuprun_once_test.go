package main

import "testing"

// 界面超时提示按「是不是手动备份」分流：认错成部署就会让人去跑「远端自检」，
// 而那句提示既不能说明远端仍在执行，也不该带出「已取消」（docs/backup-once.md §4.4）。
func TestIsOnceSubcommand(t *testing.T) {
	cases := []struct {
		args []string
		want bool
	}{
		{[]string{"once", "all", "--server", "bk"}, true},
		{[]string{"once", "pg", "--server", "bk", "--dry-run"}, true},
		{[]string{"deploy", "all", "--server", "bk"}, false},
		{[]string{"verify", "all", "--server", "bk"}, false},
		{[]string{"component", "install", "minio"}, false},
		{[]string{}, false},
		{nil, false},
	}
	for _, c := range cases {
		if got := isOnceSubcommand(c.args); got != c.want {
			t.Errorf("isOnceSubcommand(%v) = %v，想要 %v", c.args, got, c.want)
		}
	}
}
