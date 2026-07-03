import { NextResponse } from "next/server";
import { analyzeBirth, validateBirth } from "@/lib/fate";
import { buildDigestPrompt, buildFallbackDigest, buildPersonalFacts, validateDigestPayload } from "@/lib/digest";
import type { BirthInput } from "@/lib/types";

// 「AI 读你」生成端点（REQ_AI_DIGEST A2）
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
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          ...(isSiliconFlow ? { enable_thinking: false } : { thinking: { type: "disabled" } }),
          temperature: 0.4,
          max_tokens: 1200,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: attempt === 0 ? user : `${user}\n\n（上一次输出未通过校验：标签只能用清单里的、正文禁用命理术语、字段齐全。请严格重来。）`,
            },
          ],
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content?.trim() ?? "";
      const parsed = JSON.parse(content.replace(/^```json\s*|```$/g, ""));
      const valid = validateDigestPayload(parsed, facts);
      if (valid) return NextResponse.json({ source: "ai", profileId: profile.id, digest: valid, facts });
    } catch {
      // 网络/超时/解析失败：进入下一次尝试或落兜底
    }
  }
  return NextResponse.json({ source: "fallback", profileId: profile.id, digest: fallback, facts });
}
