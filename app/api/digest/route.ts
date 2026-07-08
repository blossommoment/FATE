import { NextResponse } from "next/server";
import { analyzeBirth, validateBirth } from "@/lib/fate";
import { buildDigestPrompt, buildFallbackDigest, buildPersonalFacts, validateDigestPayload } from "@/lib/digest";
import type { BirthInput } from "@/lib/types";

export const maxDuration = 150; // SiliconFlow DeepSeek-V3.2 实测单次 ~50-80s

// 深度解读报告生成端点（REQ_AI_DIGEST）
// 契约：AI 只组织语言，事实与标签全部来自规则引擎；校验不过重试一次，再不过走确定性兜底。
// 缓存策略在客户端按 profile.id 落 localStorage（付费功能：点击触发，一次生成反复看）。

export async function POST(request: Request) {
  let birth: BirthInput;
  try {
    birth = await request.json() as BirthInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const error = validateBirth(birth);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const profile = analyzeBirth(birth);
  const facts = buildPersonalFacts(profile);
  const fallback = buildFallbackDigest(facts);

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return NextResponse.json({ source: "fallback", profileId: profile.id, digest: fallback, facts });

  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const isSiliconFlow = baseUrl.includes("siliconflow.cn");
  const { system, user } = buildDigestPrompt(facts);

  for (let attempt = 0; attempt < 2; attempt++) {
    let content = "";
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          ...(isSiliconFlow ? { enable_thinking: false } : { thinking: { type: "disabled" } }),
          temperature: 0.4,
          max_tokens: 3000, // 五章成册全文(2026-07-08 加性情章)，给足余量防 JSON 截断
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: attempt === 0 ? user : `${user}\n\n（上一次输出未通过校验：四章齐全、正文禁数字禁命理术语、字数达标。请严格重来。）`,
            },
          ],
        }),
        signal: AbortSignal.timeout(attempt === 0 ? 90000 : 60000),
      });
      if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      content = data.choices?.[0]?.message?.content?.trim() ?? "";
    } catch {
      break; // 网络/超时类失败：重试大概率同样失败，直接落兜底
    }
    try {
      const parsed = JSON.parse(content.replace(/^```json\s*|```$/g, ""));
      const valid = validateDigestPayload(parsed, facts);
      if (valid) return NextResponse.json({ source: "ai", profileId: profile.id, digest: valid, facts });
    } catch { /* 内容问题（截断/格式）：带纠正提示重试一次 */ }
  }
  return NextResponse.json({ source: "fallback", profileId: profile.id, digest: fallback, facts });
}
