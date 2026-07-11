import { NextResponse } from "next/server";
import { validateBirth } from "@/lib/fate";
import { sealReportState } from "@/lib/reportState";
import type { BirthInput } from "@/lib/types";

type Body = {
  birth?: BirthInput;
  partnerBirth?: BirthInput;
  relationType?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json() as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.birth) return NextResponse.json({ error: "缺少出生信息。" }, { status: 400 });
  const birthError = validateBirth(body.birth);
  if (birthError) return NextResponse.json({ error: birthError }, { status: 400 });
  if (body.partnerBirth) {
    const partnerError = validateBirth(body.partnerBirth);
    if (partnerError) return NextResponse.json({ error: partnerError }, { status: 400 });
  }
  const relationType = body.relationType ?? "恋爱";
  if (!['恋爱', '朋友', '同事', '家人'].includes(relationType)) {
    return NextResponse.json({ error: "关系类型无效。" }, { status: 400 });
  }
  try {
    return NextResponse.json({ state: sealReportState({ birth: body.birth, partnerBirth: body.partnerBirth, relationType }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法创建私密报告状态。" }, { status: 503 });
  }
}
