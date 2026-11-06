package component

// 组件注册表：新增组件只加一条声明，目录、依赖链、动作白名单都由它推导。
// 判据见 docs/components.md §2 / §8.5。这里刻意不用 map（顺序不稳定会让目录乱跳）。
//
// 🔴 写动词只有这一张表：install / update / uninstall / image-load 各挡一道，
//    页面、CLI、界面后端都问同一个 RunnableVerb，不各自抄字符串。
// 🔴 新增组件不写 Verbs 就只有 install —— 破坏性动词必须显式声明，
//    否则「加一条声明」会顺手给新组件开卸载权限。

import "strings"

const (
	PhaseReady   = "ready"   // 已实现检查与安装
	PhasePlanned = "planned" // 目录里占位，尚不允许任何写操作
)

const (
	VerbInstall   = "install"
	VerbUpdate    = "update"
	VerbUninstall = "uninstall"
	VerbImageLoad = "image-load"
)

type Component struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Kind    string `json:"kind"`
	Depends string `json:"depends,omitempty"`
	Phase   string `json:"phase"`
	// OfflineImage 表示这个组件的镜像不能在线 pull（k1 目标机拉不到 Docker Hub /
	// quay.io / dl.min.io），必须先由人从本机导入离线 tar。界面据此显示导入区。
	OfflineImage bool `json:"offline_image,omitempty"`
	// Verbs 是允许的写动作；空值等价于只开放 install。
	Verbs []string `json:"verbs,omitempty"`
}

var registry = []Component{
	{
		ID: "docker", Name: "Docker 引擎", Kind: "基础设施", Phase: PhaseReady,
		Verbs: []string{VerbInstall, VerbUpdate, VerbUninstall},
	},
	{
		ID: "minio", Name: "MinIO 服务", Kind: "备份存储", Depends: "docker", Phase: PhaseReady,
		OfflineImage: true,
		Verbs:        []string{VerbInstall, VerbUpdate, VerbUninstall},
	},
}

// All 返回副本（含 Verbs 的深拷贝），调用方改不动注册表。
func All() []Component {
	out := make([]Component, len(registry))
	copy(out, registry)
	for i := range out {
		out[i].Verbs = append([]string{}, registry[i].Verbs...)
	}
	return out
}

func Lookup(id string) (Component, bool) {
	id = strings.ToLower(strings.TrimSpace(id))
	for _, c := range registry {
		if c.ID == id {
			c.Verbs = append([]string{}, c.Verbs...)
			return c, true
		}
	}
	return Component{}, false
}

// Verbs 返回这个组件允许的动词；没声明的组件只有 install。
func Verbs(id string) []string {
	c, ok := Lookup(id)
	if !ok || c.Phase != PhaseReady {
		return []string{}
	}
	if len(c.Verbs) == 0 {
		return []string{VerbInstall}
	}
	return c.Verbs
}

// RunnableVerb 是**唯一**的写操作白名单：planned 组件一律拒绝，
// 免得界面把「还没实现」的 id / 动词变成一条会改远端的命令。
func RunnableVerb(id, verb string) bool {
	c, ok := Lookup(id)
	if !ok || c.Phase != PhaseReady {
		return false
	}
	if verb == VerbImageLoad {
		return c.OfflineImage
	}
	for _, v := range Verbs(c.ID) {
		if v == verb {
			return true
		}
	}
	return false
}

// Runnable 是 install 的兼容入口（旧调用与测试仍用它）。
func Runnable(id string) bool {
	return RunnableVerb(id, VerbInstall)
}

// SupportsImage 是 image-load 的白名单：只有声明了离线镜像的组件才允许导入 tar，
// 免得「上传任意本机文件到远端」变成一个通用后门。
func SupportsImage(id string) bool {
	return RunnableVerb(id, VerbImageLoad)
}

// DependsReady 按注册表里的依赖声明推导上游是否就绪。
// 目前只有 minio → docker，新增组件只要声明 Depends 就自动生效。
// 🔴 update / degraded 都算「已装」，不算缺失：可更新或带病运行的引擎仍能承载下游。
//    unknown / missing / planned 一律不就绪（硬约束 3）。
func DependsReady(c Component, states map[string]string) bool {
	if c.Depends == "" {
		return true
	}
	switch states[c.Depends] {
	case "ok", "update", "degraded":
		return true
	default:
		return false
	}
}
