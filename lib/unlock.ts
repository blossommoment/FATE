import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

// 付费解锁 v1（2026-07-09 用户拍板：不做广告，直接付费；先走解锁码，后接微信支付）。
// 解锁码 = 序列号 + HMAC 签名，离线可验真伪；兑换记录落盘防一码多用（首兑绑定命盘，同盘可重复兑换恢复解锁）。
// 解锁 token = HMAC(profileId)，无状态校验，前端存 localStorage。
// 将来接支付：支付回调里对 profileId 调 issueToken 发 token 即可，本文件与前端零改动。

const secret = (): string => {
  const s = process.env.UNLOCK_SECRET;
  if (!s) throw new Error("服务端未配置 UNLOCK_SECRET。");
  return s;
};
const hmac = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

const CODE_RE = /^FATE-([0-9A-F]{10})-([0-9A-F]{10})$/;

export function mintCode(): string {
  const serial = randomBytes(5).toString("hex").toUpperCase();
  return `FATE-${serial}-${hmac(`code:${serial}`).slice(0, 10).toUpperCase()}`;
}

export function codeValid(code: string): boolean {
  const m = CODE_RE.exec(code.trim().toUpperCase());
  return !!m && hmac(`code:${m[1]}`).slice(0, 10).toUpperCase() === m[2];
}

// 万能钥匙（2026-07-09 用户拍板：自用免付）：由 UNLOCK_SECRET 派生，任意命盘可解、
// 不写兑换记录、无限次使用。⚠️ 泄露即全站白嫖——只自己用，别发给任何人。
export function masterCode(): string {
  return `FATE-MASTER-${hmac("master-key").slice(0, 10).toUpperCase()}`;
}

export function issueToken(profileId: string): string {
  return hmac(`unlock:${profileId}`);
}

export function tokenValid(profileId: string, token: unknown): boolean {
  return typeof token === "string" && token.length > 0 && token === issueToken(profileId);
}

const DATA_DIR = path.join(process.cwd(), "data");
const REDEEM_FILE = path.join(DATA_DIR, "unlock-redemptions.json");
type Redemptions = Record<string, { profileId: string; at: string }>;

function readRedemptions(): Redemptions {
  try { return JSON.parse(readFileSync(REDEEM_FILE, "utf8")) as Redemptions; } catch { return {}; }
}

export function redeemCode(code: string, profileId: string): { token?: string; error?: string } {
  const normalized = code.trim().toUpperCase();
  if (normalized === masterCode()) return { token: issueToken(profileId) };
  if (!codeValid(normalized)) return { error: "解锁码无效，请核对后重试。" };
  const all = readRedemptions();
  const used = all[normalized];
  if (used && used.profileId !== profileId) return { error: "这枚解锁码已绑定另一张命盘，不能重复使用。" };
  if (!used) {
    mkdirSync(DATA_DIR, { recursive: true });
    all[normalized] = { profileId, at: new Date().toISOString() };
    const tmp = `${REDEEM_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(all, null, 2));
    renameSync(tmp, REDEEM_FILE);
  }
  return { token: issueToken(profileId) };
}
