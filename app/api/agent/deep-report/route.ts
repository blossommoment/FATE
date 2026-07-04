import { NextResponse } from "next/server";
import { buildDeepReport, validateDeepInput } from "@/lib/deepReport";
import { checkAgentAuth } from "../report/route";

export const maxDuration = 300; // 规则引擎秒出 + 后端 DS 压轴评述(~60s)；英文再加一次翻译

// 单人深度报告端点（OKX 黑客松）。纯规则引擎，中文单请求直接返回 PDF；英文加一次翻译。
export async function POST(request: Request) {
  const authError = checkAgentAuth(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { input, error } = validateDeepInput(body);
  if (error || !input) return NextResponse.json({ error }, { status: 400 });

  try {
    const { reportId, pdf } = await buildDeepReport(input);
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
