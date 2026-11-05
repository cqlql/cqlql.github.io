package shared

// ShortcutInfo 是「桌面快捷方式建好了」的凭据。
//
// 放 shared 而不是 launcher：创建逻辑在 launcher（它要用 ui.IconBytes 写图标），
// 但界面（internal/ui）也要把结果原样回给前端，而 ui **不能反向依赖 launcher**
// （launcher 已经 import ui，反过来就成环）。于是 main.go 把创建函数注入给 ui，
// 两边共用这一个模型——命令行打印与页面显示的是同一份字段。
type ShortcutInfo struct {
	Path     string `json:"path"`
	Launcher string `json:"launcher"`
	Icon     string `json:"icon"`
}
