import { NextResponse } from "next/server";
import { entitlementCookie, subjectForSku, type ProductSku } from "@/lib/entitlements";
import { recordPaidOrder } from "@/lib/entitlementStore";
import { openReportState } from "@/lib/reportState";
import { getStripeCheckout, paymentMetadata } from "@/lib/stripeCheckout";

type Body = { sessionId?: string; state?: string };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json() as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.sessionId || typeof body.sessionId !== "string") return NextResponse.json({ error: "缺少支付订单。" }, { status: 400 });
  const state = typeof body.state === "string" ? openReportState(body.state) : null;
  if (!state) return NextResponse.json({ error: "报告状态已过期，请重新起盘后恢复订单。" }, { status: 400 });
  try {
    const session = await getStripeCheckout(body.sessionId);
    const metadata = paymentMetadata(session);
    if (!metadata || session.payment_status !== "paid") return NextResponse.json({ error: "支付尚未完成。" }, { status: 409 });
    const subject = subjectForSku(metadata.sku as ProductSku, state);
    if (metadata.subject !== subject) return NextResponse.json({ error: "该订单不属于当前报告。" }, { status: 403 });
    await recordPaidOrder(session.id, {
      sku: metadata.sku,
      subject,
      provider: "stripe",
      paidAt: new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    });
    const response = NextResponse.json({ ok: true, sku: metadata.sku });
    const cookie = entitlementCookie(metadata.sku, subject);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法确认支付结果。" }, { status: 503 });
  }
}
