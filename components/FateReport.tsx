"use client";

import { useEffect, useState } from "react";
import type { BirthInput } from "@/lib/types";
import { TAG_EXPLAIN, type DigestPayload, type PersonalFacts, type TagHit, type TagMetric } from "@/lib/digest";

// 深度解读报告 · 成册四章（设计稿经用户 2026-07-03 定稿）
// 付费开关：置 true 后封面与感情章可看，贰叁肆章模糊待解锁（预览截断，接支付零返工）
const PAYWALL_ENABLED = false;

type PageKey = "love" | "career" | "social" | "season";
const PAGES: { key: PageKey; no: string; cn: string; en: string }[] = [
  { key: "love", no: "壹", cn: "感情", en: "CHAPTER 01 · LOVE" },
  { key: "career", no: "贰", cn: "事业", en: "CHAPTER 02 · WORK" },
  { key: "social", no: "叁", cn: "人际", en: "CHAPTER 03 · SOCIAL" },
  { key: "season", no: "肆", cn: "时运", en: "CHAPTER 04 · SEASON" },
];

type CachedReport = { digest: DigestPayload; source: "ai" | "fallback"; facts: PersonalFacts };

// 每章数据表征：该章标签的判定指标去重后取前四
function pageMetrics(tags: TagHit[]): TagMetric[] {
  const seen = new Set<string>();
  const out: TagMetric[] = [];
  for (const hit of tags) {
    for (const m of hit.metrics) {
      if (seen.has(m.label)) continue;
      seen.add(m.label);
      out.push(m);
      if (out.length >= 4) return out;
    }
  }
  return out;
}

const TONE_WIDTH: Record<string, number> = { boost: 74, mixed: 52, neutral: 46, drain: 32 };
const TONE_CN: Record<string, string> = { boost: "补", mixed: "间", neutral: "平", drain: "耗" };

