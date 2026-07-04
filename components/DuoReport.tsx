"use client";

import { useEffect, useState } from "react";
import type { BirthInput } from "@/lib/types";
import { DUO_TAG_EXPLAIN, type DuoDigestPayload, type DuoDomain, type DuoFacts } from "@/lib/duo";

// 双人深度解读报告 · 成册五章（REQ_DUO_REPORT B3）
// 付费开关：置 true 后封面与壹章可看，贰至伍章模糊待解锁
const PAYWALL_ENABLED = false;

const PAGES: { key: DuoDomain; no: string; cn: string; en: string }[] = [
  { key: "origin", no: "壹", cn: "缘起", en: "CHAPTER 01 · ORIGIN" },
  { key: "daily", no: "贰", cn: "相处", en: "CHAPTER 02 · DAILY" },
  { key: "friction", no: "叁", cn: "摩擦", en: "CHAPTER 03 · FRICTION" },
  { key: "longrun", no: "肆", cn: "长线", en: "CHAPTER 04 · LONG RUN" },
  { key: "season", no: "伍", cn: "时运", en: "CHAPTER 05 · SEASON" },
];

const ADVICE_LABEL: Record<DuoDomain, string> = {
  origin: "一起做", daily: "一起做", friction: "拆法", longrun: "经营", season: "时间窗",
};


type CachedDuo = { digest: DuoDigestPayload; source: "ai" | "fallback"; facts: DuoFacts };

export default function DuoReport({ a, b, relationType, pairId }: { a: BirthInput; b: BirthInput; relationType: string; pairId: string }) {
  const [result, setResult] = useState<CachedDuo | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [unlocked] = useState(!PAYWALL_ENABLED);
  const cacheKey = `fate-duo-report-v6-${pairId}`;

  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) setResult(JSON.parse(cached) as CachedDuo);
      else setResult(null);
    } catch { setResult(null); }
  }, [cacheKey]);

  const generate = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/digest/duo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a, b, relationType }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as CachedDuo & { pairId: string };
      const next = { digest: data.digest, source: data.source, facts: data.facts };
      setResult(next);
      try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* 缓存失败不影响本次展示 */ }
    } catch {
      setFailed(true);
    }
    setLoading(false);
  };

  if (!result) {
    return <section className="fate-book fate-book-intro">
      <span className="fb-mono">FATE° · 双人深度解读报告</span>
      <h3>五章，读懂你们。</h3>
      <div className="fb-toc-preview">
        {PAGES.map((page) => <span key={page.key} className={`fb-c-${page.key}`}><b>{page.no}</b>{page.cn}</span>)}
      </div>
      <p>缘起、相处、摩擦、长线、时运各一章——你们的双人标签、对比图表、与只属于你们的评述与建议。生成一次，永久可看。</p>
      <button className="fb-cta" onClick={generate} disabled={loading}>
        {loading ? "正在撰写你们的报告…（约一分钟，值得等）" : "生成你们的深度解读 · 限免体验"}
      </button>
      <div className="fb-note">{failed ? "生成没有成功，多半是网络原因——稍等片刻再点一次。" : "报告内容基于 FATE 模型 2.0 得出。"}</div>
    </section>;
  }

  const { digest, facts } = result;
  const [pa, pb] = facts.persons;

  const renderPage = (page: typeof PAGES[number]) => <section className={`fb-page fb-p-${page.key}`} id={`duo-${page.key}`} key={page.key}>
    <header><h2><small>{page.en}</small>{page.cn}</h2><span className="fb-no">{page.no}</span></header>
    <div className="fb-stamps">
      {facts.duoTags[page.key].map((hit) => <div className="fb-stamp" key={hit.tag}><b>{hit.tag}</b><span>{DUO_TAG_EXPLAIN[hit.tag] ?? ""}</span></div>)}
    </div>
    {page.key !== "season" && <div className="fb-data">
      <span className="fb-mono">DATA · 双人对比</span>
      <div className="fb-duo-legend"><span><i className="fb-fill-a" />{pa.name}</span><span><i className="fb-fill-b" />{pb.name}</span></div>
      {facts.comparisons[page.key].map((row) => <div className="fb-duo-metric" key={row.label}>
        <label>{row.label}</label>
        <div className="fb-pair">
          <div className="fb-track"><i className="fb-fill fb-fill-a" style={{ width: `${Math.max(4, Math.min(100, row.a))}%` }} /></div>
          <div className="fb-track"><i className="fb-fill fb-fill-b" style={{ width: `${Math.max(4, Math.min(100, row.b))}%` }} /></div>
        </div>
        <em className="fb-gap-chip">差 {row.gap} · {row.level}</em>
      </div>)}
    </div>}
    {page.key === "season" && <div className="fb-data">
      <span className="fb-mono">DATA · 未来五年流年倾向</span>
      {facts.rhythm.map((entry) => <div className="fb-metric" key={entry.year}>
        <label>{entry.year} {entry.ganZhi}</label>
        <div className="fb-track"><i className="fb-fill fb-fill-a" style={{ width: `${Math.max(6, Math.min(100, entry.tendencies[0]?.value ?? 8))}%` }} /></div>
        <em>{entry.tendencies[0] ? `${entry.tendencies[0].label}倾向` : "平稳"}</em>
      </div>)}
    </div>}
    <div className="fb-essay-tag">评述 · 基于 FATE 模型 2.0</div>
    <p className="fb-essay">{digest.pages[page.key].essay}</p>
    <div className="fb-aside">
      <div><small>{ADVICE_LABEL[page.key]}</small><p>{digest.pages[page.key].advice}</p></div>
    </div>
  </section>;

  return <section className="fate-book">
    <nav className="fb-pagenav">
      {PAGES.map((page) => <a key={page.key} className={`fb-c-${page.key}`} href={`#duo-${page.key}`}><b>{page.no}</b>{page.cn}</a>)}
    </nav>
    <section className="fb-cover">
      <span className="fb-mono">FATE° · 双人深度解读报告 · {facts.relationType}</span>
      <h1>{digest.headline}</h1>
      <div className="fb-meta">
        <div><small>{pa.name}</small><strong>{pa.dayPillar}日主 · {pa.strength}</strong></div>
        <div><small>{pb.name}</small><strong>{pb.dayPillar}日主 · {pb.strength}</strong></div>
        <div><small>章节</small><strong>伍章成册</strong></div>
      </div>
    </section>
    {renderPage(PAGES[0])}
    <div className={unlocked ? "" : "fb-locked"}>
      <div className={unlocked ? "" : "fb-blur"}>
        {PAGES.slice(1).map(renderPage)}
      </div>
      {!unlocked && <div className="fb-unlock"><button className="fb-cta">解锁贰至伍章</button></div>}
    </div>
    <div className="fb-note">本报告内容基于 FATE 模型 2.0 得出 · 图表数据可在关系剧本各章逐条对账 · 不作吉凶断言</div>
  </section>;
}
