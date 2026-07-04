import { NextResponse } from "next/server";
import { getJob } from "@/lib/agentReport";
import { checkAgentAuth } from "../route";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const authError = checkAgentAuth(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "任务不存在或已过期（服务重启会清空任务，请重新下单）。" }, { status: 404 });
  if (job.status === "failed") return NextResponse.json({ jobId: job.id, status: job.status, error: job.error }, { status: 504 });
  if (job.status !== "done" || !job.result) return NextResponse.json({ jobId: job.id, status: job.status, step: job.step });
  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    reportId: job.result.reportId,
    pdf: `/api/agent/report/${job.id}/pdf`,
    report: job.result.report,
  });
}
