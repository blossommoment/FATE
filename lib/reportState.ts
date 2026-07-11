import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { BirthInput } from "./types";

// Birth details stay in an encrypted, short-lived browser URL state rather than
// in query parameters or a server-side session database.
const VERSION = "v1";
const DEFAULT_TTL_SECONDS = 6 * 60 * 60;

export type ReportState = {
  birth: BirthInput;
  partnerBirth?: BirthInput;
  relationType: string;
  issuedAt: number;
  expiresAt: number;
};

export type ReportStateInput = Pick<ReportState, "birth" | "partnerBirth" | "relationType">;

function stateSecret(): string {
  const value = process.env.REPORT_STATE_SECRET ?? process.env.UNLOCK_SECRET;
  if (!value) throw new Error("服务端未配置 REPORT_STATE_SECRET。");
  return value;
}

function stateKey(): Buffer {
  return createHash("sha256").update(stateSecret()).digest();
}

function ttlSeconds(): number {
  const configured = Number(process.env.REPORT_STATE_TTL_SECONDS);
  return Number.isInteger(configured) && configured >= 300 && configured <= 24 * 60 * 60
    ? configured
    : DEFAULT_TTL_SECONDS;
}

export function sealReportState(input: ReportStateInput, now = Date.now()): string {
  const payload: ReportState = {
    ...input,
    relationType: input.relationType || "恋爱",
    issuedAt: now,
    expiresAt: now + ttlSeconds() * 1000,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", stateKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
}

function looksLikeBirth(value: unknown): value is BirthInput {
  if (!value || typeof value !== "object") return false;
  const birth = value as Partial<BirthInput>;
  return [birth.year, birth.month, birth.day, birth.hour].every((part) => typeof part === "number")
    && (birth.minute === undefined || typeof birth.minute === "number")
    && (birth.gender === "male" || birth.gender === "female")
    && (birth.calendarType === "solar" || birth.calendarType === "lunar");
}

export function openReportState(token: string, now = Date.now()): ReportState | null {
  try {
    const [version, ivEncoded, cipherEncoded, tagEncoded] = token.split(".");
    if (version !== VERSION || !ivEncoded || !cipherEncoded || !tagEncoded) return null;
    const decipher = createDecipheriv("aes-256-gcm", stateKey(), Buffer.from(ivEncoded, "base64url"));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(cipherEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as Partial<ReportState>;
    if (!looksLikeBirth(parsed.birth) || (parsed.partnerBirth !== undefined && !looksLikeBirth(parsed.partnerBirth))) return null;
    if (typeof parsed.relationType !== "string" || typeof parsed.issuedAt !== "number" || typeof parsed.expiresAt !== "number") return null;
    if (parsed.expiresAt < now || parsed.expiresAt <= parsed.issuedAt) return null;
    return parsed as ReportState;
  } catch {
    return null;
  }
}
