import { createHmac, timingSafeEqual } from "node:crypto";
import { PRODUCTS, type ProductSku } from "./entitlements";

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  payment_status: string;
  metadata: Record<string, string>;
  created?: number;
};

function stripeSecret(): string {
  const value = process.env.STRIPE_SECRET_KEY;
  if (!value) throw new Error("站内支付尚未配置。请稍后再试或使用兑换码。");
  return value;
}

function stripeWebhookSecret(): string {
  const value = process.env.STRIPE_WEBHOOK_SECRET;
  if (!value) throw new Error("服务端未配置 STRIPE_WEBHOOK_SECRET。");
  return value;
}

function priceFor(sku: ProductSku): string {
  const value = process.env[PRODUCTS[sku].stripePriceEnv];
  if (!value) throw new Error(`服务端未配置 ${PRODUCTS[sku].stripePriceEnv}。`);
  return value;
}

async function stripeRequest(path: string, init: RequestInit = {}): Promise<StripeCheckoutSession> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${stripeSecret()}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as StripeCheckoutSession & { error?: { message?: string } } | null;
  if (!response.ok || !data) throw new Error(data?.error?.message ?? "支付服务暂时不可用。请稍后重试。");
  return data;
}

export async function createStripeCheckout(args: {
  sku: ProductSku;
  subject: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeCheckoutSession> {
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", args.successUrl);
  form.set("cancel_url", args.cancelUrl);
  form.set("line_items[0][price]", priceFor(args.sku));
  form.set("line_items[0][quantity]", "1");
  form.set("metadata[fate_sku]", args.sku);
  form.set("metadata[fate_subject]", args.subject);
  form.set("client_reference_id", args.subject);
  return stripeRequest("/checkout/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

export async function getStripeCheckout(sessionId: string): Promise<StripeCheckoutSession> {
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

export function paymentMetadata(session: Pick<StripeCheckoutSession, "metadata">): { sku: ProductSku; subject: string } | null {
  const sku = session.metadata?.fate_sku;
  const subject = session.metadata?.fate_subject;
  if ((sku !== "personal_full" && sku !== "duo_full") || !subject) return null;
  return { sku, subject };
}

export function verifyStripeSignature(rawBody: string, signature: string | null, now = Math.floor(Date.now() / 1000)): boolean {
  if (!signature) return false;
  const values = signature.split(",").reduce<Record<string, string[]>>((out, item) => {
    const [key, value] = item.split("=", 2);
    if (key && value) (out[key] ??= []).push(value);
    return out;
  }, {});
  const timestamp = Number(values.t?.[0]);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 5 * 60) return false;
  const expected = createHmac("sha256", stripeWebhookSecret()).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  return (values.v1 ?? []).some((candidate) => {
    const candidateBuffer = Buffer.from(candidate);
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}
