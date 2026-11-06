package component

// 组件注册表：新增组件只加一条声明，目录、依赖链、动作白名单都由它推导。
// 判据见 docs/components.md §2。这里刻意不用 map（顺序不稳定会让目录乱跳）。

import "strings"

const (
	PhaseReady   = "ready"   // 已实现检查与安装
	PhasePlanned = "planned" // 目录里占位，尚不允许任何写操作
)

type Component struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Kind    string `json:"kind"`
	Depends string `json:"depends,omitempty"`
	Phase   string `json:"phase"`
}

var registry = []Component{
	{ID: "docker", Name: "Docker 引擎", Kind: "基础设施", Phase: PhaseReady},
	{ID: "minio", Name: "MinIO 服务", Kind: "备份存储", Depends: "docker", Phase: PhasePlanned},
}

// All 返回副本，调用方改不动注册表。
func All() []Component {
	out := make([]Component, len(registry))
	copy(out, registry)
	return out
}

func Lookup(id string) (Component, bool) {
	id = strings.ToLower(strings.TrimSpace(id))
	for _, c := range registry {
		if c.ID == id {
			return c, true
		}
	}
	return Component{}, false
}

// Runnable 是**唯一**的写操作白名单：planned 组件一律拒绝，
// 免得界面把「还没实现」的 id 变成一条会改远端的命令。
func Runnable(id string) bool {
	c, ok := Lookup(id)
	return ok && c.Phase == PhaseReady
}

// DependsReady 按注册表里的依赖声明推导上游是否就绪。
// 目前只有 minio → docker，新增组件只要声明 Depends 就自动生效。
func DependsReady(c Component, states map[string]string) bool {
	if c.Depends == "" {
		return true
	}
	s := states[c.Depends]
	return s == "ok" || s == "degraded"
}
