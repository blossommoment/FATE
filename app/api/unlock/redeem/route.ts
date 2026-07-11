import { NextResponse } from "next/server";
import { entitlementCookie, subjectForSku, type ProductSku } from "@/lib/entitlements";
import { claimRedeemCode } from "@/lib/entitlementStore";
import { openReportState } from "@/lib/reportState";

// 兑换只记录 code hash、商品和报告指纹；不保存出生信息、正文或 PDF。
export async function POST(request: Request) {
  let body: { code?: string; sku?: ProductSku; state?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.code || typeof body.code !== "string") return NextResponse.json({ error: "请输入解锁码。" }, { status: 400 });
  if (body.sku !== "personal_full" && body.sku !== "duo_full") return NextResponse.json({ error: "未知商品。" }, { status: 400 });
  const state = typeof body.state === "string" ? openReportState(body.state) : null;
  if (!state) return NextResponse.json({ error: "报告状态已过期，请重新起盘后再兑换。" }, { status: 400 });
  try {
    const subject = subjectForSku(body.sku, state);
    const result = await claimRedeemCode(body.code, body.sku, subject);
    if (!result.sku || result.error) return NextResponse.json({ error: result.error ?? "兑换失败。" }, { status: 400 });
    const response = NextResponse.json({ ok: true, alreadyClaimed: Boolean(result.alreadyClaimed) });
    const cookie = entitlementCookie(result.sku, subject);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "兑换失败。" }, { status: 503 });
  }
}
