#!/usr/bin/env bash
# FATE MCP 套壳部署 —— 在服务器上执行。幂等。
# 前置:FATE app 已在 :3000 跑;nginx + Let's Encrypt(47-74-45-38.nip.io)已配。
set -euo pipefail

MCP_DIR="/opt/fate/mcp"
APP_PUBLIC="/opt/fate/app/public/reports"

echo "==> [0/6] 清掉可能卡死机器的僵尸装包"
pkill -f "npm install" 2>/dev/null || true
pkill -f "pip install" 2>/dev/null || true

echo "==> [1/6] 加大 swap 到 6G(防 pip 装包 OOM)"
if [ "$(free -m | awk '/Swap:/{print $2}')" -lt 5000 ]; then
  swapoff /swapfile 2>/dev/null || true
  rm -f /swapfile
  fallocate -l 6G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=6144
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h | grep -i swap

echo "==> [2/6] python venv + fastmcp(轻量,比 web3 包好装)"
mkdir -p "$MCP_DIR"
cd "$MCP_DIR"
[ -d venv ] || python3 -m venv venv
./venv/bin/pip install --no-cache-dir --upgrade pip >/dev/null 2>&1 || true
./venv/bin/pip install --no-cache-dir fastmcp httpx 2>&1 | tail -3
./venv/bin/python -c "import fastmcp, httpx; print('fastmcp', fastmcp.__version__, 'ok')"

echo "==> [3/6] 报告输出目录(Next.js public/ 下,可被 https 直接下载)"
mkdir -p "$APP_PUBLIC"

echo "==> [4/6] pm2 守护 MCP 服务(:8100)"
cd "$MCP_DIR"
pm2 delete fate-mcp >/dev/null 2>&1 || true
# 密钥必须由环境提供(与 app/.env 的 AGENT_API_KEY 一致),脚本不内置——防误提交进仓库
: "${FATE_API_KEY:?请先 export FATE_API_KEY=<app/.env 里的 AGENT_API_KEY>}"
FATE_API_KEY="$FATE_API_KEY" \
  pm2 start "./venv/bin/python $MCP_DIR/mcp_server.py" --name fate-mcp --update-env
pm2 save

echo "==> [5/6] nginx 加 /mcp 路由(走现有 443/HTTPS)"
CONF=/etc/nginx/sites-available/fate
if ! grep -q "location /mcp" "$CONF"; then
  # 在第一个 location / 之前插入 /mcp 块(带 SSE 长连接所需设置)
  python3 - "$CONF" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
block = '''    location /mcp {
        proxy_pass http://127.0.0.1:8100/mcp;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        chunked_transfer_encoding on;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

'''
# 插到 server_name 之后、第一个 location 之前(仅 443 server 块;80 会被 certbot 跳转)
idx = s.find("location /")
if "location /mcp" not in s and idx != -1:
    s = s[:idx] + block + s[idx:]
    open(p, "w", encoding="utf-8").write(s)
    print("inserted /mcp block")
else:
    print("skip")
PY
fi
nginx -t && systemctl reload nginx && echo "nginx /mcp 已生效"

echo "==> [6/6] 本机自测 MCP initialize"
sleep 3
curl -s -m 15 -X POST http://127.0.0.1:8100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"selftest","version":"1"}}}' \
  | head -c 500
echo ""
echo "======================================================"
echo " MCP 端点(对外): https://47-74-45-38.nip.io/mcp"
echo " 用 MCP Inspector 或 OKX x402-check 测；再更新 OKX 端点重提交。"
echo "======================================================"
