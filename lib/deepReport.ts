import { randomUUID } from "node:crypto";
import { analyzeBirth, validateBirth } from "./fate";
import { buildDigestPrompt, buildFallbackDigest, buildPersonaTags, buildPersonalFacts, validateDigestPayload, type PersonaTags } from "./digest";
import { translateBatch } from "./duoGenerate";
import { buildDeepReportPdf, type DeepDigest } from "./deepReportPdf";
import type { BirthInput, UserProfile } from "./types";

// 单人深度报告管线：规则引擎全内容（十二维铺开）+ 后端 DeepSeek 压轴四章评述。
// 中文：AI 生成即出（超时走确定性兜底，不拖垮报告）；英文：全文加一次翻译。语言由调用方选。

export type DeepReportInput = { birth: BirthInput; lang: "zh" | "en" };

export function validateDeepInput(body: unknown): { input?: DeepReportInput; error?: string } {
  const raw = body as { birth?: BirthInput; lang?: string } | null;
  if (!raw?.birth) return { error: "需要 birth 出生信息（year/month/day/hour[/minute/gender/calendarType/name]）。" };
  const err = validateBirth(raw.birth);
  if (err) return { error: `birth 无效：${err}` };
  const lang = raw.lang === "en" ? "en" : "zh";
  return { input: { birth: raw.birth, lang } };
}

// 后端 DeepSeek 生成四章评述；校验不过重试一次；超时/失败走确定性兜底（报告永不因此失败）
async function generatePersonalDigest(facts: ReturnType<typeof buildPersonalFacts>): Promise<DeepDigest> {
  const fallback = buildFallbackDigest(facts) as DeepDigest;
  fallback.source = "fallback";
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return fallback;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const isSiliconFlow = baseUrl.includes("siliconflow.cn");
  const { system, user } = buildDigestPrompt(facts);
  for (let attempt = 0; attempt < 2; attempt++) {
    let content = "";
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, ...(isSiliconFlow ? { enable_thinking: false } : { thinking: { type: "disabled" } }),
          temperature: 0.4, max_tokens: 2400, response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: attempt === 0 ? user : `${user}\n\n（上一次未过校验：四章齐全、正文禁数字禁命理术语、字数达标。请严格重来。）` }],
        }),
        signal: AbortSignal.timeout(attempt === 0 ? 90000 : 60000),
      });
      if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      content = data.choices?.[0]?.message?.content?.trim() ?? "";
    } catch { break; }
    try {
      const parsed = JSON.parse(content.replace(/^```json\s*|```$/g, ""));
      const valid = validateDigestPayload(parsed, facts);
      if (valid) return { source: "ai", headline: valid.headline, pages: valid.pages };
    } catch { /* 重试 */ }
  }
  return fallback;
}

// 收集需翻译的中文散文（命理术语在渲染层已中英对照）
function collectProse(p: UserProfile, digest: DeepDigest): string[] {
  const set = new Set<string>();
  const add = (s?: string) => { const t = (s ?? "").trim(); if (t) set.add(t); };
  add(p.archetype); add(p.combinedPersona.name); add(p.combinedPersona.summary);
  add(p.dominantPersona.name); add(p.dominantPersona.drive);
  p.energy.dayMaster.reasons.forEach(add);
  p.energy.trace.forEach((t) => add(t.note));
  p.tenGodAnalysis.forEach((g) => add(g.label));
  p.deepAnalysis.forEach((d) => {
    add(d.category); add(d.label); add(d.descriptor); d.keywords.forEach(add); add(d.summary);
    d.evidence.forEach(add); add(d.logic.premise); add(d.logic.counterSignal); add(d.logic.realWorldCheck);
    add(d.logic.strength); add(d.logic.blindSpot); d.sceneInsights.forEach((s) => { add(s.title); add(s.text); });
  });
  p.specialtyAnalysis.forEach((s) => { add(s.label); add(s.descriptor); add(s.summary); s.evidence.forEach(add); add(s.caution); });
  p.identityTags.forEach(add);
  // 注：pillar.stage（十二长生）属命理术语，渲染层 stageT 统一中英对照，不进翻译批次
  add(digest.headline);
  (Object.values(digest.pages)).forEach((page) => { add(page.essay); add(page.advice); });
  return [...set];
}

