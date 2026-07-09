"use client";

import { useEffect, useState } from "react";
import type { BirthInput } from "@/lib/types";
import { TAG_EXPLAIN, matchTags, type DigestPayload, type PersonalFacts, type TagHit, type TagMetric } from "@/lib/digest";

// 深度解读报告 · 成册六章（2026-07-03 定稿；07-08 补性情章；07-09 补结构流年章）
// 付费墙（2026-07-09 用户拍板开启）：前两章（壹性情/贰感情）免费，叁肆伍锁——锁章正文服务端截断，
// 解锁码兑换 token 后重取全文（服务端缓存命中，秒出）；解锁权益含 30 页命书 PDF 下载。
const PAYWALL_ENABLED = true;
const PRICE_TEXT = "¥19.9";
const SHOP_URL = process.env.NEXT_PUBLIC_UNLOCK_SHOP_URL ?? "";

type PageKey = "love" | "career" | "social" | "season";
const PAGES: { key: PageKey; no: string; cn: string; en: string }[] = [
  { key: "love", no: "贰", cn: "感情", en: "CHAPTER 02 · LOVE" },
  { key: "career", no: "叁", cn: "事业", en: "CHAPTER 03 · WORK" },
  { key: "social", no: "肆", cn: "人际", en: "CHAPTER 04 · SOCIAL" },
  { key: "season", no: "伍", cn: "时运", en: "CHAPTER 05 · SEASON" },
];

type CachedReport = { digest: DigestPayload; source: "ai" | "fallback"; facts: PersonalFacts; unlocked?: boolean };

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

