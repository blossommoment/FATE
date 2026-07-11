import { NextResponse } from "next/server";
import { recordPaidOrder } from "@/lib/entitlementStore";
import { paymentMetadata, verifyStripeSignature, type StripeCheckoutSession } from "@/lib/stripeCheckout";

export const runtime = "nodejs";

type StripeEvent = { type?: string; data?: { object?: StripeCheckoutSession } };

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"))) {
      return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
    }
    const event = JSON.parse(rawBody) as StripeEvent;
    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
      return NextResponse.json({ received: true });
    }
    const session = event.data?.object;
    const metadata = session ? paymentMetadata(session) : null;
    if (!session || !metadata || session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }
    await recordPaidOrder(session.id, {
      sku: metadata.sku,
      subject: metadata.subject,
      provider: "stripe",
      paidAt: new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook failed." }, { status: 500 });
  }
}
