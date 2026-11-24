---
name: ubuntu-apt-mirror
description: 给 Ubuntu 服务器换 apt 源（24.04+ deb822）：先在那台机器上实测到各镜像站的延迟与串行吞吐，再按验签通过的配置备份写入，写失败自动还原。当用户说 apt install / apt update 很慢、要换清华/阿里/腾讯/华为等镜像源、给一批服务器挑最快的源、或要把「测速＋换源」接进网页面板时使用。也可用于诊断「换完源 apt 就坏了」这类事故。
---

> 状态：**现行**（2026-11-24）。脚本按 POSIX sh 写，远端零依赖（只要 curl / gpgv）。

# Ubuntu 换源

## 1. 什么时候用

| 用 | 不用 |
| :--- | :--- |
| `apt update` 慢、要换国内镜像 | Debian / CentOS / Alpine（路径与格式都不同） |
| 一批服务器要挑「哪家镜像对这台机器最快」 | 只有一行式源的老系统（≤22.04，见 §2） |
| 换完源 apt 报错，要查 / 要退 | 只是问「哪个镜像站好」（先测，别背结论） |
| 把测速 + 换源做成面板功能 | 只想装个包、和换源无关 |

## 2. 五条红线

1. **测速必须在目标机上跑**。镜像站快不快取决于「从这台机器出发的网络」；在办公室 / 在控制台测出来的名次不能拿去改机房服务器。
2. **只改 deb822**（`/etc/apt/sources.list.d/ubuntu.sources`，Ubuntu 24.04+）。22.04 及更早的 `/etc/apt/sources.list` 是一行式，格式不同 —— **检测到只有它会如实拒绝**，不硬写一份对不上的配置（写坏 apt 的代价远大于「这次没换成」）。
3. **写前必验签**：每个 suite 取 `InRelease`，用与候选源 `Signed-By` **同一个** keyring 跑 `gpgv`，再确认 components 真在里面。过不了这一步，apt 将来一定过不了。
4. **写前必备份，写后必回读**：备份到 `<文件>.aptmirror.bak`（覆盖上一次 = 永远是「这次写之前」的原文）；写入用 `install -m 0644`；读回来和写的不是同一份就算没写成，立刻还原。
5. **写源不等于刷新索引**。本文流程刻意**不跑** `apt-get update`：那要下几十 MB、还会和 `apt-daily` 抢锁，是另一件事。要立刻生效，人自己挑时间跑一次。

## 3. 标准流程（六步）

```sh
# ① 看现状（只读）：deb822 在不在、代号、curl/gpgv/keyring、当前全文
ssh root@host 'sh -s' < scripts/status.sh

# ② 在目标机测速（只读，串行吞吐）→ 延迟 / 吞吐 / 名次
ssh root@host 'APT_ROUNDS=1 APT_BUDGET=3 sh -s' < scripts/probe.sh

# ③ 生成本次要写的 deb822 文本（唯一来源，③④⑤ 用的是同一份）
sh scripts/snippet.sh https://mirrors.aliyun.com/ubuntu noble

# ④ 预演（仍然会验签，只是不落盘）
APT_MODE=plan APT_BASE=https://mirrors.aliyun.com/ubuntu APT_SUITE=noble \
  APT_NEXT_FILE=/tmp/next.sources sh scripts/switch.sh

# ⑤ 写入（要 sudo；只读脚本别提权，写入才提权）
sudo env APT_MODE=apply APT_BASE=... APT_SUITE=... APT_NEXT_FILE=/tmp/next.sources \
  sh scripts/switch.sh

# ⑥ 复核：改天自己跑 sudo apt-get update；出问题按 references/pitfalls.md 回退
```

**为什么 ③ 单独一步**：换源文本只该有一份。界面给你看的那段、CLI 打印的那段、实际写进去的那段，都从 `snippet.sh`（或项目里那个 Go 函数）出。远端脚本只负责「验证 / 写 / 还原」，**不在远端再拼第二份**。

## 4. 远端执行的三条规矩

