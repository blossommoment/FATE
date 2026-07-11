import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { BirthInput } from "./types";
import type { ReportState } from "./reportState";

export const PRODUCTS = {
  personal_full: {
    label: "个人深度全册与 PDF",
    stripePriceEnv: "STRIPE_PRICE_PERSONAL_FULL",
  },
  duo_full: {
    label: "双人关系全册、AI 成册与 PDF",
    stripePriceEnv: "STRIPE_PRICE_DUO_FULL",
  },
} as const;

export type ProductSku = keyof typeof PRODUCTS;

type EntitlementPayload = {
  version: 1;
  sku: ProductSku;
  subject: string;
  issuedAt: number;
  expiresAt: number;
};

type CookieReader = { get(name: string): { value: string } | undefined };

const DEFAULT_ENTITLEMENT_TTL_DAYS = 3650;

function entitlementSecret(): string {
  const value = process.env.ENTITLEMENT_SECRET ?? process.env.UNLOCK_SECRET;
  if (!value) throw new Error("服务端未配置 ENTITLEMENT_SECRET。");
  return value;
}

function hmac(value: string): string {
  return createHmac("sha256", entitlementSecret()).update(value).digest("base64url");
}

function normalizedBirth(birth: BirthInput): Record<string, string | number | boolean> {
  return {
    year: birth.year,
    month: birth.month,
    day: birth.day,
    hour: birth.hour,
    minute: birth.minute ?? 0,
    name: (birth.name ?? "").trim(),
    gender: birth.gender ?? "female",
    calendarType: birth.calendarType ?? "solar",
    isLeapMonth: Boolean(birth.isLeapMonth),
  };
}

function hmacSubject(kind: string, value: unknown): string {
  return hmac(`subject:v1:${kind}:${JSON.stringify(value)}`);
}

export function personalSubject(birth: BirthInput): string {
  return hmacSubject("personal", normalizedBirth(birth));
}

export function duoSubject(a: BirthInput, b: BirthInput, relationType: string): string {
  return hmacSubject("duo", { a: normalizedBirth(a), b: normalizedBirth(b), relationType: relationType || "恋爱" });
}

export function subjectForSku(sku: ProductSku, state: ReportState): string {
  if (sku === "personal_full") return personalSubject(state.birth);
  if (!state.partnerBirth) throw new Error("双人权益需要两个人的出生信息。");
  return duoSubject(state.birth, state.partnerBirth, state.relationType);
}

function entitlementTtlSeconds(): number {
  const configured = Number(process.env.ENTITLEMENT_TTL_DAYS);
  const days = Number.isInteger(configured) && configured >= 1 && configured <= DEFAULT_ENTITLEMENT_TTL_DAYS
    ? configured
    : DEFAULT_ENTITLEMENT_TTL_DAYS;
  return days * 24 * 60 * 60;
}

export function entitlementCookieName(sku: ProductSku, subject: string): string {
  const suffix = createHash("sha256").update(`${sku}:${subject}`).digest("hex").slice(0, 24);
  return `fate_access_${suffix}`;
}

export function issueEntitlement(sku: ProductSku, subject: string, now = Date.now()): string {
  const payload: EntitlementPayload = {
    version: 1,
    sku,
    subject,
    issuedAt: now,
    expiresAt: now + entitlementTtlSeconds() * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${hmac(`entitlement:v1:${encoded}`)}`;
}

function signedPayload(token: string): EntitlementPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = hmac(`entitlement:v1:${encoded}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as EntitlementPayload;
    if (payload.version !== 1 || !(payload.sku in PRODUCTS) || typeof payload.subject !== "string") return null;
    if (!Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function tokenGrants(token: string | undefined, sku: ProductSku, subject: string, now = Date.now()): boolean {
  try {
    const payload = token ? signedPayload(token) : null;
    return Boolean(payload && payload.sku === sku && payload.subject === subject && payload.expiresAt >= now);
  } catch {
    return false;
  }
}

export function hasEntitlement(cookies: CookieReader, sku: ProductSku, subject: string): boolean {
  return tokenGrants(cookies.get(entitlementCookieName(sku, subject))?.value, sku, subject);
}

export function entitlementCookie(sku: ProductSku, subject: string) {
  return {
    name: entitlementCookieName(sku, subject),
    value: issueEntitlement(sku, subject),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: entitlementTtlSeconds(),
    },
  };
}

export function mintRedeemCode(): string {
  const bytes = randomBytes(15).toString("hex").toUpperCase();
  return `FATE-${bytes.slice(0, 10)}-${bytes.slice(10, 20)}-${bytes.slice(20)}`;
}

export function redeemCodeHash(code: string): string {
  return createHash("sha256").update(`fate-redeem-v2:${code.trim().toUpperCase()}`).digest("hex");
}
