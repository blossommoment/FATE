import { randomUUID } from "node:crypto";
import { analyzeBirth, validateBirth } from "./fate";
import { translateBatch } from "./duoGenerate";
import { buildDeepReportPdf } from "./deepReportPdf";
import type { BirthInput, UserProfile } from "./types";

// 单人深度报告管线：纯规则引擎（零 AI）→ 中文秒出；英文加一次翻译（调用方选语言，单语言输出）。

export type DeepReportInput = { birth: BirthInput; lang: "zh" | "en" };

export function validateDeepInput(body: unknown): { input?: DeepReportInput; error?: string } {
  const raw = body as { birth?: BirthInput; lang?: string } | null;
  if (!raw?.birth) return { error: "需要 birth 出生信息（year/month/day/hour[/minute/gender/calendarType/name]）。" };
  const err = validateBirth(raw.birth);
  if (err) return { error: `birth 无效：${err}` };
  const lang = raw.lang === "en" ? "en" : "zh";
  return { input: { birth: raw.birth, lang } };
}

// 收集单人报告里所有需翻译的中文散文字段（十神/五行/长生等命理术语在渲染层已中英对照，此处只翻散文）
function collectProse(p: UserProfile): string[] {
  const set = new Set<string>();
  const add = (s?: string) => { const t = (s ?? "").trim(); if (t) set.add(t); };
  add(p.archetype);
  add(p.combinedPersona.name); add(p.combinedPersona.summary);
  add(p.dominantPersona.name); add(p.dominantPersona.drive);
  p.energy.dayMaster.reasons.forEach(add);
  p.energy.trace.forEach((t) => add(t.note));
  p.tenGodAnalysis.forEach((g) => add(g.label));
  p.deepAnalysis.forEach((d) => { add(d.category); add(d.label); add(d.descriptor); add(d.evidence[0]); });
  p.identityTags.forEach(add);
  p.bazi.pillars.forEach((pl) => add(pl.stage));
  return [...set];
}

// 用翻译表做浅层替换，产出英文渲染用 profile（命理 glyph 字段保持原样）
function translateProfile(p: UserProfile, map: Map<string, string>): UserProfile {
  const tr = (s: string) => map.get(s.trim()) || s;
  return {
    ...p,
    archetype: tr(p.archetype),
    combinedPersona: { name: tr(p.combinedPersona.name), summary: tr(p.combinedPersona.summary) },
    dominantPersona: { ...p.dominantPersona, name: tr(p.dominantPersona.name), drive: tr(p.dominantPersona.drive) },
    energy: {
      ...p.energy,
      dayMaster: { ...p.energy.dayMaster, reasons: p.energy.dayMaster.reasons.map(tr) },
      trace: p.energy.trace.map((t) => ({ ...t, note: t.note ? tr(t.note) : t.note })),
    },
    tenGodAnalysis: p.tenGodAnalysis.map((g) => ({ ...g, label: tr(g.label) })),
    deepAnalysis: p.deepAnalysis.map((d) => ({ ...d, category: tr(d.category) as UserProfile["deepAnalysis"][number]["category"], label: tr(d.label), descriptor: tr(d.descriptor), evidence: d.evidence.map(tr) })),
    identityTags: p.identityTags.map(tr),
    bazi: { ...p.bazi, pillars: p.bazi.pillars.map((pl) => ({ ...pl, stage: tr(pl.stage) })) },
  };
}

export async function buildDeepReport(input: DeepReportInput): Promise<{ reportId: string; pdf: Buffer }> {
  const profile = analyzeBirth(input.birth);
  const reportId = `FATE-D-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

  let rendered = profile;
  if (input.lang === "en") {
    const prose = collectProse(profile);
    const translations = await translateBatch(prose);
    const map = new Map<string, string>();
    prose.forEach((zh, i) => { if (translations[i]) map.set(zh, translations[i]); });
    rendered = translateProfile(profile, map);
  }
  const pdf = await buildDeepReportPdf(rendered, { lang: input.lang, reportId, generatedAt });
  return { reportId, pdf };
}
