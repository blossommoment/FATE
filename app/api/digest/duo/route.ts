import { NextResponse } from "next/server";
import { analyzeBirth, analyzeRelationship, validateBirth } from "@/lib/fate";
import { buildDuoFacts, buildDuoFallback, buildDuoPrompt, validateDuoPayload } from "@/lib/duo";
import type { BirthInput } from "@/lib/types";

export const maxDuration = 150; // SiliconFlow DeepSeek-V3.2 实测单次 ~50-80s

// 双人深度解读报告生成端点（REQ_DUO_REPORT B2）
// 契约：AI 只组织语言，标签与事实全部来自规则引擎；校验不过重试一次，再不过走确定性兜底。

export async function POST(request: Request) {
  let body: { a: BirthInput; b: BirthInput; relationType?: string };
  try {
    body = await request.json() as { a: BirthInput; b: BirthInput; relationType?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body?.a || !body?.b) return NextResponse.json({ error: "需要两个人的出生信息。" }, { status: 400 });
  const errorA = validateBirth(body.a);
  if (errorA) return NextResponse.json({ error: errorA }, { status: 400 });
  const errorB = validateBirth(body.b);
  if (errorB) return NextResponse.json({ error: errorB }, { status: 400 });

  const profileA = analyzeBirth(body.a);
  const profileB = analyzeBirth(body.b);
  const relationType = body.relationType ?? "恋爱";
  const analysis = analyzeRelationship(profileA, profileB, relationType);
  const facts = buildDuoFacts(profileA, profileB, analysis);
  const fallback = buildDuoFallback(facts);
  const pairId = `${profileA.id}-${profileB.id}-${relationType}`;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return NextResponse.json({ source: "fallback", pairId, digest: fallback, facts });

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
      const valid = validateDuoPayload(parsed, facts.verdict);
      if (valid) return NextResponse.json({ source: "ai", pairId, digest: valid, facts });
    } catch { /* 内容问题（截断/格式）：带纠正提示重试一次 */ }
  }
  return NextResponse.json({ source: "fallback", pairId, digest: fallback, facts });
}
