---
name: web-panel-restart
description: 为本地单二进制工具的 Web 面板实现一键重建并重启（Windows detached 接手进程、六道门、boot_id 判据）。当用户要做界面上的重启按钮，或遇到重启后页面一直转圈、Failed to fetch、服务还在但跑的是旧进程时使用。
---

# 网页面板重启自己

给本机单二进制工具（Go / Rust / Node 打包）的 Web 面板加「点一下 → 重建 + 重启 → 页面自己回来」。

## 0. 开工前先判两件事

**适用**：Windows、单实例、`127.0.0.1` 面板，前端产物被 embed 进二进制。
**不适用**：服务端 / 多实例 / 有负载均衡、前端由独立 dev server 托管、无日志落点、Linux 或 macOS（那边用 `syscall.Exec` 同 PID 换映像，不要照抄本文）。任何一条命中，说明原因后停手。

**四个前提，缺一个就别做**，如实告诉用户并写进项目文档：

| 前提 | 缺了会怎样 |
| :--- | :--- |
| 构建时既能回 HTTP 响应，又能落日志 | 重建失败发生在隐藏进程里，无人看见 |
| 有一个本机日志文件作为 detached 进程的输出落点 | 新进程启动失败只剩「连不上」，原因查不到 |
| 端口 + token 已落盘可复用（如 `ui.json`，0600） | 页面回来后 401，或新进程绑到别的端口 |
| 前端能拿到进程实例标识 `boot_id` | 交接失败会被报成成功 |

已有 `ui.json` / 启动器 / 隐藏守护的项目通常满足前三项，只需补 `boot_id`；没有这些前置能力，先做 `skills/web-panel-launcher/`。

## 1. 四句红线

1. 🔴 **重建失败就地停**。构建可能产出一个起不来的二进制，交接之后没有回头路。
2. 🔴 **不换 token**。前端 token 只在内存和地址栏，换掉后轮询一直 401，`boot_id` 永远拿不到，一次成功会被误报成失败。
3. 🔴 **判据只有 `boot_id` 变了**。交接失败时旧进程会刻意原地活着，那时「服务还在」与「重启成功」在界面上完全一样；传输层失败也不是失败。
4. 🔴 **重建过就从产物 `next.exe` 拉起接手进程**，不要从正式 exe 拉。接手进程一旦从正式 exe 启动，自己就把这个文件锁住了，接下来的 `ReplaceBinary` 永远 `Access is denied`，日志还会写着「换不上」。

## 2. 施工顺序

1. `internal/restart/`：纯机制（`WaitPortFree` / `ReplaceBinary` / `NormalizeExePath` / `TargetExe` / `Spawn` / `Rebuild` / `Check`）+ 过期判定，**全项目只有这一份实现**。
2. 三个接口 + 六道门（`internal/ui/restart.go`）。
3. `__restart` 接手子进程 + `__takeover` 复用 port/token。
4. 前端判定纯函数 + 确认弹窗 + 全局顶部工具栏。
5. 文档与红线 → 测试矩阵 → 真机真跑。

依赖只许单向：`main → ui → restart → shared`。`restart` 不反向 import `ui`；接手入口放根包（如 `restartchild.go`）就是为了不成环。平台差异用 build tag 拆：`spawn_windows.go` 实现 detached，`spawn_other.go` **明确报错**，不要用未验证的 POSIX detach 假装能用。

**项目已有「退出码 75 + 启动器换身」时先评估，不要为了统一而重写**：那套方案只要满足 §0 的四个前提就能用，补齐 `boot_id`、确认视图与六道门即可；但 `ReplaceBinary` 的同路径拒绝、`boot_id` 唯一判据这两条必须补上。没有旧方案时，再按本文的 detached 接手进程落地。

## 3. 交接链路（顺序不能换）

服务端：

```text
1. 校验 confirm / 任务门 / 凭据可读性
2. 可选 Rebuild（用 context.Background()，不要 r.Context()：请求会断，构建要几十秒）
3. 留痕（交接之后这个进程就没了，日志必须写在前面）
4. 自己 json.Marshal + 显式 Content-Length + WriteHeader(200) + Write + Flush
5. sleep ~500ms（让浏览器开始轮询 health）
6. Spawn(接手进程)  ← 失败只记日志并 return，不退出、不写第二个响应体
7. srv.Shutdown(ctx, 3s)，关监听把端口让出来
8. exit(0)
```

接手进程 `__restart <addr> <targetExe> <newExe|->`：

```text
1. WaitPortFree(addr, 60s)        # 反复尝试 net.Listen，能绑上就是可以接手；不查 PID
2. newExe != "-" → ReplaceBinary(newExe, targetExe)
   ⚠️ 换不上不是致命，如实记日志，继续用现有二进制起服务
3. 以 __takeover --port <端口> 启动（从 ui.json 读 token）
```

启动 `__restart` 时选哪个 exe，是这条链路最容易错的一步：

| 这次有没有重建 | 用哪个 exe 拉起 `__restart` |
| :--- | :--- |
| 有（`newExe != "-"`） | **产物 `next.exe`** |
| 没有 | 正式 exe |

从正式 exe 拉起时，这个子进程持有正式 exe 的映像锁，第 2 步改名换身必然失败（Windows 报 `Access is denied`，重试到超时也一样）。`__takeover` 本身则永远用**正式 exe** 起，因为换身之后它才是新版本。

三条最容易漏的：

- **响应必须显式 `Content-Length`**：Go 在 handler 返回前 Flush 会退化成 chunked，结束块要等 handler 返回才写，而下一步就退出进程，客户端收到截断报文（`Failed to fetch`）。
- **先拉起再 Shutdown**：反过来接手进程要干等，端口还占着。
- **请求体先 `io.Copy(io.Discard, r.Body)` 读干净**：socket 上残留未读数据时关闭会发 RST，可能把已经完整收到的响应也丢掉。

