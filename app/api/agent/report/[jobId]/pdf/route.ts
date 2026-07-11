import { NextResponse } from "next/server";
import { getJob } from "@/lib/agentReport";
import { checkAgentAuth } from "../../route";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const authError = checkAgentAuth(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job || job.status !== "done" || !job.result) return NextResponse.json({ error: "报告尚未就绪。" }, { status: 404 });
  return new NextResponse(new Uint8Array(job.result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${job.result.reportId}.pdf"`,
    },
  });
}
