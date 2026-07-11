import { NextResponse } from "next/server";
import { subjectForSku, type ProductSku } from "@/lib/entitlements";
import { openReportState } from "@/lib/reportState";
import { createStripeCheckout } from "@/lib/stripeCheckout";

type Body = { sku?: ProductSku; state?: string; returnTo?: string };

function localPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.length > 4096) return null;
  return value;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json() as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (body.sku !== "personal_full" && body.sku !== "duo_full") return NextResponse.json({ error: "未知商品。" }, { status: 400 });
  const stateToken = typeof body.state === "string" ? body.state : null;
  const state = stateToken ? openReportState(stateToken) : null;
  const returnTo = localPath(body.returnTo);
  if (!stateToken || !state || !returnTo) return NextResponse.json({ error: "报告状态已过期，请重新起盘后再支付。" }, { status: 400 });
  try {
    const subject = subjectForSku(body.sku, state);
    const origin = new URL(request.url).origin;
    const encodedReturn = encodeURIComponent(returnTo);
    const session = await createStripeCheckout({
      sku: body.sku,
      subject,
      successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&return_to=${encodedReturn}&state=${encodeURIComponent(stateToken)}`,
      cancelUrl: `${origin}${returnTo}${returnTo.includes("?") ? "&" : "?"}checkout=cancelled`,
    });
    if (!session.url) throw new Error("支付服务没有返回结账地址。");
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法创建支付订单。" }, { status: 503 });
  }
}
