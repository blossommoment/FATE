import { explainQuestion } from "./assistant";

// DeepSeek 接入配置统一出口。FATE_DEEPSEEK_API_KEY 优先于 DEEPSEEK_API_KEY：
// 防止机器全局同名变量（如本机 Hermes 栈的 DeepSeek 官方 key）顶掉 .env.local 里的项目配置——
// Next.js 的规则是进程环境变量优先于 .env 文件，同名即被劫持且无任何报错。
export function deepseekConfig() {
  const apiKey = process.env.FATE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  return { apiKey, baseUrl, model, isSiliconFlow: baseUrl.includes("siliconflow.cn") };
}

export async function askDeepSeek(
  question: string,
  contextTitle: string,
  contextSummary: string,
  evidence: string[],
  detailed = false,
) {
  const { apiKey, baseUrl, model, isSiliconFlow } = deepseekConfig();
  if (!apiKey) {
    return `DeepSeek 尚未配置，当前使用本地规则回答。\n\n${explainQuestion(question, contextTitle, contextSummary, evidence)}`;
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        ...(isSiliconFlow ? { enable_thinking: false } : { thinking: { type: "disabled" } }),
        max_tokens: detailed ? 1000 : 600,
        messages: [
          {
            role: "system",
            content: `你是 Fate 的关系分析助手。只解释已由规则引擎计算出的结果，不重新算命，不新增吉凶预测。
当前卡片：${contextTitle}
结论：${contextSummary}
可引用依据：${evidence.join("；")}
回答要求：${detailed
    ? "中文、口语化、具体，可以分点；先给一句总评，再给三条最重要的相处建议，每条建议里包含一句可以直接照着说的话术；引用依据里的数字增强说服力；380字以内。"
    : "中文、口语化、具体、120字以内；先回答问题，再指出一条可在现实中验证的方式。"}`,
          },
          { role: "user", content: question },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || "AI 这次没有返回内容——稍等几秒，重新点一次即可。";
  } catch {
    // 超时/网络失败：如实报错，不拿规则文冒充 AI 答案（用户拍板）
    return "AI 助手这次没能连上（上游超时）。你的问题没有丢——稍等几秒，重新点一次按钮就好。";
  }
}
