import { redeemCodeHash, type ProductSku } from "./entitlements";

type CodeRecord = {
  sku: ProductSku;
  createdAt: string;
  source: string;
};

type ClaimRecord = {
  sku: ProductSku;
  subject: string;
  claimedAt: string;
};

type PaidOrderRecord = {
  sku: ProductSku;
  subject: string;
  provider: "stripe";
  paidAt: string;
};

type KvResponse = { result?: unknown; error?: string };

export class EntitlementStoreUnavailable extends Error {
  constructor(message = "权益存储尚未配置。") {
    super(message);
    this.name = "EntitlementStoreUnavailable";
  }
}

function config() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new EntitlementStoreUnavailable("服务端未配置 Vercel KV / Upstash Redis，无法安全核销兑换码。");
  return { url: url.replace(/\/$/, ""), token };
}

function prefix(): string {
  return process.env.ENTITLEMENT_KV_PREFIX ?? "fate:entitlement:v1";
}

function key(...parts: string[]): string {
  return [prefix(), ...parts].join(":");
}

async function pipeline(commands: string[][]): Promise<unknown[]> {
  const { url, token } = config();
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as KvResponse[] | KvResponse | null;
  if (!response.ok || !data) throw new EntitlementStoreUnavailable("权益存储暂时不可用，请稍后重试。");
  const rows = Array.isArray(data) ? data : [data];
  const error = rows.find((row) => row.error)?.error;
  if (error) throw new EntitlementStoreUnavailable(`权益存储返回错误：${error}`);
  return rows.map((row) => row.result);
}

async function getJson<T>(storageKey: string): Promise<T | null> {
  const [result] = await pipeline([["GET", storageKey]]);
  if (typeof result !== "string") return null;
  try {
    return JSON.parse(result) as T;
  } catch {
    throw new EntitlementStoreUnavailable("权益存储中存在无法识别的记录。");
  }
}

async function setIfAbsent(storageKey: string, value: unknown): Promise<boolean> {
  const [result] = await pipeline([["SET", storageKey, JSON.stringify(value), "NX"]]);
  return result === "OK";
}

export async function registerRedeemCode(code: string, sku: ProductSku, source = "manual"): Promise<void> {
  const record: CodeRecord = { sku, source, createdAt: new Date().toISOString() };
  const inserted = await setIfAbsent(key("code", redeemCodeHash(code)), record);
  if (!inserted) throw new Error("这枚兑换码已经登记过。请重新生成。");
}

export async function claimRedeemCode(code: string, expectedSku: ProductSku, subject: string): Promise<{ sku?: ProductSku; error?: string; alreadyClaimed?: boolean }> {
  const hash = redeemCodeHash(code);
  const codeKey = key("code", hash);
  const claimKey = key("claim", hash);
  const codeRecord = await getJson<CodeRecord>(codeKey);
  if (!codeRecord || !(codeRecord.sku === "personal_full" || codeRecord.sku === "duo_full")) {
    return { error: "兑换码无效。" };
  }
  if (codeRecord.sku !== expectedSku) return { error: "这枚兑换码不适用于当前报告。" };
  const existing = await getJson<ClaimRecord>(claimKey);
  if (existing) {
    if (existing.subject === subject && existing.sku === codeRecord.sku) return { sku: codeRecord.sku, alreadyClaimed: true };
    return { error: "这枚兑换码已经使用，不能用于另一份报告。" };
  }
  const claimedAt = new Date().toISOString();
  const inserted = await setIfAbsent(claimKey, { sku: codeRecord.sku, subject, claimedAt } satisfies ClaimRecord);
  if (inserted) return { sku: codeRecord.sku };
  const winner = await getJson<ClaimRecord>(claimKey);
  if (winner?.subject === subject && winner.sku === codeRecord.sku) return { sku: codeRecord.sku, alreadyClaimed: true };
  return { error: "这枚兑换码刚刚被使用，不能重复领取。" };
}

export async function recordPaidOrder(orderId: string, record: PaidOrderRecord): Promise<void> {
  const orderKey = key("order", record.provider, orderId);
  const inserted = await setIfAbsent(orderKey, record);
  if (inserted) return;
  const existing = await getJson<PaidOrderRecord>(orderKey);
  if (!existing || existing.sku !== record.sku || existing.subject !== record.subject) {
    throw new EntitlementStoreUnavailable("订单记录与当前权益不一致，已拒绝发放权限。");
  }
}
