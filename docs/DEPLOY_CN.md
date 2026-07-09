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

## 国内访问说明

- 免费默认域名可用于 MVP 测试。
- 若要绑定自己的域名并选择“中国大陆可用区”或“全球可用区（含中国大陆）”，域名必须先完成 ICP 备案。
- 未备案域名只能选择“不含中国大陆”的加速区，国内通常仍可能访问，但稳定性和速度不等同于大陆节点。

## 密钥安全

- 只在平台的服务端环境变量中配置密钥。
- 不要把 `.env.local` 提交到 Git；当前项目已在 `.gitignore` 中忽略它。
- 上线前建议新建一枚专用于网站的 API Key，并设置用量告警或限额。
