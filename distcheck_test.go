package main

import (
	"embed"
	"testing"
	"testing/fstest"
)

// __dist-check 的判定必须针对「二进制里嵌的那一份」，不能依赖真实构建产物：
// 全新 clone 上 go test 也要能跑，所以这里一律塞 MapFS。
func TestEmbeddedWebOK(t *testing.T) {
	cases := []struct {
		name string
		fsys *fstest.MapFS
		want bool
	}{
		{
			name: "built dist",
			fsys: &fstest.MapFS{
				"web/dist/index.html":       &fstest.MapFile{Data: []byte(`<div id="root"></div>`)},
				"web/dist/assets/app-a1.js": &fstest.MapFile{Data: []byte("console.log(1)")},
			},
			want: true,
		},
		{
			name: "fresh clone: only .gitkeep",
			fsys: &fstest.MapFS{
				"web/dist/.gitkeep": &fstest.MapFile{Data: []byte("placeholder")},
			},
			want: false,
		},
		{
			name: "index without assets (would render a blank page)",
			fsys: &fstest.MapFS{
				"web/dist/index.html": &fstest.MapFile{Data: []byte(`<div id="root"></div>`)},
			},
			want: false,
		},
		{
			name: "empty index",
			fsys: &fstest.MapFS{
				"web/dist/index.html":       &fstest.MapFile{Data: []byte{}},
				"web/dist/assets/app-a1.js": &fstest.MapFile{Data: []byte("x")},
			},
			want: false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := embeddedWebOK(*tc.fsys); got != tc.want {
				t.Fatalf("embeddedWebOK = %v，想要 %v", got, tc.want)
			}
		})
	}
	if embeddedWebOK(nil) {
		t.Error("nil FS 不该被当成已构建")
	}
}

// 别让 embed.FS 与 MapFS 的签名差异悄悄把生产路径排除掉：
// 真正跑起来时传进来的就是这份 embed.FS。
func TestEmbeddedWebOKAcceptsEmbedFS(t *testing.T) {
	var fsys embed.FS
	// 空的 embed.FS 必然判 false；这里守的是类型能编过 + 不 panic。
	if embeddedWebOK(fsys) {
		t.Error("空 embed.FS 不该被当成已构建")
	}
}
