> 状态：**现行**（2026-11-24；配合 `ubuntu-apt-mirror` 的脚本使用，按症状查）

# 换源故障速查

先看 `switch.sh` 的 `result=` 与 `detail=`，再对号入座。任何一次失败都先确认：**远端有没有被改**（看 `rolled_back` 与 `backup`）。

| 症状 | 原因 | 处置 |
| :--- | :--- | :--- |
| 远端报 `$'\r': command not found` 或 `set: -: invalid option` | 脚本是 CRLF（Windows 编辑过） | 转 LF（`dos2unix` 或编辑器设置），`.gitattributes` 钉 `*.sh text eol=lf` |
| `result=verify_failed`，detail 说 InRelease 取不到 | 镜像没镜像该 suite / 目标机出不了网 / 代理断了 | 换 suite 或换源；先 `curl -I https://<base>/dists/<suite>/InRelease` 定位 |
| `result=verify_failed`，detail 说验签失败 | `Signed-By` 的 keyring 与镜像签名不配套（keyring 被换过 / 镜像用了另一套 key） | 用 `/usr/share/keyrings/ubuntu-archive-keyring.gpg`；确认镜像真身，别硬上 |
| `result=verify_failed`，detail 说缺 component | 该镜像没镜像 `universe` 等 | 换有全量镜像的站，或在 `APT_COMPONENTS` 里去掉这个 component（要人确认） |
| `result=unsupported_layout` | 只有一行式 `/etc/apt/sources.list`（Ubuntu ≤22.04） | 不硬改：备份后手工改该文件，`Suites` 写本机代号 |
| `result=no_source_file` | 目标机没有 `ubuntu.sources`（精简系统 / Debian 路径不同） | 先确认发行版；Debian 用 `APT_SOURCES` 指向 `debian.sources` |
| `result=bad_next` | 没给 `APT_NEXT_FILE` / `APT_NEXT_B64`，或文件读不到、b64 解不开 | 用 `snippet.sh` 生成文本再传；别手拼 |
| 换完 `apt install` 报 404 / `Unable to locate` | 代号写错（拿 noble 去写 jammy）、或镜像缺该 suite | `cp -a <文件>.aptmirror.bak <文件>` 立即回退，再核对 `/etc/os-release` |
| 换完 apt 报签名错误 | 写进去的 `Signed-By` 指错 / keyring 不存在 | 同上回退；`gpgv --keyring … InRelease` 当场验一遍 |
| 测速里某个源 `reachable=0, http=403` | 用默认 UA 被镜像站拒 | 脚本已带 apt UA；自写脚本要照抄 `-A 'Ubuntu APT-HTTP/1.3'` |
| 所有源都不可达 | DNS / 防火墙 / 必须走代理 / TLS 被拦 | 目标机上 `curl -v https://mirrors.aliyun.com/ubuntu/dists/<suite>/Release`；需要代理就设 `HTTPS_PROXY` |
| 所有源都可达但 `kbps` 极低（同量级） | 目标机出口被限速，或测速被并发干扰 | 确认是串行；换时段重测；别据此选源 |
| 所有源都 `throughput_ok=0`，`throughput_error` 说 curl 28 超时 | 把「撞上 `--max-time`」当失败（旧口径的坑） | curl 退 28 但 `-w` 照样输出统计，已下字节就是有效测量；按 `bytes/time` 算 kbps 并标 `truncated=1`。否则 50MB 的 Contents 永远测不出吞吐 |
| 测速跑很久 | 不可达源 × 轮次 × 超时 | 调小 `APT_ROUNDS`（1）与 `APT_BUDGET`（3），或先删掉明显不可达的候选 |
| `apt-get update` 报 `/var/lib/dpkg/lock` 被占 | `apt-daily` / `unattended-upgrades` / 别的 apt 在跑 | 等它结束；`fuser /var/lib/dpkg/lock-frontend` 查持有者，**别直接 kill** |
| 换完源 `apt update` 正常但装的还是旧版本 | 索引没刷新（本流程刻意不跑 update） | 自己挑时间 `sudo apt-get update` |
| `apply` 后 `result=write_mismatch` | 磁盘写满 / 只读挂载 / 权限异常 | 看 `backup`，`cp -a` 回退；检查 `df` 与挂载 |
| `result=backup_failed` | 备份目录不可写 / 磁盘满 | 什么都没写，先修磁盘 |
| 没有 `curl` / `gpgv` | 精简镜像 | 如实告知用户（不代装）；由人决定是否 `apt-get install curl gpgv` |
| 非 root 跑 `apply` 报权限 | 未提权 | `sudo sh`；先把脚本 scp 到 `/tmp` 再 sudo，别 `sudo sh -s` |

## 三条通用原则

1. **先回退再分析**：`<文件>.aptmirror.bak` 永远是「这次写之前」的原文，`cp -a` 回去就能让 apt 恢复可用。
2. **不要在 apt 正忙时换源**：写入本身不碰锁，但紧接着的 `apt-get update` 会。
3. **不要为了「跑通」放宽验证**：跳过 `gpgv` 换来的「成功」会在下次 `apt install` 变成事故。