// ---- 第壹章 性情:匹配标签规则直出(逻辑挪至 lib/digest.ts matchTags,与 PDF 共用) ----
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
  const [codeInput, setCodeInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const cacheKey = `fate-report-v6-${profileId}`; // v6:加第陆章结构流年(2026-07-09)
  const tokenKey = `fate-unlock-${profileId}`;
  const unlocked = !PAYWALL_ENABLED || !!result?.unlocked;

  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) setResult(JSON.parse(cached) as CachedReport);
      else setResult(null);
    } catch { setResult(null); }
  }, [cacheKey]);

  const readToken = () => { try { return localStorage.getItem(tokenKey) ?? undefined; } catch { return undefined; } };

  const generate = async (tokenOverride?: string) => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...birth, unlockToken: tokenOverride ?? readToken() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as CachedReport & { profileId: string };
      const next = { digest: data.digest, source: data.source, facts: data.facts, unlocked: data.unlocked };
      setResult(next);
      try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* 缓存失败不影响本次展示 */ }
    } catch {
      setFailed(true);
    }
    setLoading(false);
  };

  // 兑换解锁码：成功后带 token 重取——服务端评述已缓存，秒出全文
  const redeem = async () => {
    if (!codeInput.trim()) { setRedeemError("请输入解锁码。"); return; }
    setRedeeming(true);
    setRedeemError("");
    try {
      const res = await fetch("/api/unlock/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput, birth }),
      });
      const data = await res.json() as { token?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error || "解锁失败，请稍后重试。");
      try { localStorage.setItem(tokenKey, data.token); } catch { /* 存不了 token 也先解锁本次 */ }
      await generate(data.token);
    } catch (error) {
      setRedeemError(error instanceof Error ? error.message : "解锁失败，请稍后重试。");
    }
    setRedeeming(false);
  };

  if (!result) {
    return <section className="fate-book fate-book-intro">
      <span className="fb-mono">FATE° · 深度解读报告</span>
      <h3>六章，读懂你自己。</h3>
      <div className="fb-toc-preview">
        <span className="fb-c-nature"><b>壹</b>性情</span>
        {PAGES.map((page) => <span key={page.key} className={`fb-c-${page.key}`}><b>{page.no}</b>{page.cn}</span>)}
        <span className="fb-c-structure"><b>陆</b>结构流年</span>
      </div>
      <p>性情、感情、事业、人际、时运、结构流年各一章——每章：你的标签、数据表征、与一段只属于你的评述与建议。免费预览目录，解锁读全册，另含 30 页命书 PDF。</p>
      <button className="fb-cta" onClick={() => generate()} disabled={loading}>
        {loading ? "正在撰写你的报告…（约一分钟，值得等）" : "生成我的深度解读"}
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
      <a className="fb-c-structure" href="#fr-structure"><b>陆</b>结构</a>
    </nav>
    <section className="fb-cover">
      <span className="fb-mono">FATE° · 深度解读报告</span>
      <h1>{digest.headline}</h1>
      <div className="fb-meta">
        <div><small>命主</small><strong>{facts.dayPillar}日主</strong></div>
        <div><small>格局</small><strong>{facts.strength.level}{facts.favorable.length ? ` · 喜${facts.favorable.join("")}` : ""}</strong></div>
        <div><small>章节</small><strong>陆章成册</strong></div>
      </div>
    </section>
    {/* 册内目录(2026-07-06 用户拍板:成册报告照样例配目录) */}
    <section className="zx-tocbook zx-corner fb-toc">
      <div className="zx-tvol"><b>册内目录</b><span>CONTENTS · 陆章</span></div>
      <a className="zx-titem" href="#fr-nature">
        <div><span className="zx-tname">壹 · 性情</span><span className="zx-tdesc">主轴人格 · 依恋方式 · 更容易合拍的人</span></div>
        <i className="zx-tdots" /><span className="zx-tpg">CHAPTER 01 · NATURE</span>
      </a>
      {PAGES.map((page) => <a className="zx-titem" key={page.key} href={`#fr-${page.key}`}>
        <div><span className="zx-tname">{page.no} · {page.cn}</span><span className="zx-tdesc">标签印鉴 · 判定指标与阈值 · 长评与建议</span></div>
        <i className="zx-tdots" /><span className="zx-tpg">{page.en}</span>
      </a>)}
      <a className="zx-titem" href="#fr-structure">
        <div><span className="zx-tname">陆 · 结构流年</span><span className="zx-tdesc">冲合宫位落点 · 今年流年触发 · 深断语</span></div>
        <i className="zx-tdots" /><span className="zx-tpg">CHAPTER 06 · STRUCTURE</span>
      </a>
    </section>
    {/* 付费墙（2026-07-09 用户拍板收紧）：成册免费只看封面与目录，壹-伍章全部上锁 */}
    <div className={unlocked ? "" : "fb-locked"}>
      <div className={unlocked ? "" : "fb-blur"}>
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
      <div className="fb-essay-tag">评述 · 基于 FATE 模型 2.0</div>
      <p className="fb-essay">{digest.pages.nature.essay}</p>
      <div className="fb-essay-tag">匹配 · 什么样的人接得住你</div>
      <div className="fb-stamps">
        {matchTags(facts).map((m) => <div className="fb-stamp" key={m.tag}><b>{m.tag}</b><span>{m.why}</span></div>)}
      </div>
      <div className="fb-aside">
        <div><small>一句话评价</small><p>{quadVerdict(facts)}</p></div>
        <div><small>更容易合拍的人</small><p>{digest.pages.nature.advice}</p></div>
      </div>
    </section>
        {PAGES.map(renderPage)}
    {/* 第陆章 · 结构流年(引擎深化事实 + AI 深断语,2026-07-09 用户拍板) */}
    <section className="fb-page fb-p-structure" id="fr-structure">
      <header><h2><small>CHAPTER 06 · STRUCTURE</small>结构流年</h2><span className="fb-no">陆</span></header>
      <div className="fb-stamps">
        {facts.structure.points.length
          ? facts.structure.points.map((point) => <div className="fb-stamp" key={point.title}><b>{point.type} · {point.title}</b><span>{[...point.palaces, ...point.keynotes.slice(0, 1)].join(" · ") || "结构落点"}</span></div>)
          : <div className="fb-stamp"><b>原局无强冲合</b><span>底盘干净,起伏更多来自现实安排</span></div>}
      </div>
      <div className="fb-essay-tag">评述 · 基于 FATE 模型 2.0</div>
      <p className="fb-essay">{digest.pages.structure.essay}</p>
      <div className="fb-essay-tag">今年 · {facts.structure.thisYear.ganZhi} 流年触发</div>
      <div className="fb-stamps">
        {facts.structure.thisYear.hits.length
          ? facts.structure.thisYear.hits.map((hit) => <div className="fb-stamp" key={hit.title}><b>{hit.title}</b><span>{hit.scene.slice(0, 38)}…</span></div>)
          : <div className="fb-stamp"><b>无强触发</b><span>这一年的节奏更多由现实安排决定</span></div>}
      </div>
      <div className="fb-aside">
        <div><small>当下应对</small><p>{digest.pages.structure.advice}</p></div>
      </div>
    </section>
      </div>
      {!unlocked && <div className="fb-unlock">
        <div className="fb-unlock-card">
          <b>解锁全册六章评述</b>
          <span>性情 · 感情 · 事业 · 人际 · 时运 · 结构流年完整长评与建议，另含 30 页命书 PDF 下载 · {PRICE_TEXT}</span>
          <div className="fb-unlock-row">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="输入解锁码 FATE-XXXX…"
              spellCheck={false}
            />
            <button className="fb-cta" onClick={redeem} disabled={redeeming}>{redeeming ? "验证中…" : "解锁"}</button>
          </div>
          {SHOP_URL
            ? <a href={SHOP_URL} target="_blank" rel="noreferrer">获取解锁码 · {PRICE_TEXT}</a>
            : <span className="fb-unlock-tip">解锁码获取入口即将开放</span>}
          {redeemError && <span className="fb-unlock-err">{redeemError}</span>}
        </div>
      </div>}
    </div>
    <div className="fb-note">本报告内容基于 FATE 模型 2.0 得出 · 图表数据可在深度报告各章逐条对账 · 不作吉凶断言</div>
  </section>;
}