export default function FateReport({ birth, profileId }: { birth: BirthInput; profileId: string }) {
  const [result, setResult] = useState<CachedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [unlocked] = useState(!PAYWALL_ENABLED);
  const cacheKey = `fate-report-v3-${profileId}`;

  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) setResult(JSON.parse(cached) as CachedReport);
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
      const data = await res.json() as CachedReport & { profileId: string };
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
      <span className="fb-mono">FATE° · 深度解读报告</span>
      <h3>四章，读懂你自己。</h3>
      <div className="fb-toc-preview">
        {PAGES.map((page) => <span key={page.key} className={`fb-c-${page.key}`}><b>{page.no}</b>{page.cn}</span>)}
      </div>
      <p>感情、事业、人际、时运各一章——每章：你的标签、数据表征、与一段只属于你的评述与建议。生成一次，永久可看。</p>
      <button className="fb-cta" onClick={generate} disabled={loading}>
        {loading ? "正在撰写你的报告…（约一分钟，值得等）" : "生成我的深度解读 · 限免体验"}
      </button>
      <div className="fb-note">{failed ? "生成没有成功，多半是网络原因——稍等片刻再点一次。" : "报告内容基于 FATE 模型 2.0 得出。"}</div>
    </section>;
  }

  const { digest, facts } = result;
  const stampsOf: Record<PageKey, { tag: string; note: string }[]> = {
    love: facts.tags.love.map((h) => ({ tag: h.tag, note: TAG_EXPLAIN[h.tag] ?? "" })),
    career: facts.tags.career.map((h) => ({ tag: h.tag, note: TAG_EXPLAIN[h.tag] ?? "" })),
    social: facts.tags.social.map((h) => ({ tag: h.tag, note: TAG_EXPLAIN[h.tag] ?? "" })),
    season: [
      { tag: `${facts.seasonStamps.phase.tag}`, note: facts.seasonStamps.phase.range || facts.seasonStamps.phase.note },
      { tag: facts.seasonStamps.environment.tag, note: facts.seasonStamps.environment.note },
    ],
  };
  const metricsOf: Record<PageKey, TagMetric[]> = {
    love: pageMetrics(facts.tags.love),
    career: pageMetrics(facts.tags.career),
    social: pageMetrics(facts.tags.social),
    season: [],
  };
  const asidesOf: Record<PageKey, { label: string; text: string }[]> = {
    love: [{ label: "相处建议", text: digest.pages.love.advice }],
    career: [
      { label: "职业方向", text: `${facts.recommendations.vocations.slice(0, 3).map((v) => v.name).join("、")}；副轴加成：${facts.recommendations.vocations[3]?.name ?? facts.secondaryAxis.theme}。` },
      { label: "行业场域", text: facts.recommendations.industries.slice(0, 3).map((v) => v.name).join("、") + "。" },
      { label: "行动建议", text: digest.pages.career.advice },
    ],
    social: [{ label: "人际建议", text: digest.pages.social.advice }],
    season: [
      { label: "环境倾向", text: facts.recommendations.environments.join("；") },
      { label: "当下策略", text: digest.pages.season.advice },
    ],
  };

  const renderPage = (page: typeof PAGES[number]) => <section className={`fb-page fb-p-${page.key}`} id={`fr-${page.key}`} key={page.key}>
    <header><h2><small>{page.en}</small>{page.cn}</h2><span className="fb-no">{page.no}</span></header>
    <div className="fb-stamps">
      {stampsOf[page.key].map((s) => <div className="fb-stamp" key={s.tag}><b>{s.tag}</b><span>{s.note}</span></div>)}
    </div>
    {page.key !== "season" && metricsOf[page.key].length > 0 && <div className="fb-data">
      <span className="fb-mono">DATA · 判定指标（刻度线为标签触发阈值）</span>
      {metricsOf[page.key].map((m) => <div className="fb-metric" key={m.label}>
        <label>{m.label}</label>
        <div className="fb-track">
          <i className="fb-fill" style={{ width: `${Math.max(4, Math.min(100, m.value))}%` }} />
          {typeof m.t === "number" && <i className="fb-tick" data-t={m.t} style={{ left: `${m.t}%` }} />}
        </div>
        <em>{m.value}</em>
      </div>)}
    </div>}
    {page.key === "season" && <div className="fb-data">
      <span className="fb-mono">DATA · 大运补耗（当前段高亮）</span>
      {facts.luckLine.map((step) => <div className={`fb-metric${step.current ? " fb-current" : ""}`} key={step.range}>
        <label>{step.range}{step.current ? " ●" : ""}</label>
        <div className="fb-track"><i className="fb-fill" style={{ width: `${TONE_WIDTH[step.tone] ?? 46}%`, opacity: step.current ? 1 : 0.3 }} /></div>
        <em>{TONE_CN[step.tone] ?? "平"}</em>
      </div>)}
    </div>}
    <div className="fb-essay-tag">评述 · 基于 FATE 模型 2.0</div>
    <p className="fb-essay">{digest.pages[page.key].essay}</p>
    <div className="fb-aside">
      {asidesOf[page.key].map((row) => <div key={row.label}><small>{row.label}</small><p>{row.text}</p></div>)}
    </div>
  </section>;

  return <section className="fate-book">
    <nav className="fb-pagenav">
      {PAGES.map((page) => <a key={page.key} className={`fb-c-${page.key}`} href={`#fr-${page.key}`}><b>{page.no}</b>{page.cn}</a>)}
    </nav>
    <section className="fb-cover">
      <span className="fb-mono">FATE° · 深度解读报告</span>
      <h1>{digest.headline}</h1>
      <div className="fb-meta">
        <div><small>命主</small><strong>{facts.dayPillar}日主</strong></div>
        <div><small>格局</small><strong>{facts.strength.level}{facts.favorable.length ? ` · 喜${facts.favorable.join("")}` : ""}</strong></div>
        <div><small>章节</small><strong>肆章成册</strong></div>
      </div>
    </section>
    {/* 册内目录(2026-07-06 用户拍板:成册报告照样例配目录) */}
    <section className="zx-tocbook zx-corner fb-toc">
      <div className="zx-tvol"><b>册内目录</b><span>CONTENTS · 肆章</span></div>
      {PAGES.map((page) => <a className="zx-titem" key={page.key} href={`#fr-${page.key}`}>
        <div><span className="zx-tname">{page.no} · {page.cn}</span><span className="zx-tdesc">标签印鉴 · 判定指标与阈值 · 长评与建议</span></div>
        <i className="zx-tdots" /><span className="zx-tpg">{page.en}</span>
      </a>)}
    </section>
    {renderPage(PAGES[0])}
    <div className={unlocked ? "" : "fb-locked"}>
      <div className={unlocked ? "" : "fb-blur"}>
        {PAGES.slice(1).map(renderPage)}
      </div>
      {!unlocked && <div className="fb-unlock"><button className="fb-cta">解锁贰 · 叁 · 肆章</button></div>}
    </div>
    <div className="fb-note">本报告内容基于 FATE 模型 2.0 得出 · 图表数据可在深度报告各章逐条对账 · 不作吉凶断言</div>
  </section>;
}
