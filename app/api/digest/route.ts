import { NextResponse } from "next/server";
import { analyzeBirth, validateBirth } from "@/lib/fate";
import { buildDigestPrompt, buildPersonalFacts, validateDigestPayload, type DigestPayload } from "@/lib/digest";
import { deepseekConfig } from "@/lib/deepseek";
import { hasEntitlement, personalSubject } from "@/lib/entitlements";
import { openReportState } from "@/lib/reportState";
import { cookies } from "next/headers";

export const maxDuration = 150; // SiliconFlow DeepSeek-V3.2 实测单次 ~50-80s

// 深度解读报告生成端点（REQ_AI_DIGEST）
// 契约：AI 只组织语言，事实与标签全部来自规则引擎；校验不过或网络失败均重试一次，
// 两轮全败则如实报错（2026-07-09 用户拍板：不要兜底文冒充 AI 评述），前端显示失败态可重试。
// 完整评述只留在用户的浏览器；服务端每次按已购权益即时生成，不落盘缓存。

export async function POST(request: Request) {
  let body: { state?: string };
  try {
    body = await request.json() as { state?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const reportState = typeof body.state === "string" ? openReportState(body.state) : null;
  if (!reportState) return NextResponse.json({ error: "报告状态已过期，请重新起盘。" }, { status: 400 });
  const birth = reportState.birth;
  const error = validateBirth(birth);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const profile = analyzeBirth(birth);
  const facts = buildPersonalFacts(profile);
  let subject: string;
  try {
    subject = personalSubject(birth);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法校验报告权益。" }, { status: 503 });
  }
  if (!hasEntitlement(await cookies(), "personal_full", subject)) {
    return NextResponse.json({ error: "个人 AI 成册为已购权益，请先完成支付或兑换。" }, { status: 402 });
  }
  const respond = (digest: DigestPayload) => NextResponse.json({ source: "ai", profileId: profile.id, unlocked: true, digest, facts });

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
      if (valid) return respond(valid);
      lastError = "AI 输出未通过校验";
    } catch { lastError = "AI 输出不是完整 JSON"; /* 内容问题（截断/格式）：带纠正提示重试一次 */ }
  }
  return NextResponse.json({ error: `AI 评述生成失败（${lastError}），请稍后重试。` }, { status: 502 });
}
