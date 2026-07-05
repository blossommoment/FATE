"use client";

import { useEffect, useState } from "react";
import type { BirthInput } from "@/lib/types";
import { TAG_EXPLAIN, type DigestPayload, type PersonalFacts, type TagHit, type TagMetric } from "@/lib/digest";

// 深度解读报告 · 成册四章（设计稿经用户 2026-07-03 定稿）
// 付费开关：置 true 后封面与感情章可看，贰叁肆章模糊待解锁（预览截断，接支付零返工）
const PAYWALL_ENABLED = false;

type PageKey = "love" | "career" | "social" | "season";
const PAGES: { key: PageKey; no: string; cn: string; en: string }[] = [
  { key: "love", no: "贰", cn: "感情", en: "CHAPTER 02 · LOVE" },
  { key: "career", no: "叁", cn: "事业", en: "CHAPTER 03 · WORK" },
  { key: "social", no: "肆", cn: "人际", en: "CHAPTER 04 · SOCIAL" },
  { key: "season", no: "伍", cn: "时运", en: "CHAPTER 05 · SEASON" },
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

// ---- 第壹章 性情:规则引擎直出(无 AI),匹配推荐只谈倾向不作断言 ----
function natureLine(f: PersonalFacts): string {
  const k = f.keyScores;
  const bits: string[] = [];
  if (k.autonomy >= 60) bits.push("自留地要够大");
  if (k.dependency >= 60) bits.push("在乎回应的温度");
  if (k.novelty >= 60) bits.push("对新鲜事来者不拒");
  if (k.resilience >= 60) bits.push("压力之下反而站得稳");
  if (k.vigilance >= 60) bits.push("信任要一层层给");
  if (!bits.length) bits.push("节奏平顺,不走极端");
  return bits.slice(0, 3).join(",") + "。";
}
function matchAdvice(f: PersonalFacts): string {
  const map: Record<string, string> = {
    安全型: "大多数依恋类型都接得住你;和同为安全型的人在一起,升温最省力。",
    焦虑型: "回应稳定、说到做到的人最能接住你——若即若离只会放大你的耗电。",
    回避型: "不追问、给空间的人和你最合拍——查岗式的热情只会把你越推越远。",
  };
  return map[f.attachment] ?? map["安全型"];
}
function matchTags(f: PersonalFacts): { tag: string; why: string }[] {
  const k = f.keyScores;
  const out: { tag: string; why: string }[] = [];
  out.push(k.initiative < 50
    ? { tag: "会主动的人", why: "你的推进偏内敛,先递话的人省你半程" }
    : { tag: "接得住热情的人", why: "你惯于先手推进,对面要接得住节奏" });
  if (k.autonomy >= 60) out.push({ tag: "给空间的人", why: "你的自留地大,不查岗是基本修养" });
  if (k.dependency >= 60) out.push({ tag: "回应及时的人", why: "你在乎回应的温度,秒回的人天然加分" });
  out.push(k.novelty >= 60
    ? { tag: "能一起折腾的人", why: "你的新鲜感需求高,同频折腾才不腻" }
    : { tag: "把日子过稳的人", why: "你的节奏求稳,细水长流最合拍" });
  if (k.conflictExpression < 45) out.push({ tag: "愿意先开口的人", why: "你冲突时偏静音,对面先开口能救场" });
  return out.slice(0, 4);
}
// 一句话评价:取四维最高与最低,拼出厂布局
const QUAD_PHRASE: Record<string, { high: string; low: string }> = {
  外向表达: { high: "场子热得起来", low: "话不多,但都在点上" },
  情绪稳定: { high: "情绪的锚比多数人沉", low: "感受来得快去得也快" },
  边界控制: { high: "边界划得清清楚楚", low: "边界随缘,看人下菜" },
  情感感知: { high: "是别人情绪的雷达", low: "钝感是你的护甲" },
};
function quadVerdict(f: PersonalFacts): string {
  const quad: [string, number][] = [["外向表达", f.personality.extroversion], ["情绪稳定", f.personality.stability], ["边界控制", f.personality.control], ["情感感知", f.personality.emotion]];
  const sorted = [...quad].sort((a, b) => b[1] - a[1]);
  const top = sorted[0], low = sorted[sorted.length - 1];
  return `${QUAD_PHRASE[top[0]].high};${QUAD_PHRASE[low[0]].low}——这是你的出厂布局。`;
}

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
      <a className="fb-c-nature" href="#fr-nature"><b>壹</b>性情</a>
      {PAGES.map((page) => <a key={page.key} className={`fb-c-${page.key}`} href={`#fr-${page.key}`}><b>{page.no}</b>{page.cn}</a>)}
    </nav>
    <section className="fb-cover">
      <span className="fb-mono">FATE° · 深度解读报告</span>
      <h1>{digest.headline}</h1>
      <div className="fb-meta">
        <div><small>命主</small><strong>{facts.dayPillar}日主</strong></div>
        <div><small>格局</small><strong>{facts.strength.level}{facts.favorable.length ? ` · 喜${facts.favorable.join("")}` : ""}</strong></div>
        <div><small>章节</small><strong>伍章成册</strong></div>
      </div>
    </section>
    {/* 册内目录(2026-07-06 用户拍板:成册报告照样例配目录) */}
    <section className="zx-tocbook zx-corner fb-toc">
      <div className="zx-tvol"><b>册内目录</b><span>CONTENTS · 伍章</span></div>
      <a className="zx-titem" href="#fr-nature">
        <div><span className="zx-tname">壹 · 性情</span><span className="zx-tdesc">主轴人格 · 依恋方式 · 更容易合拍的人</span></div>
        <i className="zx-tdots" /><span className="zx-tpg">CHAPTER 01 · NATURE</span>
      </a>
      {PAGES.map((page) => <a className="zx-titem" key={page.key} href={`#fr-${page.key}`}>
        <div><span className="zx-tname">{page.no} · {page.cn}</span><span className="zx-tdesc">标签印鉴 · 判定指标与阈值 · 长评与建议</span></div>
        <i className="zx-tdots" /><span className="zx-tpg">{page.en}</span>
      </a>)}
    </section>
    {/* 第壹章 · 性情(规则引擎直出) */}
    <section className="fb-page fb-p-nature" id="fr-nature">
      <header><h2><small>CHAPTER 01 · NATURE</small>性情</h2><span className="fb-no">壹</span></header>
      <div className="fb-stamps">
        <div className="fb-stamp"><b>{facts.dominantAxis.god}主轴</b><span>{facts.dominantAxis.theme}</span></div>
        <div className="fb-stamp"><b>{facts.attachment}依恋</b><span>关系中的安全感来源</span></div>
        <div className="fb-stamp"><b>{facts.strength.level}</b><span>{facts.favorable.length ? `喜${facts.favorable.join("、")}` : "喜忌不显,自成节奏"}</span></div>
      </div>
      <div className="fb-data">
        <span className="fb-mono">DATA · 性情四维</span>
        {([["外向表达", facts.personality.extroversion], ["情绪稳定", facts.personality.stability], ["边界控制", facts.personality.control], ["情感感知", facts.personality.emotion]] as [string, number][]).map(([label, value]) => <div className="fb-metric" key={label}>
          <label>{label}</label>
          <div className="fb-track"><i className="fb-fill" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} /></div>
          <em>{value}</em>
        </div>)}
      </div>
      <div className="fb-essay-tag">性情 · 基于 FATE 模型 2.0</div>
      <p className="fb-essay">主轴落在「{facts.dominantAxis.theme}」,副轴「{facts.secondaryAxis.theme}」在不同场景轮换出面。依恋方式偏{facts.attachment}:{natureLine(facts)}</p>
      <div className="fb-essay-tag">匹配 · 什么样的人接得住你</div>
      <div className="fb-stamps">
        {matchTags(facts).map((m) => <div className="fb-stamp" key={m.tag}><b>{m.tag}</b><span>{m.why}</span></div>)}
      </div>
      <div className="fb-aside">
        <div><small>一句话评价</small><p>{quadVerdict(facts)}</p></div>
        <div><small>更容易合拍的人</small><p>{matchAdvice(facts)}</p></div>
      </div>
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
