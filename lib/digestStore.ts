import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DigestPayload } from "./digest";

// 成册评述的服务端缓存（按 profileId 落盘）：
// 同一张盘的 AI 评述只生成一次——免费预览先生成入缓存，解锁后直接取全文（无需二次 AI、秒出），
// 命书 PDF 也复用同一份，保证网页成册与 PDF 里的评述一字不差。

const DIR = path.join(process.cwd(), "data", "digest-cache");
export type StoredDigest = DigestPayload & { source: "ai" };

export function readDigestCache(profileId: string): StoredDigest | null {
  try {
    return JSON.parse(readFileSync(path.join(DIR, `${profileId}.json`), "utf8")) as StoredDigest;
  } catch { return null; }
}

export function writeDigestCache(profileId: string, digest: DigestPayload): void {
  mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `${profileId}.json`);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify({ ...digest, source: "ai" }));
  renameSync(tmp, file);
}