## 4. 六道门（服务端 enforce，前端只是交互）

| # | 门 | 理由 |
| :--- | :--- | :--- |
| ① | `confirm_token` 绑「进程实例 + 端口 + token」，不一致 409 | 页面是上一个实例打开时，刚才看到的那份对照已不成立 |
| ② | 会写外部状态的长任务在跑时 409 拒绝 | 远端/数据库正在写，拦腰截断会留半状态（只提示「会中断」不够） |
| ③ | 重建按固定顺序执行，失败就地停、服务照旧在跑 | 交接之后没有回头路 |
| ④ | 接手进程从 `ui.json` 复用 port + token，令牌不进命令行 | 换 token 会 401；命令行参数在任务管理器里看得见 |
| ⑤ | 响应显式 `Content-Length`，先回 200 再退出；拉起失败就不退出 | 退出而新进程没起来 = 服务彻底没了 |
| ⑥ | 判据只有 `boot_id` 变了；传输层失败不是失败；同路径换二进制必须拒绝 | 否则成功/失败无法区分 |

**不要求输 `yes`**：重启是本机动作，二次确认弹窗摊开影响面即可。给主路径多加一次输入只会让人更少用它。

## 5. 重建与过期判定

- **顺序**：`npm install`（仅依赖缺失时）→ `npm test` → `npm run typecheck` → `npm run build` → `go build -o <tool>.next.exe .`。每步设 300s 超时，一次卡住的构建会把「正在重建」状态锁死。
- **产物必须落 `<tool>.next.exe`**：正在运行的 exe 被 Windows 锁着，直接覆盖只会拿到 sharing violation。旧进程退出后由接手进程改名换上去。
- **命令拼装**：`name` 与 `args` 分开传，绝不自己拼命令行字符串；后端构建直接 exec，不经 `cmd.exe`；只有 `npm`（`.cmd`）需要 `cmd.exe /d /c`。
- **过期判据**：前端源码比前端产物新 → 前端要重建；后端源码**或前端产物**比 exe 新 → 后端要重编。所有 embed 输入目录都要算，漏一个就是「改了没生效」。
- **运行态文件一律排除**（`*.exe` / `*.exe~` / `*.log` / `*.env` / `ui.json` / `node_modules` / `.git`），否则「先重建」会永远勾着。
- **基线拿不到 = 过期**，不是「不知道」，理由里写明缺哪个文件。
- **没有前端构建链就删掉 npm 四步**（单文件 HTML、产物已入库等），只留 `go build`。不要为了凑步骤临时搭一个前端工程。
- **embed 输入怎么列**：Go 从源码读 `//go:embed` 指令再展开成实际文件；其它栈按构建配置列。不要靠人记 —— 漏一个就是「改了没生效」。
- 输出合并、只回传末尾 60 行；回读确认产物真的存在。

## 6. 前端

- **判定与渲染分离**：`defaultRebuild` / `judgeHandover` / `timeoutMessage` / `shouldRefreshView` 放进不依赖 DOM / React 的模块，能脱离浏览器单测。
- **单文件 HTML 没有 JS 测试链时**：仍把这四个函数写成不依赖 DOM 的独立函数，真值表写进注释，测试至少做字符串级断言；在交付说明里注明「真值表未执行」，不要假装测过。
- 🔴 **`unknown` 不许显示成成功或失败**：拿不到重启前的 `boot_id` 只能说「没法确认」；连接断几秒是「还没到」，不是结论。
- 请求后每 1s 轮询 health，`boot_id` 变了才 `location.reload()`；上界 120s，超时提示必须带日志路径。
- 只有服务端明确回 JSON 错误（ApiError）才算「它没动手」；传输层异常忽略，转去等 `boot_id`。
- 按钮放**全局顶部工具栏**（对服务本身的动作，与当前页无关，不随页面卸载）。点完就关弹窗，等待交给全局 loading。
- 弹窗走 `App.useApp()` 的 `modal` / `message`，不要用静态方法（拿不到主题，真机表现为「点了没反应」）。
- `impact` 逐条 `<li>` 摊开，**不写 Markdown 加粗**（JSX 纯文本会原样显示星号）。

## 7. 验收（逐条打勾）

**自动**：`WaitPortFree` 超时/空出、`ReplaceBinary` 同路径拒绝、`NormalizeExePath`、`Check` 各类过期与运行态不触发、`Rebuild` 任一步失败立即停、确认令牌换实例失效、六道门各回对应状态码、重建失败不交接不退出、Spawn 失败不退出、前端判定真值表。

**真跑**（临时配置目录 + 独立端口 + `--no-open`）：记 `before.boot_id` → 触发过期得 `binary_stale=true` → 带 `rebuild=true` 拿完整 200 → 轮询到 `boot_id` 变化、正式 exe mtime 变化、`next.exe` 消失 → 再来一次 `rebuild=false` → 错 `confirm` 回 409 且服务未被动过。

**真机**：勾「先重建」页面断连几秒后自己回来；不勾也能回来且 exe mtime 不变；故意改坏一个 `.ts` → 提示重建失败但服务照旧在跑；长任务在跑时被拒绝。

## 8. 详细参考

- `references/contracts.md` —— 接口 JSON 形状、确认视图字段、交接参数含义、确认令牌、换项目常量表。
- `references/pitfalls.md` —— 12 个实测坑、按症状查的故障速查。

完整背景、决策与被否方案见 `docs/工程/实现手册/网页面板重启自己（通用实现手册）.md`（在 cqlql-notes 仓；目标仓没有这份文档时，以本 skill 为准）。
