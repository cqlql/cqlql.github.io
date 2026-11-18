# 接口契约与换项目常量

## 1. `GET /api/health`

```json
{ "ok": true, "data": { "ok": true, "boot_id": "<这个进程实例>" } }
```

`boot_id` 是**进程级随机值**（8 字节随机数，取不到退化成时间戳，**绝不返回空串**）。不要用 PID 代替：PID 会变，但「服务还在」与「重启成功」必须能分开。

## 2. `GET /api/restart`（确认视图）

| 字段 | 类型 | 用途 |
| :--- | :--- | :--- |
| `confirm_token` | string | 绑「进程实例 + 端口 + token」；页面是上一个进程打开的就得 409 |
| `impact` | string[] | 影响面原文，弹窗里逐条摊开 |
| `build_command` | string[] | 「会跑：…」给人看，不是给人执行 |
| `binary_stale` / `stale_reason` | bool / string | 前端据此**自动勾**「先重建」 |
| `log_path` | string | 启动失败原因只在这里 |
| `port` / `exe` / `exe_exists` | | 当前事实；exe 不在时没什么可重启 |
| `task_running` | bool | 有长任务在跑时弹窗提前提示（真正的拦截在 POST） |
| `note` | string | 非空 = 现在不能重启，前端**不给按钮** |

## 3. `POST /api/restart`

```text
请求：{ "rebuild": true|false, "confirm": "sha256:…" }   // 只认这两个字段，多余的直接拒
200： { ok:true, data:{ restarting:true, rebuild, build_output, boot_id } }   // 显式 Content-Length
409： confirm 过期 / 长任务在跑 / 接手凭据读不到
500： 重建失败（服务照旧在跑）/ 拼响应失败（不交接）
```

## 4. 交接参数含义

`__restart <addr> <targetExe> <newExe|->`

| 参数 | 含义 |
| :--- | :--- |
| `<addr>` | 等它空出来 = 旧进程已让位的**唯一**信号 |
| `<targetExe>` | `ReplaceBinary` 的**目标**（正式 exe），不是「从哪个文件起来」 |
| `<newExe｜->` | 重建产物；`-` 表示没重建（此时**不跑** `ReplaceBinary`） |

「从哪个文件起来」是第四个隐含值：重建过就从 `next.exe` 起，否则从正式 exe 起。把两者混填会让 `ReplaceBinary` 变成 `next.exe → next.exe` 的空操作，**表面成功、正式 exe 永远停在旧版本**，日志却写着「新二进制已就位」。

这条不是命名问题，是文件锁：`__restart` 若从正式 exe 启动，它自己就锁住了 `ops.exe`，`ReplaceBinary(next → target)` 会一直 `Access is denied`。所以「用哪个 exe 拉起 `__restart`」与「`__takeover` 从哪个 exe 起」必须分开看。

## 5. 确认令牌

- 绑定「进程实例 + 端口 + token」，换实例或换端口后失效。
- 409 后前端要重新拉一次视图，否则下次点「执行」还拿旧 `confirm_token`。

## 6. 前端四个判定函数

| 函数 | 规则 |
| :--- | :--- |
| `defaultRebuild(info)` | `info.binary_stale === true`。写死 `true` 白等几十秒；写死 `false` 会用旧二进制起来 |
| `judgeHandover(before, after)` | `after === before` → `unchanged`；`after` 非空且不同 → `restarted`；`before` 为空、`after` 为空/null → `unknown` |
| `timeoutMessage(info, seconds)` | 必须带日志路径 |
| `shouldRefreshView(status)` | 409 / 500 后重新拉视图 |

「先重建」复选框的默认值**只在第一次拿到事实时设一次**，之后不要覆盖用户的手动选择。

## 7. 换项目只改这些

| # | 常量 / 位置 | 示例 | 要确认什么 |
| :--- | :--- | :--- | :--- |
| 1 | 正式 exe / 重建产物 | `ops.exe` / `ops.next.exe` | 名字与后缀；`.gitignore` 忽略 `*.exe` |
| 2 | 内部子命令名 | `__restart` / `__takeover` | 下划线开头，不进注册表、不进 `--help` |
| 3 | 配置目录与凭据 | `%APPDATA%\<vendor>\ui.json`（0600） | 覆盖变量；`GET /api/restart` 要能校验它 |
| 4 | 日志文件 | `<vendor>/ops-ui.log` | detached 进程与后台守护**共用一份**打开逻辑 |
| 5 | 默认端口 / 递增上限 | 7788 / 20 | 与同机其它工具错开 |
| 6 | 单实例名 | `Local\<vendor>-<tool>-ui-<hash>` | 带配置目录指纹；接手要重试拿锁 |
| 7 | 构建命令 | `npm test / typecheck / build` → `go build -o …next.exe .` | 换真实构建链；`test/` 是否在 tsc include 里 |
| 8 | embed 输入 | `deploy/backup/**`、`web/dist/index.html` | **逐个列全**，漏一个就是隐性过期 |
| 9 | 长任务判据 | `backupBusy()` | 换成「会写外部状态」的判定函数 |
| 10 | HTTP 信封 / token 头 | `{ok,data,error}` / `X-Ops-Token` | 前后端对齐 |
| 11 | 影响面文案 | 5 条 | 按项目改「会中断什么」「日志在哪」，别照抄 |
| 12 | 等新进程上界 | 120s | 冷启动慢的机器要放宽 |

## 8. 文件清单（路径按项目形状替换）

**新增**：

```text
<机制层>/restart.go              # 常量、WaitPortFree、ReplaceBinary、NormalizeExePath、TargetExe
<机制层>/spawn_windows.go        # Spawn（detached + 日志句柄）、构建不弹窗
<机制层>/spawn_other.go          # 非 Windows 明确报错
<机制层>/rebuild.go              # 构建顺序、超时、产物回读
<机制层>/staleness.go            # 过期判定（唯一实现）+ 构建命令
<机制层>/*_test.go               # 交接 / 重建顺序 / 过期判定
<ui层>/restart.go                # health / 确认视图 / 执行接口、六道门、交接编排
<ui层>/restart_test.go           # 409、重建失败不交接、Content-Length、Spawn 失败不退出
<根包>/restartchild.go           # __restart 接手入口（调 CmdUI）
<根包>/restartchild_test.go      # 参数解析、内部命令不进注册表
web/src/features/system/*        # types / api / restartFlow / RestartPanel + 测试
```

**修改**：

```text
main.go              # 注册内部 __restart（不进 usage / 菜单）；抽出共用 ui 入口
<ui层>/ui.go          # 三个路由；__takeover 分支（复用 token + 单例重试 + 不新开浏览器）
<后台层>/background.go # acquireSingletonRetry（接手专用，8s 上界）
web/src/App.tsx       # 全局顶部工具栏
AGENTS.md / docs/    # 结论、红线、验收
```

**不该动**：启动器（`.cmd` / `.lnk`）、配置模板、远端相关代码。
