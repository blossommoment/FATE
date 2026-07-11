# FATE 自有服务器部署

这份文档用于把 FATE 部署到你自己的 Linux 服务器，不依赖 Vercel。推荐 Ubuntu 22.04/24.04，至少 2C/2G；如果要在服务器上构建，建议 2C/4G 或加 swap。

## 方案 A：Docker Compose

1. 安装 Docker：

```bash
curl -fsSL https://get.docker.com | bash
systemctl enable --now docker
```

2. 上传或拉取项目代码到服务器，例如：

```bash
mkdir -p /opt/fate
cd /opt/fate
git clone https://github.com/blossommoment/FATE.git app
cd app
git checkout codex/payment-paywall
```

3. 创建生产环境变量：

```bash
cp .env.example .env.production
nano .env.production
```

至少填写：

```text
REPORT_STATE_SECRET=换成32位以上随机密钥
ENTITLEMENT_SECRET=换成另一个32位以上随机密钥
NEXT_PUBLIC_SITE_URL=https://你的域名
DEEPSEEK_API_KEY=你的AI密钥
KV_REST_API_URL=你的Upstash或Redis REST地址
KV_REST_API_TOKEN=你的Upstash或Redis REST Token
```

如果暂时不接支付，`STRIPE_*` 可以先留空；站内购买按钮会提示支付未配置。兑换码仍需要 `KV_*`。

4. 构建并启动：

```bash
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:3000/api/health
```

应用只监听服务器本机 `127.0.0.1:3000`，公网入口交给 Nginx。

## Nginx 反代和 HTTPS

1. 安装 Nginx 和证书工具：

```bash
apt update
apt install -y nginx certbot python3-certbot-nginx
```

2. 复制配置：

```bash
cp deploy/nginx-fate.conf /etc/nginx/sites-available/fate
sed -i 's/fate.example.com/你的域名/g' /etc/nginx/sites-available/fate
ln -s /etc/nginx/sites-available/fate /etc/nginx/sites-enabled/fate
nginx -t
systemctl reload nginx
```

3. 开 HTTPS：

```bash
certbot --nginx -d 你的域名
```

云厂商安全组只需要放行 `80`、`443` 和 SSH 端口；不建议把 `3000` 直接暴露到公网。

## 方案 B：不用 Docker，PM2 运行

```bash
apt update
apt install -y curl ca-certificates fontconfig fonts-noto-cjk fonts-wqy-zenhei
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

cd /opt/fate/app
npm ci
npm run build
cp .env.example .env.production
nano .env.production
set -a
. ./.env.production
set +a
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

PM2 方案也建议放在 Nginx 后面，Nginx 配置同上。

## 支付和兑换码

站内购买不应该让用户去闲鱼、抖音买码。正常路径是：用户在 FATE 点击购买，跳到合规支付服务商的托管收银台，支付成功后回到 FATE 自动解锁。兑换码只适合礼品码、活动码和人工售后。

你不备案、用海外服务器时，不能用灰色中转接口、个人收款码或他人商户号绕过审核。更稳的路线是选择能合法服务你主体和业务类目的支付服务商，或者使用 Merchant of Record。支付服务商会依法保留交易记录；FATE 这边只保存订单号、商品、报告指纹和支付时间，不保存出生信息、报告正文或 PDF。

支付回调地址配置为：

```text
https://你的域名/api/checkout/webhook
```

## 常用命令

```bash
docker compose logs -f fate
docker compose restart fate
docker compose pull
docker compose up -d --build
curl https://你的域名/api/health
```

如果页面打不开，优先查四件事：域名 DNS 是否指向服务器、云安全组是否放行 `80/443`、Nginx `nginx -t` 是否通过、`docker compose ps` 里 fate 是否 healthy。
