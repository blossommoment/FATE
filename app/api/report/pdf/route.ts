import { NextResponse } from "next/server";
import { analyzeBirth, validateBirth } from "@/lib/fate";
import { buildDeepReport } from "@/lib/deepReport";
import { hasEntitlement, personalSubject } from "@/lib/entitlements";
import { openReportState } from "@/lib/reportState";
import { cookies } from "next/headers";

export const maxDuration = 300;

// 用户侧命书 PDF：动态生成后直接返回，不保存出生信息、正文或 PDF 文件。
export async function POST(request: Request) {
  let body: { state?: string; lang?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const reportState = typeof body.state === "string" ? openReportState(body.state) : null;
  if (!reportState) return NextResponse.json({ error: "报告状态已过期，请重新起盘。" }, { status: 400 });
  const birthError = validateBirth(reportState.birth);
  if (birthError) return NextResponse.json({ error: birthError }, { status: 400 });

  let subject: string;
  try {
    subject = personalSubject(reportState.birth);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法校验报告权益。" }, { status: 503 });
  }
  if (!hasEntitlement(await cookies(), "personal_full", subject)) {
    return NextResponse.json({ error: "命书 PDF 为解锁权益，请先解锁全册。" }, { status: 402 });
  }

  const lang = body.lang === "en" ? "en" : "zh";
  try {
    const { reportId, pdf } = await buildDeepReport({ birth: reportState.birth, lang });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${reportId}.pdf"`,
        "X-Report-Id": reportId,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: `生成失败：${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}
