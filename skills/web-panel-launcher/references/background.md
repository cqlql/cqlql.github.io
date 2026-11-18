# 后台守护相关代码片段

## 1. 隐藏守护进程（Windows）

```go
const createNoWindow = 0x08000000 // 有控制台、没窗口

func spawnBackgroundGuard(launcher string, args []string, logPath string) error {
	logFile, err := openRotatedLog(logPath, 512<<10)
	if err != nil {
		return err
	}
	defer logFile.Close()

	// cmd 的 /c 老坑：整行以引号开头会剥掉首尾引号，路径带空格就散架。
	line := `/s /c ""` + launcher + `" --bg`
	for _, a := range args {
		line += " " + quoteArg(a)
	}
	line += `"`

	c := exec.Command("cmd.exe")
	c.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: createNoWindow,
		CmdLine:       line,
	}
	c.Stdout = logFile
	c.Stderr = logFile
	c.Dir = filepath.Dir(launcher)
	return c.Start() // 不 Wait：父进程退得越快，黑窗口闪得越短
}
```

非 Windows 平台让 `--background` 明确报错：「Linux/macOS 直接 `ui &`，或交给 systemd-run」，不要静默降级成前台。

## 2. 单实例键：名字带配置目录指纹

```go
func uiSingletonKey(dir string) string {
	sum := sha1.Sum([]byte(strings.ToLower(filepath.Clean(dir))))
	return fmt.Sprintf(`Local\<prefix>-ui-%s`, hex.EncodeToString(sum[:6]))
}
```

为什么：互斥体是**机器级**的，而配置目录常被环境变量覆盖（测试 / 多环境）。用固定名字时，A 目录的界面会把 B 目录的启动挡掉，然后指着 B 目录里根本不存在的 `ui.json` 让你「删掉再试」。

菜单与界面是两个独立的单实例域，用两个不同的名字。

## 3. `ui.json`

```json
{"port": 7789, "token": "…32 字节 hex…"}
```

- 落配置目录，权限 `0600`；
- 每次启动覆写；进程退出后留着；
- 读取时校验 `port > 0 && token != ""`。

## 4. 日志轮转

```go
func openRotatedLog(path string, limit int64) (*os.File, error) {
	if st, err := os.Stat(path); err == nil && st.Size() > limit {
		_ = os.Remove(path)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	return os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
}
```

超过上限**整个重写**；这里的内容基本是「又启动了一次」，留最近一截就够。上限 512 KB 是实测够用的值。

## 5. 就绪等待

```go
before := uiInfoStamp(dir)
if err := spawnGuard(...); err != nil { return 1 }
if err := waitUIReady(dir, before, 6*time.Second); err != nil {
	fmt.Fprintf(os.Stderr, "ERROR: 后台界面没能起来：%v\n", err)
	fmt.Fprintf(os.Stderr, "       详情：%s\n", filepath.Join(dir, logName))
	fmt.Fprintln(os.Stderr, "       下面回退到前台运行，错误会直接显示在这个窗口里。")
	return 1 // .cmd 见到非 0 → 前台 ui
}
```

判据：`ui.json` 被新进程**更新且内容完整**；只看 mtime 或只看文件存在都不够。

## 6. 端口递增

```go
func uiListen(requested int, explicit bool) (net.Listener, int, error) {
	tries := 20
	if explicit {
		tries = 1
	}
	var lastErr error
	for i := 0; i < tries; i++ {
		p := requested + i
		if p < 0 || p > 65535 {
			break
		}
		ln, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(p)))
		if err == nil {
			return ln, ln.Addr().(*net.TCPAddr).Port, nil // --port 0 也能拿到真实端口
		}
		lastErr = err
	}
	if explicit {
		return nil, 0, fmt.Errorf("监听 127.0.0.1:%d 失败：%v（显式端口被占用，换一个或去掉 --port）", requested, lastErr)
	}
	return nil, 0, fmt.Errorf("从 %d 起连试 %d 个端口都不可用：%w", requested, tries, lastErr)
}
```

## 7. 关闭界面

先写响应、`sleep 300ms` 再 `os.Exit(0)`。顺序反了，浏览器拿到的是「连接被重置」，而它本来该显示「界面已关闭」。
