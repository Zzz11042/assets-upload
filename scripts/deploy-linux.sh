#!/usr/bin/env bash
# asset-dashboard 一键部署脚本（Linux / macOS）
# 用法:
#   ./scripts/deploy-linux.sh
#   PORT=8080 AGNES_API_KEY=sk-xxx ./scripts/deploy-linux.sh
# 行为: 自动 clone（若不在仓库内）→ 进入 asset-dashboard → node server.mjs
set -euo pipefail

REPO="https://github.com/Zzz11042/assets-upload.git"
REPO_NAME="assets-upload"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_DIR="$ROOT/asset-dashboard"

# 1. 检测 node
if ! command -v node >/dev/null 2>&1; then
  echo "✗ 未检测到 Node.js，请先安装（Node ≥ 18）"
  echo "  Ubuntu/Debian:  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  echo "  或:             brew install node"
  exit 1
fi
NODE_VER=$(node -v | sed 's/^v//')
echo "Node 版本: v$NODE_VER"
if [ "$(echo "$NODE_VER" | cut -d. -f1)" -lt 18 ]; then
  echo "✗ Node 需 ≥ 18（当前 v$NODE_VER），请升级"
  exit 1
fi

# 2. 若不在仓库目录则 clone
if [ ! -d "$DB_DIR" ]; then
  echo "未检测到本地仓库，开始 clone → $ROOT"
  if [ "$ROOT" = "$HOME" ] || [ -n "$(ls -A "$ROOT" 2>/dev/null)" ]; then
    echo "✗ 当前目录非空且非仓库，请手动执行: git clone $REPO && cd $REPO && $SCRIPT_DIR/deploy-linux.sh"
    exit 1
  fi
  git clone "$REPO" "$ROOT"
fi
[ -d "$DB_DIR" ] || { echo "✗ 未找到 asset-dashboard/，请确认仓库结构"; exit 1; }

# 3. 启动
cd "$DB_DIR"
PORT="${PORT:-7800}"
echo "→ 启动 asset-dashboard（端口 $PORT）"
node server.mjs
echo "访问: http://127.0.0.1:$PORT"
