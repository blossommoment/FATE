import { NextResponse } from "next/server";
import { createReportJob, validateAgentInput } from "@/lib/agentReport";

// Agent 下单端点（OKX 黑客松：Hermes 店员调用）。任务制：立即返回 jobId，轮询取货。

export function checkAgentAuth(request: Request): string | null {
  const key = process.env.AGENT_API_KEY;
  if (!key) return "服务端未配置 AGENT_API_KEY。";
  if (request.headers.get("x-api-key") !== key && new URL(request.url).searchParams.get("key") !== key) return "无效的 API Key（请带 X-API-Key 请求头）。";
  return null;
}

export async function POST(request: Request) {
  const authError = checkAgentAuth(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { input, error } = validateAgentInput(body);
  if (error || !input) return NextResponse.json({ error }, { status: 400 });

  const { job, cached } = createReportJob(input);
  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    step: job.step,
    cached,
    poll: `/api/agent/report/${job.id}`,
    pdf: job.status === "done" ? `/api/agent/report/${job.id}/pdf` : undefined,
    hint: cached ? "同一对盘的成品直接复用。" : "生成约需一到三分钟，请每 10 秒轮询 poll 地址。",
  }, { status: cached ? 200 : 202 });
}
