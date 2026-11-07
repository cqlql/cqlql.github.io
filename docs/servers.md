> 状态：**P0 已实现并真机验证（check / apply-sudo / 幂等）**（2026-11-05）；
> P2a 只读监控账号护栏已落地（`monitor` 撞车校验 + `MonitorSSHTarget()` 强制，2026-11-07）；
> P2+ 起它可在界面「配置 → 服务器清单 → 只读监控账号」编辑，保存时即校验（2026-11-08，
> 见 [ui.md](ui.md) §12.9）。

# 服务器集中管理（含一键免密 sudo）

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)；配置键见 [config.md](config.md)。
> 本文只覆盖**服务器清单 + 连接/提权底座**；备份安装见 [backup-deploy.md](backup-deploy.md)，
> 备份监控见 [backup-monitor.md](backup-monitor.md)，应用部署见 [deploy.md](deploy.md)。

## 1. 要解决什么

服务器散落在各命令的配置里：备份端一套 `PASS_UP_OPS_BACKUP_*`，应用端一套
`PASS_UP_OPS_DEPLOY_*`，同一台机器要说清「连的是哪台」很费劲；新机器接入还要手工敲
`/etc/sudoers.d` 才能让非交互命令跑起来。

目标：

1. **一份服务器清单**登记所有机器（备份服务器、应用服务器）；
2. `ops servers list/check` 与本机界面统一查看「SSH 是否可达、免密 sudo 是否已配置」；
3. 界面上**一键**为目标用户落地免密 sudo，之后所有命令一律 `sudo -n`，不再输入密码。

## 2. 边界

**做**：清单解析与校验、SSH 探测、免密 sudo 的检查与落地、本地界面（默认只读视图）。
界面左侧导航另有「备份能力部署」页做显式安装，规则见 [ui.md](ui.md) §9；本文只管清单与提权底座。

**不做**：

- 不重写 `install.sh` / 备份 / 部署逻辑——它们改为按 `--server` 选目标；
- 不在界面增删改服务器（清单由本机文件维护，P0+ 再评估表单）；
- 不做密码保险箱、批量定时巡检、跳板机多跳；
- 不提供任意 host 参数：**命令只接受清单里的 `name`**。

## 3. 服务器清单

文件：`PASS_UP_OPS_SERVERS_FILE`（默认值见 [config.md](config.md) §2），
**不进 Git、权限 `600`**。

```json
{
  "default": "backup-01",
  "servers": [
    {
      "name": "backup-01",
      "role": "backup",
      "host": "172.16.0.222",
      "port": 2223,
      "user": "cql",
      "key": "C:\\Users\\cql13\\.ssh\\id_ed25519",
      "sudo": { "mode": "nopasswd", "password": "" },
      "monitor": { "user": "passup-ro", "key": "C:\\Users\\cql13\\.ssh\\id_ed25519_ro" },
      "note": "测试机（备份端）"
    },
    {
      "name": "app-01",
      "role": "app",
      "host": "10.0.0.21",
      "port": 22,
      "user": "deploy",
      "key": "~/.ssh/id_ed25519",
      "sudo": { "mode": "nopasswd" }
    }
  ]
}
```

| 字段 | 必填 | 说明 |
| :--- | :--- | :--- |
| `name` | 是 | 唯一；所有命令用它选目标（`--server app-01`） |
| `role` | 是 | `backup` / `app` / `db` / `other`；界面分组与默认目标用 |
| `host` / `port` | 是 / 否 | `port` 缺省 `22` |
| `user` | 是 | **SSH 登录用户，也是免密 sudo 的授予对象** |
| `key` | 否 | 私钥路径（支持 `~`）；**不打印**；缺省走 `~/.ssh/config` |
| `sudo.mode` | 否 | `nopasswd`（默认目标）/ `none`（不配置）/ `root`（直接 root 登录，无需配置） |
| `sudo.password` | 否 | 可选的**初始** sudo 密码；配置成功并验证后建议删除，见 §8 |
| `monitor` | **P2a `status` 必填** | 专用只读监控账号 `{user,key}`；`monitor.user != user` 且不能是 root，`monitor.key` 必填；**不复用** `user`/`key`，也不带 sudo 密码。可在界面「配置 → 服务器清单 → 只读监控账号」填写 / 查看状态 / 显式移除（[ui.md](ui.md) §12.9）；私钥路径不回显，保存时校验文件存在与账号合法性 |
| `note` | 否 | 仅供人看 |

