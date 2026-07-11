import { NextResponse } from "next/server";
import { analyzeBirth, analyzeRelationship, validateBirth } from "@/lib/fate";
import { validateDuoPayload, type DuoDigestPayload } from "@/lib/duo";
import { buildDuoPdf } from "@/lib/duoPdf";
import { hasEntitlement, subjectForSku } from "@/lib/entitlements";
import { openReportState } from "@/lib/reportState";
import { cookies } from "next/headers";

export const maxDuration = 300;

export async function POST(request: Request) {
  let body: { state?: string; digest?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const state = typeof body.state === "string" ? openReportState(body.state) : null;
  if (!state?.partnerBirth) return NextResponse.json({ error: "报告状态已过期，请重新起盘。" }, { status: 400 });
  const birthError = validateBirth(state.birth) ?? validateBirth(state.partnerBirth);
  if (birthError) return NextResponse.json({ error: birthError }, { status: 400 });
  let subject: string;
  try {
    subject = subjectForSku("duo_full", state);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法校验报告权益。" }, { status: 503 });
  }
  if (!hasEntitlement(await cookies(), "duo_full", subject)) {
    return NextResponse.json({ error: "双人 PDF 为已购权益，请先完成支付或兑换。" }, { status: 402 });
  }
  const analysis = analyzeRelationship(analyzeBirth(state.birth), analyzeBirth(state.partnerBirth), state.relationType);
  const digest = validateDuoPayload(body.digest, analysis.guide.verdict);
  if (!digest) return NextResponse.json({ error: "报告正文无效，请重新生成后再导出 PDF。" }, { status: 400 });
  try {
    const { reportId, pdf } = await buildDuoPdf({ a: state.birth, b: state.partnerBirth, relationType: state.relationType, digest });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${reportId}.pdf"`,
        "X-Report-Id": reportId,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: `生成 PDF 失败：${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}
