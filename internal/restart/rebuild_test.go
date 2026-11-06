package restart

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type buildCall struct {
	dir  string
	name string
	args []string
}

// fakeBuild 把真实的 npm / go 换成记录器，并在 go build 那条真的造出产物
// （Rebuild 会回读确认「命令没报错 ≠ 真的产出了新二进制」）。
func fakeBuild(t *testing.T, calls *[]buildCall, failOn string) func(ctx context.Context, dir, name string, args ...string) (string, error) {
	t.Helper()
	return func(_ context.Context, dir, name string, args ...string) (string, error) {
		*calls = append(*calls, buildCall{dir, name, append([]string(nil), args...)})
		key := strings.Join(append([]string{name}, args...), " ")
		if failOn != "" && strings.Contains(key, failOn) {
			return "simulated failure output", os.ErrPermission
		}
		for i, a := range args {
			if a == "-o" && i+1 < len(args) {
				if err := os.WriteFile(args[i+1], []byte("new binary"), 0o600); err != nil {
					t.Fatal(err)
				}
			}
		}
		return "ok", nil
	}
}

func withBuildStubs(t *testing.T, fn func(ctx context.Context, dir, name string, args ...string) (string, error)) {
	t.Helper()
	oldRun, oldNpm, oldGo := runBuild, findNpm, findGo
	runBuild = fn
	findNpm = func() (string, error) { return "npm", nil }
	findGo = func() (string, error) { return "go", nil }
	t.Cleanup(func() {
		runBuild, findNpm, findGo = oldRun, oldNpm, oldGo
	})
}

func TestRebuildSkipsNpmWhenFrontendIsFresh(t *testing.T) {
	root, exe := makeRoot(t)
	var calls []buildCall
	withBuildStubs(t, fakeBuild(t, &calls, ""))

	res, err := Rebuild(context.Background(), root, exe, nil)
	if err != nil {
		t.Fatal(err)
	}
	if res.WebBuilt || !res.GoBuilt {
		t.Fatalf("前端新鲜时只该跑 go build：%+v", res)
	}
	if len(calls) != 1 || calls[0].name != "go" {
		t.Fatalf("多跑了不该跑的命令：%+v", calls)
	}
	if _, err := os.Stat(filepath.Join(root, "ops.next.exe")); err != nil {
		t.Fatalf("产物不在预期位置：%v", err)
	}
}

func TestRebuildRunsFullFrontendChainWhenStale(t *testing.T) {
	root, exe := makeRoot(t)
	touch(t, root, "web/src/App.tsx")
	var calls []buildCall
	withBuildStubs(t, fakeBuild(t, &calls, ""))

	res, err := Rebuild(context.Background(), root, exe, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !res.WebBuilt || !res.GoBuilt {
		t.Fatalf("前端过期时两步都要跑：%+v", res)
	}
	if len(calls) != 4 {
		t.Fatalf("应有 test / typecheck / build / go build 四步：%+v", calls)
	}
	for i, want := range []string{"test", "typecheck", "build"} {
		if !strings.Contains(strings.Join(calls[i].args, " "), want) {
			t.Fatalf("第 %d 步不是 %s：%+v", i+1, want, calls[i])
		}
	}
	if calls[3].name != "go" {
		t.Fatalf("最后一步必须是 go build：%+v", calls[3])
	}
}

func TestRebuildStopsAtFirstFailedStep(t *testing.T) {
	root, exe := makeRoot(t)
	touch(t, root, "web/src/App.tsx")
	var calls []buildCall
	withBuildStubs(t, fakeBuild(t, &calls, "typecheck"))

	res, err := Rebuild(context.Background(), root, exe, nil)
	if err == nil || !strings.Contains(err.Error(), "npm run typecheck 失败") {
		t.Fatalf("类型检查失败必须如实报错：%v", err)
	}
	if res.GoBuilt {
		t.Fatal("前面的步骤失败了，绝不能继续 go build")
	}
	if len(calls) != 2 {
		t.Fatalf("失败后应立刻停：%+v", calls)
	}
	if !strings.Contains(res.Output, "simulated failure output") {
		t.Fatalf("构建输出要回给界面看：%q", res.Output)
	}
}

func TestRebuildRefusesToBuildOutsideSourceRoot(t *testing.T) {
	root, exe := makeRoot(t)
	if err := os.Remove(filepath.Join(root, "go.mod")); err != nil {
		t.Fatal(err)
	}
	var calls []buildCall
	withBuildStubs(t, fakeBuild(t, &calls, ""))

	_, err := Rebuild(context.Background(), root, exe, nil)
	if err == nil || !strings.Contains(err.Error(), "源码不在") {
		t.Fatalf("只有 exe、没有源码时必须明确拒绝：%v", err)
	}
	if len(calls) != 0 {
		t.Fatalf("不该在错误的目录里跑任何构建命令：%+v", calls)
	}
}