- `default` 只影响省略 `--server` 的命令；不填时：`role=backup` 唯一则取它，否则报错要求显式指定。
- 🔴 **只读账号与安装账号分离**（P2a 落地）：`normalize()` 只挡「`monitor.user == user`
  撞车」这一种 schema 错误，**不要求**每台机器都配 `monitor`（P0/P1 的写操作不需要它；
  界面可在配置页补，保存时另过一次强校验，见 [ui.md](ui.md) §12.9）；
  「`monitor.user` / `monitor.key` 齐全、不等于 `user`、不是 root」由
  `Server.MonitorSSHTarget()` 在 `ops status` 采集入口强制。缺 monitor 会明确报错，
  不会静默退回安装账号；target 不带 `sudo.password`、`IsRoot=false`，采集不提权。
- 同一份清单里 `name` 重复、缺 `host`/`user`、端口越界、`key` 指向不存在文件 → **加载即失败**。
- 🔴 **主机定义只在这里**：`PASS_UP_OPS_BACKUP_HOST` / `..._DEPLOY_HOST` 等旧主机键一律删除，
  不保留第二套来源（迁移说明见 [config.md](config.md)）。

## 4. 命令

```
ops servers list [--json]
    清单与最近一次检查结果（未检查过的显示 —，不假装成功）

ops servers check [name|all] [--json]
    只读：SSH 可达 + 当前账号能否 sudo -n；退出码 0=已免密/root，1=需要配置，2=连接失败

ops servers apply-sudo <name> [--password-stdin] [--yes]
    写：为 `server.user` 落地 /etc/sudoers.d/90-<user>-nopasswd，然后以该用户身份验证
    --password-stdin  从 stdin 读初始 sudo 密码；**没有、也不接受 `--password` 参数**
    --yes             跳过本地二次确认（脚本/CI 用；交互默认要求确认）

ops ui [--port 7788]
    本机界面：服务器列表 + 检查 + 一键免密 sudo（P0）；备份面板在 P2 接入同一页面
```

`ops servers check` 绝不写远端；`apply-sudo` 才写，且只允许清单里的 `name`。

## 5. 本地界面

- 只监听 `127.0.0.1`；进程随机 token，地址带 `?token=...`；每个请求校验 token + `Origin`。
- 服务器卡片：名称 / 角色 / `user@host:port` / SSH / 免密 sudo 状态 / 最近检查时间。
- 操作：`检查全部`、单台 `检查`、单台 `一键免密 sudo`。
- 写操作（`apply-sudo`）必须是 `POST`，且只接受 `name`；未知 name 返回 404，不代理任意主机。
- 密码表单：`type=password`、`autocomplete=off`；**只在本次请求内存中存在**，
  提交后立即清空，不写日志、不落配置；页面回显只显示「已配置 / 需要配置 / 连接失败」。
- 仅当「SSH 可达 + 尚无免密 sudo + 清单无 `sudo.password`」时才弹出密码输入框。
- 界面**不提供**新增/删除服务器；「配置」页可编辑已有条目的
  `host / port / user / role / note / sudo.mode / key / sudo.password`，`name` 是主键不可改。
  每次保存要输 `yes`，服务端按 `shared.LoadServers` 全量校验、0600 + `.bak` 原子替换，
  改了 `user` / `sudo.mode` 会提示重新执行「一键免密 sudo」（drop-in 按用户名写）。
  见 [ui.md](ui.md) §12。清单路径仍可点开编辑器。

检查结果只写同目录的 `servers.state.json`（`600`，纯缓存、可随时删除）；没检查过显示 `—`，
不假装成功。

## 6. 一键免密 sudo 的实现

落点与内容（与参考实现一致）：

```
/etc/sudoers.d/90-<user>-nopasswd
<user> ALL=(ALL) NOPASSWD:ALL
```

流程：

1. 从清单取 `name` 对应条目；`user=root` 或 `sudo.mode=root` → 直接标记「无需配置」。
2. **探测**：`ssh -o BatchMode=yes ... 'sudo -n true'` 成功 → 已完成，不再要求密码。
3. **取密码**：优先清单 `sudo.password`，否则界面输入 / `--password-stdin`；
   两者都没有 → 明确失败「需要初始密码」，不静默跳过。
