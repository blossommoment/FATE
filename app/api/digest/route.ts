import { NextResponse } from "next/server";
import { analyzeBirth, validateBirth } from "@/lib/fate";
import { buildDigestPrompt, buildPersonalFacts, validateDigestPayload, type DigestPayload } from "@/lib/digest";
import { deepseekConfig } from "@/lib/deepseek";
import { readDigestCache, writeDigestCache } from "@/lib/digestStore";
import { tokenValid } from "@/lib/unlock";
import type { BirthInput } from "@/lib/types";

export const maxDuration = 150; // SiliconFlow DeepSeek-V3.2 实测单次 ~50-80s

// 深度解读报告生成端点（REQ_AI_DIGEST）
// 契约：AI 只组织语言，事实与标签全部来自规则引擎；校验不过或网络失败均重试一次，
// 两轮全败则如实报错（2026-07-09 用户拍板：不要兜底文冒充 AI 评述），前端显示失败态可重试。
// 缓存策略在客户端按 profile.id 落 localStorage（付费功能：点击触发，一次生成反复看）。

// 付费墙（2026-07-09 用户拍板，同日收紧：成册免费只看目录）：五章全锁——未解锁响应里正文只给开头
// 吊胃口、建议不下发（防 DOM 扒全文）；带有效 unlockToken 则全文。评述按 profileId 落服务端缓存，
// 解锁后二次请求命中缓存秒出，不重复烧 AI。
const LOCKED_KEYS = ["nature", "love", "career", "social", "season", "structure"] as const;
const lockPages = (digest: DigestPayload): DigestPayload => ({
  headline: digest.headline,
  pages: {
    ...digest.pages,
    ...Object.fromEntries(LOCKED_KEYS.map((key) => [key, {
      essay: `${digest.pages[key].essay.slice(0, 42)}……`,
      advice: "解锁全册后可见。",
    }])),
  } as DigestPayload["pages"],
});

export async function POST(request: Request) {
  let birth: BirthInput, unlockToken: unknown;
  try {
    const raw = await request.json() as BirthInput & { unlockToken?: string };
    ({ unlockToken, ...birth } = raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const error = validateBirth(birth);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const profile = analyzeBirth(birth);
  const facts = buildPersonalFacts(profile);
  const unlocked = tokenValid(profile.id, unlockToken);
  const respond = (digest: DigestPayload) => NextResponse.json({
    source: "ai", profileId: profile.id, unlocked,
    digest: unlocked ? digest : lockPages(digest), facts,
  });

  const cached = readDigestCache(profile.id);
  if (cached) return respond(cached);

  const { apiKey, baseUrl, model, isSiliconFlow } = deepseekConfig();
  if (!apiKey) return NextResponse.json({ error: "服务端未配置 AI 服务，报告暂时无法生成。" }, { status: 503 });

  const { system, user } = buildDigestPrompt(facts);

  let lastError = "上游无响应";
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
          max_tokens: 3600, // 六章成册全文(2026-07-09 加结构流年章)，给足余量防 JSON 截断
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: attempt === 0 ? user : `${user}\n\n（上一次输出未通过校验：六章齐全、正文禁数字禁命理术语（时运/结构章可写年份）、字数达标。请严格重来。）`,
            },
          ],
        }),
        signal: AbortSignal.timeout(attempt === 0 ? 90000 : 60000),
      });
      if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      content = data.choices?.[0]?.message?.content?.trim() ?? "";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      continue; // 网络/超时类失败同样重试，不再静默降级
    }
    try {
      const parsed = JSON.parse(content.replace(/^```json\s*|```$/g, ""));
      const valid = validateDigestPayload(parsed, facts);
      if (valid) { writeDigestCache(profile.id, valid); return respond(valid); }
      lastError = "AI 输出未通过校验";
    } catch { lastError = "AI 输出不是完整 JSON"; /* 内容问题（截断/格式）：带纠正提示重试一次 */ }
  }
  return NextResponse.json({ error: `AI 评述生成失败（${lastError}），请稍后重试。` }, { status: 502 });
}
