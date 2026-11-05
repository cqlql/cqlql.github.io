#!/bin/bash

# ==========================================
# 备份体系部署自检脚本（一次性体检）
# 作用: 部署完成后一键核对「配置是否齐全、参数是否有效、路径是否可写、
#       依赖命令是否安装、SSH 是否连通、定时任务是否安装、是否成功备份过」
# 用法: bash deploy/backup/preflight_check.sh [pg|minio|all]
# 退出码: 0=全部通过, 1=存在错误(ERROR), 2=存在警告(WARN)
# 说明: 纯只读检查，不执行备份/恢复，不会修改任何数据
#
# 结构: 本脚本仅做「调度 + 汇总」；各备份对象的体检逻辑拆分为独立子模块
#       （preflight_pg.sh / preflight_minio.sh），公共工具函数在 lib/common.sh。
#       新增备份对象时，只需新增 preflight_xxx.sh 并在下方 dispatch 里注册。
# ==========================================

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载公共工具库（颜色、日志函数、状态计数器、检查工具）
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/common.sh"

# 加载各备份对象体检模块
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/preflight_pg.sh"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/preflight_minio.sh"

# ---------- 入口：按需调度各体检模块 ----------
# 新增备份对象时，在此处追加 case 分支与 all 调用即可
dispatch() {
    case "${1:-}" in
        pg)     check_pg ;;
        minio)  check_minio ;;
        all)    check_pg; check_minio ;;
    esac
}

case "${1:-all}" in
    pg|minio|all) dispatch "$1"; summary ;;
    *)      echo "用法: $0 [pg|minio|all]"; exit 1 ;;
esac
