import { NextResponse } from "next/server";
import { analyzeBirth, analyzeRelationship, validateBirth } from "@/lib/fate";
import { buildDuoFacts } from "@/lib/duo";
import { UpstreamTimeoutError, generateDuoDigest } from "@/lib/duoGenerate";
import type { BirthInput } from "@/lib/types";

export const maxDuration = 240; // SiliconFlow DeepSeek-V3.2 实测单次 ~50-110s，上游慢时给足重试余量

// 双人深度解读报告生成端点（REQ_DUO_REPORT B2）
// 生成逻辑在 lib/duoGenerate.ts（与 agent 报告管线共用）。

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
