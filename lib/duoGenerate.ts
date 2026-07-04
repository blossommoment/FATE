import { buildDuoFallback, buildDuoPrompt, validateDuoPayload, type DuoDigestPayload, type DuoFacts } from "./duo";

// 成册五章生成（/api/digest/duo 与 agent 报告管线共用）。
// 契约：AI 只组织语言；校验不过重试一次→确定性兜底；网络/超时如实抛错，不拿兜底冒充（用户拍板）。

export class UpstreamTimeoutError extends Error {
  constructor() { super("上游生成超时，请稍后重试。"); this.name = "UpstreamTimeoutError"; }
}

export async function generateDuoDigest(facts: DuoFacts): Promise<{ source: "ai" | "fallback"; digest: DuoDigestPayload }> {
  const fallback = buildDuoFallback(facts);
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { source: "fallback", digest: fallback };

  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const isSiliconFlow = baseUrl.includes("siliconflow.cn");
  const { system, user } = buildDuoPrompt(facts);

  for (let attempt = 0; attempt < 2; attempt++) {
    let content = "";
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          ...(isSiliconFlow ? { enable_thinking: false } : { thinking: { type: "disabled" } }),
          temperature: 0.45,
          max_tokens: 2800, // 五章成册全文，给足余量防 JSON 截断
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: attempt === 0 ? user : `${user}\n\n（上一次输出未通过校验：五章齐全、正文禁数字禁命理术语、评述禁对话引语（不写任何人说的原话）、正文直接开场不写章节名、headline 不得取自判词原文、字数达标、以名字互称。请严格重来。）`,
            },
          ],
        }),
        signal: AbortSignal.timeout(attempt === 0 ? 120000 : 90000),
      });
      if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      content = data.choices?.[0]?.message?.content?.trim() ?? "";
    } catch {
      throw new UpstreamTimeoutError();
    }
    try {
      const parsed = JSON.parse(content.replace(/^```json\s*|```$/g, ""));
      const valid = validateDuoPayload(parsed, facts.verdict);
      if (valid) return { source: "ai", digest: valid };
    } catch { /* 内容问题（截断/格式）：带纠正提示重试一次 */ }
  }
  return { source: "fallback", digest: fallback };
}

// 小型翻译调用：只翻执行摘要与目录级文本（Hermes 双语需求），失败如实抛错
export async function translateToEnglish(chineseText: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new UpstreamTimeoutError();
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const isSiliconFlow = baseUrl.includes("siliconflow.cn");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          ...(isSiliconFlow ? { enable_thinking: false } : { thinking: { type: "disabled" } }),
          temperature: 0.2,
          max_tokens: 1600,
          messages: [
            { role: "system", content: "You are a professional translator. Translate the given Chinese relationship-report summary into natural, fluent English. Keep the tone warm and editorial. Do not add or remove information. Do not translate personal names (keep them as-is in pinyin or original form). Output the translation only." },
            { role: "user", content: chineseText },
          ],
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch { /* 重试一次 */ }
  }
  throw new UpstreamTimeoutError();
}