1. **变量拼在 `sh -s` 前面**，别塞进 stdin：`sh -s` 的 stdin 已经被脚本体占了，`APT_MIRRORS` 这类数据只能走环境变量或落盘文件。
2. **只读脚本走 stdin、不提权**：`ssh host 'sh -s' < x.sh`。要写入才 `sudo`，且**先落盘再 sudo**（把脚本 scp 到 `/tmp` 再 `sudo sh /tmp/x.sh`），否则「一边喂脚本一边 sudo 读密码」两件事会抢 stdin。
3. **必须 LF**。CRLF 的脚本在目标机上会报 `$'\r': command not found` 或 `set: -: invalid option`；本目录 `.gitattributes` 已钉 `scripts/*.sh text eol=lf`，自己另存时注意。

## 5. 脚本与输出契约

| 脚本 | 作用 | 关键变量 |
| :--- | :--- | :--- |
| `scripts/status.sh` | 只读现状：deb822 / 代号 / curl / gpgv / keyring / 当前全文（base64） | `APT_SOURCES` `APT_ONELINE` |
| `scripts/probe.sh` | 在**运行处**测速：延迟 + 串行吞吐，输出名次 | `APT_SUITE` `APT_MIRRORS` `APT_MIRRORS_FILE` `APT_ROUNDS` `APT_BUDGET` |
| `scripts/snippet.sh` | 打印 deb822 文本（展示 / 复制 / 写入都用这一份） | `APT_BASE` `APT_SUITE` `APT_COMPONENTS` `APT_KEYRING` |
| `scripts/switch.sh` | 验证 → 备份 → 写 → 复核 → 还原 | `APT_MODE` `APT_BASE` `APT_SUITE` `APT_SUITES` `APT_COMPONENTS` `APT_NEXT_B64` `APT_NEXT_FILE` `APT_SOURCES` `APT_ONELINE` `APT_KEYRING` |

输出统一是分节文本：`## 节名` + `key=value`；`verify=` 会重复多次（一个 suite 一条，**别用 map 去重**）。`result` 的取值：

`plan` / `no_change` / `done`（成功）；`verify_failed` / `unsupported_layout` / `no_source_file` / `no_curl` / `no_gpgv` / `no_keyring` / `backup_failed` / `write_failed` / `write_mismatch` / `bad_base` / `bad_suite` / `no_suite` / `bad_next` / `temp_failed`（失败，`detail` 里是给人看的原因）。

只读脚本失败也 `exit 0`，把原因写进 `probe_error` / `error` —— 这样「没测到」不会被误当成「命令挂了」。

## 6. 判读口径（最容易给出错误答案的六处）

1. **串行吞吐**。并发下载会让所有源平分带宽，每个都测成 1/N，名次变成「谁先启动谁快」，而它看起来完全正常。
2. **失败 ≠ 0 KB/s**。`reachable` 与 `throughput_ok` 分开：连不上的源要去查 DNS / 防火墙 / 封锁；「可达但吞吐没测到」的源可能比谁都快（它只是把候选文件 403 了）。两者都不给速度数字。
3. **以 apt 的身份去问**：`-A 'Ubuntu APT-HTTP/1.3'`，否则部分镜像站 403；强制 `--http1.1`，h2 实测差一个数量级。
4. **时间预算决定名次**，文件大小不参与（否则「谁的文件小谁快」）；只有 404 才换候选文件，403 / 超时换文件也是白搭。
5. **撞预算不是失败**。`--max-time` 到点会让 curl 退 28，但 `-w` 统计照样输出 —— 用已下到的字节算速度，标 `truncated=1`。把 28 当失败，50MB 的 Contents 在 6 秒预算下永远测不出吞吐，所有源都「没测到」，名次全空。
6. **名次只对这一次成立**：相邻名次差小于 20% 不必当真；网络环境一变就重测。

## 7. 指针

- 症状 → 原因 → 处置（CRLF、验签失败、22.04 一行式、403/UA、apt 锁、代理、`write_mismatch`、回退）：[references/pitfalls.md](references/pitfalls.md)
- 接进网页面板的接口形状、六道门、被否方案：[references/integration.md](references/integration.md)
- 真实落地实例（Go 能力包 + 嵌脚本 + 界面第 10 页）：`pass-up.ops` 的 `internal/apt/`、`deploy/apt/`、`docs/apt.md`
