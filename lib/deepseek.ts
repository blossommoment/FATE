import { explainQuestion } from "./assistant";

export async function askDeepSeek(
  question: string,
  contextTitle: string,
  contextSummary: string,
  evidence: string[],
  detailed = false,
) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const isSiliconFlow = baseUrl.includes("siliconflow.cn");
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
