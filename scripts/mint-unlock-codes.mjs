// 铸造解锁码：node scripts/mint-unlock-codes.mjs [数量]
// 与 lib/unlock.ts 同一算法（HMAC-SHA256(UNLOCK_SECRET, "code:"+序列号) 前 10 位十六进制）。
// 产出的码可直接挂到发卡平台/爱发电出售；换 UNLOCK_SECRET 会使已售未兑的码全部失效——慎换。
import { createHmac, randomBytes } from "node:crypto";
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

const secret = readEnv("UNLOCK_SECRET");
if (!secret) {
  console.error("未找到 UNLOCK_SECRET（.env.local / .env / 环境变量）。");
  process.exit(1);
}

// --master：打印万能钥匙（任意命盘可解、无限次，⚠️ 只自己用，泄露即全站白嫖）
if (process.argv.includes("--master")) {
  const sig = createHmac("sha256", secret).update("master-key").digest("hex").slice(0, 10).toUpperCase();
  console.log(`FATE-MASTER-${sig}`);
  process.exit(0);
}

const count = Math.max(1, Math.min(500, Number(process.argv[2]) || 10));
for (let i = 0; i < count; i++) {
  const serial = randomBytes(5).toString("hex").toUpperCase();
  const sig = createHmac("sha256", secret).update(`code:${serial}`).digest("hex").slice(0, 10).toUpperCase();
  console.log(`FATE-${serial}-${sig}`);
}
