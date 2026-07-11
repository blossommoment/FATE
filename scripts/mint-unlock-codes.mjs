// 发放一次性兑换码：node scripts/mint-unlock-codes.mjs [数量] [personal_full|duo_full]
// 码只以 hash 形式写入 Vercel KV / Upstash；明文仅在本次命令输出，不能再次找回。
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

function readEnv(name) {
  if (process.env[name]) return process.env[name];
  for (const file of [".env.local", ".env"]) {
    try {
      const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
      if (line) return line.slice(name.length + 1).trim();
    } catch { /* 文件不存在则试下一个 */ }
  }
  return "";
}

const url = readEnv("KV_REST_API_URL") || readEnv("UPSTASH_REDIS_REST_URL");
const token = readEnv("KV_REST_API_TOKEN") || readEnv("UPSTASH_REDIS_REST_TOKEN");
if (!url || !token) {
  console.error("未找到 KV_REST_API_URL / KV_REST_API_TOKEN（或对应的 UPSTASH 变量）。");
  process.exit(1);
}

const count = Math.max(1, Math.min(500, Number(process.argv[2]) || 10));
const sku = process.argv[3] || "duo_full";
if (!["personal_full", "duo_full"].includes(sku)) {
  console.error("商品只能是 personal_full 或 duo_full。");
  process.exit(1);
}

const prefix = readEnv("ENTITLEMENT_KV_PREFIX") || "fate:entitlement:v1";
const codes = Array.from({ length: count }, () => {
  const bytes = randomBytes(15).toString("hex").toUpperCase();
  const code = `FATE-${bytes.slice(0, 10)}-${bytes.slice(10, 20)}-${bytes.slice(20)}`;
  const hash = createHash("sha256").update(`fate-redeem-v2:${code}`).digest("hex");
  return { code, key: `${prefix}:code:${hash}` };
});

const commands = codes.map(({ key }) => ["SET", key, JSON.stringify({ sku, source: "manual", createdAt: new Date().toISOString() }), "NX"]);
const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(commands),
});
const result = await response.json().catch(() => null);
if (!response.ok || !Array.isArray(result) || result.some((row) => row?.result !== "OK")) {
  console.error("写入兑换码失败；请检查 KV 配置，或确认没有重复执行同一批命令。", result);
  process.exit(1);
}
console.log(`已登记 ${count} 枚 ${sku} 兑换码（只显示这一次）：`);
codes.forEach(({ code }) => console.log(code));