function translateProfile(p: UserProfile, tr: (s: string) => string): UserProfile {
  return {
    ...p, archetype: tr(p.archetype),
    combinedPersona: { name: tr(p.combinedPersona.name), summary: tr(p.combinedPersona.summary) },
    dominantPersona: { ...p.dominantPersona, name: tr(p.dominantPersona.name), drive: tr(p.dominantPersona.drive) },
    energy: { ...p.energy, dayMaster: { ...p.energy.dayMaster, reasons: p.energy.dayMaster.reasons.map(tr) }, trace: p.energy.trace.map((t) => ({ ...t, note: t.note ? tr(t.note) : t.note })) },
    tenGodAnalysis: p.tenGodAnalysis.map((g) => ({ ...g, label: tr(g.label) })),
    deepAnalysis: p.deepAnalysis.map((d) => ({
      ...d, category: tr(d.category) as UserProfile["deepAnalysis"][number]["category"], label: tr(d.label), descriptor: tr(d.descriptor),
      keywords: d.keywords.map(tr), summary: tr(d.summary), evidence: d.evidence.map(tr),
      logic: { ...d.logic, premise: tr(d.logic.premise), counterSignal: tr(d.logic.counterSignal), realWorldCheck: tr(d.logic.realWorldCheck), strength: tr(d.logic.strength), blindSpot: tr(d.logic.blindSpot) },
      sceneInsights: d.sceneInsights.map((s) => ({ ...s, title: tr(s.title), text: tr(s.text) })),
    })),
    specialtyAnalysis: p.specialtyAnalysis.map((s) => ({ ...s, label: tr(s.label), descriptor: tr(s.descriptor), summary: tr(s.summary), evidence: s.evidence.map(tr), caution: tr(s.caution) })),
    identityTags: p.identityTags.map(tr),
    // pillar.stage 保持中文，交给渲染层 stageT 统一对照
  };
}

export async function buildDeepReport(input: DeepReportInput): Promise<{ reportId: string; pdf: Buffer }> {
  const profile = analyzeBirth(input.birth);
  const facts = buildPersonalFacts(profile);
  const reportId = `FATE-D-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

  let digest = await generatePersonalDigest(facts);
  let tags = buildPersonaTags(profile);
  let rendered = profile;

  if (input.lang === "en") {
    // 翻译池含综合评定标签名与指标 label
    const tagStrings = new Set<string>();
    (Object.values(tags) as PersonaTags[keyof PersonaTags][]).forEach((hits) => hits.forEach((h) => { tagStrings.add(h.tag); h.metrics.forEach((m) => tagStrings.add(m.label)); }));
    const prose = [...collectProse(profile, digest), ...tagStrings];
    const translations = await translateBatch(prose);
    const map = new Map<string, string>();
    prose.forEach((zh, i) => { if (translations[i]) map.set(zh, translations[i]); });
    const tr = (s: string) => map.get((s ?? "").trim()) || s;
    rendered = translateProfile(profile, tr);
    tags = Object.fromEntries(Object.entries(tags).map(([k, hits]) => [k, hits.map((h) => ({ tag: tr(h.tag), metrics: h.metrics.map((m) => ({ ...m, label: tr(m.label) })) }))])) as PersonaTags;
    digest = { source: digest.source, headline: tr(digest.headline), pages: {
      nature: { essay: tr(digest.pages.nature.essay), advice: tr(digest.pages.nature.advice) },
      love: { essay: tr(digest.pages.love.essay), advice: tr(digest.pages.love.advice) },
      career: { essay: tr(digest.pages.career.essay), advice: tr(digest.pages.career.advice) },
      social: { essay: tr(digest.pages.social.essay), advice: tr(digest.pages.social.advice) },
      season: { essay: tr(digest.pages.season.essay), advice: tr(digest.pages.season.advice) },
    } };
  }

  const pdf = await buildDeepReportPdf(rendered, { lang: input.lang, reportId, generatedAt, digest, tags });
  return { reportId, pdf };
}
