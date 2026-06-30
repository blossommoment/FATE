import { explainQuestion } from "./assistant";

export async function askDeepSeek(
  question: string,
  contextTitle: string,
  contextSummary: string,
  evidence: string[],
) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return `DeepSeek 尚未配置，当前使用本地规则回答。\n\n${explainQuestion(question, contextTitle, contextSummary, evidence)}`;
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        thinking: { type: "disabled" },
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content: `你是 Fate 的关系分析助手。只解释已由规则引擎计算出的结果，不重新算命，不新增吉凶预测。
当前卡片：${contextTitle}
结论：${contextSummary}
可引用依据：${evidence.join("；")}
回答要求：中文、口语化、具体、120字以内；先回答问题，再指出一条可在现实中验证的方式。`,
          },
          { role: "user", content: question },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || "DeepSeek 暂时没有返回内容。";
  } catch {
    return `DeepSeek 暂时不可用，已切换本地规则回答。\n\n${explainQuestion(question, contextTitle, contextSummary, evidence)}`;
  }
}
