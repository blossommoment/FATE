"use client";

import { useEffect, useState } from "react";
import type { BirthInput } from "@/lib/types";
import type { DigestPayload } from "@/lib/digest";

// 付费开关（REQ_AI_DIGEST 拍板#3：付费定位、点击生成、预览截断）。
// 当前限免体验；接入支付后置 true——已生成内容只展示人设与标签，建议与总结模糊待解锁。
const PAYWALL_ENABLED = false;

const ADVICE_META: { key: keyof DigestPayload["advice"]; label: string; icon: string }[] = [
  { key: "vocation", label: "职业方向", icon: "业" },
  { key: "industry", label: "行业场域", icon: "场" },
  { key: "environment", label: "环境倾向", icon: "地" },
  { key: "love", label: "感情里的你", icon: "情" },
  { key: "phase", label: "当下策略", icon: "时" },
];

type CachedDigest = { digest: DigestPayload; source: "ai" | "fallback" };

export default function AiDigest({ birth, profileId }: { birth: BirthInput; profileId: string }) {
  const [result, setResult] = useState<CachedDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [unlocked] = useState(!PAYWALL_ENABLED);
  const cacheKey = `fate-digest-${profileId}`;

  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) setResult(JSON.parse(cached) as CachedDigest);
      else setResult(null);
    } catch { setResult(null); }
  }, [cacheKey]);

  const generate = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(birth),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as CachedDigest & { profileId: string };
      const next = { digest: data.digest, source: data.source };
      setResult(next);
      try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* 存储满时仅影响缓存 */ }
    } catch {
      setFailed(true);
    }
    setLoading(false);
  };

  if (!result) {
    return <section className="ai-digest">
      <header><span>AI 读你 · BETA</span><small>基于上方已算好的报告撰写 · 不重新算命</small></header>
      <div className="digest-intro">
        <h3>把这份报告，读成你的使用说明书。</h3>
        <p>报告负责准确，这里负责说人话：一句话人设、看得懂的标签、职业与行业方向、适合的环境、感情里的你、当下该攻还是该守。生成一次，永久可看。</p>
        <button className="digest-cta" onClick={generate} disabled={loading}>
          {loading ? "正在读你的盘…（约 20 秒）" : "生成我的解读 · 限免体验"}
        </button>
        {failed && <div className="digest-note">生成没有成功，多半是网络原因——稍等片刻再点一次。</div>}
        {!failed && <div className="digest-note">AI 只组织语言，事实与标签全部来自报告本身，可逐条对账。</div>}
      </div>
    </section>;
  }

  const { digest, source } = result;
  return <section className="ai-digest">
    <header>
      <span>AI 读你 · 已生成</span>
      <small>永久可看{source === "fallback" ? " · 离线版（AI 暂不可用时的规则版解读）" : ""}</small>
    </header>
    <h3 className="digest-headline">「{digest.headline}」</h3>
    <div className="digest-tags">
      {digest.tagReads.map((item) => <span key={item.tag}>{item.tag}<b>{item.note}</b></span>)}
    </div>
    <div className={unlocked ? "" : "digest-locked"}>
      <div className={unlocked ? "" : "digest-blur"}>
        <div className="digest-advice">
          {ADVICE_META.map((meta) => <article key={meta.key}>
            <i>{meta.icon}</i>
            <div><span>{meta.label}</span><p>{digest.advice[meta.key]}</p></div>
          </article>)}
        </div>
        <blockquote className="digest-summary">{digest.summary}</blockquote>
      </div>
      {!unlocked && <div className="digest-unlock">
        <button className="digest-cta">解锁完整解读</button>
      </div>}
    </div>
  </section>;
}
