import { NextResponse } from "next/server";
import { analyzeBirth, validateBirth } from "@/lib/fate";
import { buildDeepReport } from "@/lib/deepReport";
import { readDigestCache, writeDigestCache } from "@/lib/digestStore";
import { tokenValid } from "@/lib/unlock";
import type { BirthInput } from "@/lib/types";

export const maxDuration = 300;

// 用户侧命书 PDF（付费权益，2026-07-09 用户拍板）：解锁 token 鉴权（与成册叁肆伍章同一次解锁）。
// 评述优先取成册的服务端缓存——与网页一字不差且秒级出书；无缓存才现场生成（约一分钟）并回写缓存。
export async function POST(request: Request) {
  let body: { birth?: BirthInput; lang?: string; unlockToken?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.birth) return NextResponse.json({ error: "缺少出生信息。" }, { status: 400 });
  const birthError = validateBirth(body.birth);
  if (birthError) return NextResponse.json({ error: birthError }, { status: 400 });

  const profileId = analyzeBirth(body.birth).id;
  if (!tokenValid(profileId, body.unlockToken)) {
    return NextResponse.json({ error: "命书 PDF 为解锁权益，请先解锁全册。" }, { status: 402 });
  }

  const lang = body.lang === "en" ? "en" : "zh";
  const cached = readDigestCache(profileId);
  try {
    const { reportId, pdf, digest } = await buildDeepReport({ birth: body.birth, lang }, cached ? { digest: cached } : undefined);
    if (!cached) writeDigestCache(profileId, { headline: digest.headline, pages: digest.pages });
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
