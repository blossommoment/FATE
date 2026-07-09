import { buildDuoFallback, buildDuoPrompt, validateDuoPayload, type DuoDigestPayload, type DuoFacts } from "./duo";
import { deepseekConfig } from "./deepseek";

// 成册五章生成（/api/digest/duo 与 agent 报告管线共用）。
// 契约：AI 只组织语言；校验不过重试一次→确定性兜底；网络/超时如实抛错，不拿兜底冒充（用户拍板）。

export class UpstreamTimeoutError extends Error {
  constructor() { super("上游生成超时，请稍后重试。"); this.name = "UpstreamTimeoutError"; }
}

export async function generateDuoDigest(facts: DuoFacts): Promise<{ source: "ai" | "fallback"; digest: DuoDigestPayload }> {
  const fallback = buildDuoFallback(facts);
  const { apiKey, baseUrl, model, isSiliconFlow } = deepseekConfig();
  if (!apiKey) return { source: "fallback", digest: fallback };
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

// 批量翻译：整份报告全内容双语（用户拍板「做全套」）。
// 韧性优先：分小块、限并发、每块多次重试；个别块最终失败也【不拖垮全局】——
// 该块对应段落留空英文（PDF 渲染器会跳过空英文，报告一定出得来）。返回与输入等长、保序。
export async function translateBatch(texts: string[]): Promise<string[]> {
  const out = new Array<string>(texts.length).fill("");
  if (!texts.length) return out;
  const { apiKey, baseUrl, model, isSiliconFlow } = deepseekConfig();
  if (!apiKey) return out; // 无 key：整份留中文，不抛错

  // 分块：≤1100 字或 ≤10 段一块（块更小→单块更快→超时概率更低）
  const chunks: { start: number; items: string[] }[] = [];
  let current: string[] = [];
  let currentLen = 0, start = 0;
  texts.forEach((text, index) => {
    if (current.length && (currentLen + text.length > 1100 || current.length >= 10)) {
      chunks.push({ start, items: current });
      current = []; currentLen = 0; start = index;
    }
    current.push(text);
    currentLen += text.length;
  });
  if (current.length) chunks.push({ start, items: current });

  const SYS = `You translate a Chinese relationship report into natural, warm, editorial English. Input is JSON {"s": [array of Chinese strings]}. Output strictly JSON {"t": [array of English translations]} with the SAME length and order. Keep personal names as-is. Do not add or omit information. Traditional-calendar terms: 婚姻宫=marriage palace, 日支=day branch, 驿马=travel star, 桃花=peach-blossom (charm) star, 喜用=favorable element, 忌神=unfavorable element, 大运=decade luck cycle, 流年=annual cycle, 十神=Ten Gods, 食伤=Output stars, 官杀=Authority stars, 印星=Resource stars, 财星=Wealth stars, 日主=Day Master.`;

  const translateChunk = async (items: string[]): Promise<string[] | null> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            ...(isSiliconFlow ? { enable_thinking: false } : { thinking: { type: "disabled" } }),
            temperature: 0.2, max_tokens: 2600, response_format: { type: "json_object" },
            messages: [{ role: "system", content: SYS }, { role: "user", content: JSON.stringify({ s: items }) }],
          }),
          signal: AbortSignal.timeout(70000),
        });
        if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
        const data = await response.json() as { choices?: { message?: { content?: string } }[] };
        const content = data.choices?.[0]?.message?.content?.trim() ?? "";
        const parsed = JSON.parse(content.replace(/^```json\s*|```$/g, "")) as { t?: string[] };
        if (Array.isArray(parsed.t) && parsed.t.length === items.length && parsed.t.every((e) => typeof e === "string" && e.length > 0)) return parsed.t;
      } catch { /* 重试 */ }
    }
    return null; // 该块放弃：对应段落留空英文
  };

  // 限并发 5：翻译是 I/O 密集，多开几路让整批墙钟≈最慢单块，而非串行累加
  const CONCURRENCY = 5;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, async () => {
    while (cursor < chunks.length) {
      const chunk = chunks[cursor++];
      const translated = await translateChunk(chunk.items);
      if (translated) translated.forEach((text, offset) => { out[chunk.start + offset] = text; });
    }
  });
  await Promise.all(workers);
  return out;
}

// 小型翻译调用：只翻执行摘要与目录级文本（Hermes 双语需求），失败如实抛错
export async function translateToEnglish(chineseText: string): Promise<string> {
  const { apiKey, baseUrl, model, isSiliconFlow } = deepseekConfig();
  if (!apiKey) throw new UpstreamTimeoutError();
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
