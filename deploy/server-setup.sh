#!/usr/bin/env bash
# FATE 一键部署脚本 —— 在香港 Ubuntu 服务器上执行。
# 幂等：可重复运行。装 Node + 中文字体 + 构建 + pm2 守护 + 放行端口。
set -euo pipefail

APP_DIR="/opt/fate/app"
FONT_DIR="/opt/fate/fonts"
PORT="${PORT:-3000}"

echo "==> [0/6] 交换分区（低内存机器构建防 OOM）"
if [ ! -f /swapfile ]; then
  fallocate -l 3G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=3072
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h | grep -i swap

echo "==> [1/6] 系统依赖"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates ufw fontconfig

echo "==> [2/6] Node.js 20 LTS"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v && npm -v

echo "==> [3/6] 开源中文字体（思源黑体/宋体，单文件 OTF，pdfkit 友好）"
mkdir -p "$FONT_DIR"
dl() { # dl <url> <dest>
  [ -s "$2" ] && return 0
  curl -fsSL -m 180 -o "$2" "$1" || curl -fsSL -m 180 -o "$2" "$3"
}
# 黑体（正文）
dl "https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf" \
   "$FONT_DIR/NotoSansSC-Regular.otf" \
   "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf"
# 宋体（标题/楷体位替代，衬线更有质感）
dl "https://github.com/notofonts/noto-cjk/raw/main/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Regular.otf" \
   "$FONT_DIR/NotoSerifSC-Regular.otf" \
   "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Regular.otf"
# 系统级兜底字体（万一上面拉不到，代码候选路径里也含这些 apt 字体）
apt-get install -y fonts-noto-cjk fonts-wqy-zenhei || true
ls -la "$FONT_DIR"

echo "==> [4/6] 安装依赖 + 构建"
cd "$APP_DIR"
npm ci || npm install
npm run build

echo "==> [5/6] pm2 守护（开机自启 + 崩溃自动重启）"
npm install -g pm2 >/dev/null 2>&1 || true
pm2 delete fate >/dev/null 2>&1 || true
PORT="$PORT" pm2 start "npm run start" --name fate --update-env
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo "==> [6/6] 防火墙放行 $PORT"
ufw allow "$PORT"/tcp || true
ufw allow OpenSSH || true
yes | ufw enable || true

echo ""
echo "===================================================="
echo " 部署完成。本机自测："
echo "   curl -s http://127.0.0.1:$PORT/api/health || echo 'no health route'"
echo " 外部访问： http://<服务器公网IP>:$PORT"
echo " ！！还需在云控制台【安全组/防火墙】放行 $PORT 端口，否则外网连不进"
echo "===================================================="
