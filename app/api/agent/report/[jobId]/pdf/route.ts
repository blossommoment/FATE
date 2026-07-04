import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { getJob } from "@/lib/agentReport";
import { checkAgentAuth } from "../../route";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const authError = checkAgentAuth(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job || job.status !== "done" || !job.result) return NextResponse.json({ error: "报告尚未就绪。" }, { status: 404 });
  try {
    const file = readFileSync(job.result.pdfPath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${job.result.reportId}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "报告文件已不存在，请重新生成。" }, { status: 410 });
  }
}