4. 校验密码：`printf '%s\n' <pw> | ssh ... 'sudo -S -p "" true'`；失败即「密码错误」。
5. **落地**：远端写临时文件 → `visudo -cf` 自检 → `install -m 0440 -o root -g root` 落位；
   自检失败不留半成品。已有**同路径但内容不同**的文件：先拉回本机备份
   （`~/.config/pass-up/backups/sudoers/<name>-<ts>`，`600`）再替换。
6. **验证**：`runuser -u <user> -- sudo -n true`。
   🔴 不能以 root 身份验证——root 自己 `sudo -n` 永远成功，等于没验。
   验证失败：删除本次新建的 drop-in（原本就存在的只恢复备份），报告失败原因。
7. 成功后刷新状态；若 `sudo.password` 写在清单里，提示删除。

传输细节：

- 远端脚本以 base64 命令串传递，**stdin 只留给 sudo 密码**；
  不使用 `ssh -t ... bash -s`（`-t` 之后 stdin 是 TTY，密码没地方放）。
- `BatchMode=yes`：公钥失败立刻退出，不会在无人值守时弹密码提示。
- 节点重装后 drop-in 丢失，症状是 `sudo: a password is required`；`check` 应直接显示「需要配置」。

## 7. 与其它能力的关系

| 能力 | 目标机来源 | 命令形态 |
| :--- | :--- | :--- |
| 服务器管理（本文） | `servers.json` | `ops servers ...` / `ops ui` |
| 备份能力部署（P1） | `servers.json` | `ops backup deploy --server <name>` |
| 备份监控（P2） | `servers.json` | `ops status --server <name>` |
| 应用部署（P3–P4） | `servers.json` | `ops deploy --server <name>` |

备份/部署的**路径类配置**（`BACKUP_DEPLOY_DIR`、`DEPLOY_DIR` 等）仍是全局默认；
出现第二台同类服务器时再按需加 server 级覆盖，**不为假设需求提前设计**。

## 8. 安全

1. 界面只监听 `127.0.0.1`，token + `Origin` 校验；写操作 `POST`。
2. sudo 密码生命周期：输入 → 单次请求内存 → 用完即清；不落盘、不进日志、不进命令行。
   **禁止** `--password` 参数（进程列表可见）；只允许 `--password-stdin`。
3. 清单里可选的 `sudo.password` 属**长期凭据**：仅 0600 文件、配置成功后建议删除；
   多人共用的机器优先用界面一次性输入。
4. 私钥路径可以写进配置，但**任何输出、错误、日志都不打印它**。
5. 只对清单内的 `name` 操作，不接受任意 host，防止误配置 / 被当作探测跳板。
6. 只写一个 drop-in，不改 `/etc/sudoers` 与其它片段；权限必须 `0440 root:root`（否则 sudo 忽略）。

## 9. 阶段

| 阶段 | 内容 | 验收 |
| :--- | :--- | :--- |
| P0（先做） | `servers.json` + `servers list/check` + `apply-sudo` + 界面一键配置 | 测试机从「需要密码」变成 `sudo -n` 通过；重复执行幂等；错误密码有明确提示 |
| P0+（可选） | 界面增删改清单、批量检查 | 按需 |

## 10. 风险与决策

| 风险 / 决策 | 说明 |
| :--- | :--- |
| 密码通道与参考实现不一致 | 参考仓库刻意「控制台无密码通道」，本工具按需求允许**界面一次性输入**；用 loopback + 单请求内存 + stdin-only 收敛风险，参考里的 `visudo` / `install` / `runuser` 三条细节照搬 |
| 误把 NOPASSWD 配给 root | `user=root` 直接标记「无需配置」，不写文件 |
| 覆盖了别家 sudoers | 只动 `90-<user>-nopasswd`；内容不同先备份再替换 |
| 重复执行 | 先 `sudo -n` 探测，已免密直接成功，不重复写 |
| 主机配置双源 | 清单即唯一来源，删除旧 `*_HOST/_PORT/_USER/_KEY` 键 |
| 界面暴露风险 | 只监听 `127.0.0.1`，token + `Origin`，写操作 `POST`，不提供任意 host |
| 清单格式 | JSON（标准库即可）；不引入 YAML 依赖 |
| 参考实现 | `D:\_work\infra\cluster-infra\AGENTS.md` 第 87 行起（SSH / 免密 sudo） |
