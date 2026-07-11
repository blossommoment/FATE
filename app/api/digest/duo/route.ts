import { NextResponse } from "next/server";
import { analyzeBirth, analyzeRelationship, validateBirth } from "@/lib/fate";
import { buildDuoFacts } from "@/lib/duo";
import { UpstreamTimeoutError, generateDuoDigest } from "@/lib/duoGenerate";
import { hasEntitlement, subjectForSku } from "@/lib/entitlements";
import { openReportState } from "@/lib/reportState";
import { cookies } from "next/headers";

export const maxDuration = 240; // SiliconFlow DeepSeek-V3.2 实测单次 ~50-110s，上游慢时给足重试余量

// 双人深度解读报告生成端点（REQ_DUO_REPORT B2）
// 生成逻辑在 lib/duoGenerate.ts（与 agent 报告管线共用）。

export async function POST(request: Request) {
  let body: { state?: string };
  try {
    body = await request.json() as { state?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const reportState = typeof body.state === "string" ? openReportState(body.state) : null;
  if (!reportState?.partnerBirth) return NextResponse.json({ error: "报告状态已过期，请重新起盘。" }, { status: 400 });
  const errorA = validateBirth(reportState.birth);
  if (errorA) return NextResponse.json({ error: errorA }, { status: 400 });
  const errorB = validateBirth(reportState.partnerBirth);
  if (errorB) return NextResponse.json({ error: errorB }, { status: 400 });

  let subject: string;
  try {
    subject = subjectForSku("duo_full", reportState);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法校验报告权益。" }, { status: 503 });
  }
  if (!hasEntitlement(await cookies(), "duo_full", subject)) {
    return NextResponse.json({ error: "双人 AI 成册为已购权益，请先完成支付或兑换。" }, { status: 402 });
  }

  const profileA = analyzeBirth(reportState.birth);
  const profileB = analyzeBirth(reportState.partnerBirth);
  const relationType = reportState.relationType;
  const analysis = analyzeRelationship(profileA, profileB, relationType);
  const facts = buildDuoFacts(profileA, profileB, analysis);
  const pairId = `${profileA.id}-${profileB.id}-${relationType}`;

  try {
    const { source, digest } = await generateDuoDigest(facts);
    return NextResponse.json({ source, pairId, digest, facts });
  } catch (error) {
    if (error instanceof UpstreamTimeoutError) {
      // 网络/超时类失败：如实返回超时，让前端提示重试——不拿兜底模板冒充 AI 报告（用户拍板）。
      return NextResponse.json({ error: error.message }, { status: 504 });
    }
    throw error;
  }
}
