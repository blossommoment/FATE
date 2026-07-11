# Fate 国内免费部署

推荐使用腾讯云 EdgeOne Makers（原 EdgeOne Pages）。它提供长期免费套餐，支持 Next.js 全栈项目、云函数和服务端环境变量，适合当前 Fate MVP。

## 部署步骤

1. 把项目推送到 GitHub、GitLab 或 Gitee 仓库。
2. 登录 EdgeOne Makers，选择“从 Git 导入项目”。
3. 选择 Fate 仓库，框架选择 Next.js；构建命令使用 `npm run build`。
4. 在项目设置的环境变量中添加：

   ```text
   DEEPSEEK_API_KEY=你的有效密钥
   DEEPSEEK_BASE_URL=https://api.siliconflow.cn/v1
   DEEPSEEK_MODEL=deepseek-ai/DeepSeek-V3.2
   ```

5. 重新部署，使用平台分配的默认域名测试排盘、匹配与助手接口。

## 付费与兑换码

站内购买流程是：用户在 FATE 点击解锁，跳转至支付服务商的托管 Checkout，服务端收到并验签支付回调后，再给当前报告写入浏览器权益。用户不需要去闲鱼、抖音或其他外部平台购买普通报告；兑换码只用于礼品、活动和人工售后。

上线支付前，在平台环境变量中补齐 [`.env.example`](../.env.example) 的下列配置：

```text
REPORT_STATE_SECRET=随机长密钥
ENTITLEMENT_SECRET=随机长密钥
KV_REST_API_URL=你的 Vercel KV / Upstash REST 地址
KV_REST_API_TOKEN=你的 Vercel KV / Upstash REST Token
STRIPE_SECRET_KEY=支付服务商密钥
STRIPE_WEBHOOK_SECRET=支付回调签名密钥
STRIPE_PRICE_PERSONAL_FULL=个人全册价格 ID
STRIPE_PRICE_DUO_FULL=双人全册价格 ID
```

然后在支付服务商后台把 Webhook 指向：

```text
https://你的域名/api/checkout/webhook
```

代码兑换必须使用持久化 KV，不能使用 Vercel 函数文件系统。生成并登记活动码：

```powershell
node scripts/mint-unlock-codes.mjs 20 duo_full
node scripts/mint-unlock-codes.mjs 20 personal_full
```

脚本只显示一次明文码；数据库只保存 `code hash`、商品、已核销的报告指纹和时间。支付订单同样只保存支付服务商订单号、商品、报告指纹和支付时间，不保存姓名、生辰、报告正文或 PDF。浏览器不再写入排盘历史或报告缓存，并会在用户下次打开时清理旧版本留下的本地缓存；旧 Agent 报告仅在进程内暂存（默认 10 分钟）后丢弃。支付服务商自身仍会按其合规要求保留交易记录，因此对外隐私说明不能写成“完全不保留任何数据”。

不要用个人收款码、他人的商户号或未经核实的“中转支付接口”来绕过商户审核。若要向中国大陆用户提供支付宝/微信支付，应先确认你的主体、业务类目、域名和支付服务商的准入条件；海外托管本身不等于免除这些要求。

## 国内访问说明

- 免费默认域名可用于 MVP 测试。
- 若要绑定自己的域名并选择“中国大陆可用区”或“全球可用区（含中国大陆）”，域名必须先完成 ICP 备案。
- 未备案域名只能选择“不含中国大陆”的加速区，国内通常仍可能访问，但稳定性和速度不等同于大陆节点。

## 密钥安全

- 只在平台的服务端环境变量中配置密钥。
- 不要把 `.env.local` 提交到 Git；当前项目已在 `.gitignore` 中忽略它。
- 上线前建议新建一枚专用于网站的 API Key，并设置用量告警或限额。
- `REPORT_STATE_SECRET`、`ENTITLEMENT_SECRET`、KV Token、支付密钥都必须只放服务端环境变量，不能放 `NEXT_PUBLIC_*` 或提交到仓库。
