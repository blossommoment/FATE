import { randomUUID } from "node:crypto";
import { analyzeBirth, analyzeDuoRhythm, analyzeRelationship } from "./fate";
import { buildDuoFacts, type DuoDigestPayload, type DuoDomain } from "./duo";
import { buildReportPdf, type BaziChart, type ReportBlock } from "./reportPdf";
import type { BirthInput, UserProfile } from "./types";

const ELEMENT_CN: Record<string, string> = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
const PAGES: { key: DuoDomain; no: string; title: string; en: string }[] = [
  { key: "origin", no: "壹", title: "缘起", en: "Origin" },
  { key: "daily", no: "贰", title: "相处", en: "Daily Life" },
  { key: "friction", no: "叁", title: "摩擦", en: "Friction" },
  { key: "longrun", no: "肆", title: "长线", en: "Long Run" },
  { key: "season", no: "伍", title: "时运", en: "Seasons" },
];

function chartOf(profile: UserProfile, name: string, attachment: string): BaziChart {
  const dayMaster = profile.energy.dayMaster;
  return {
    name,
    dayMaster: `${profile.bazi.dayPillar[0]}${ELEMENT_CN[dayMaster.element] ?? ""}`,
    strength: dayMaster.level,
    favorable: dayMaster.favorable.map((element) => ELEMENT_CN[element] ?? element).join("、"),
    attachment,
    pillars: profile.bazi.pillars.map((pillar) => ({
      label: pillar.label,
      gan: pillar.gan,
      zhi: pillar.zhi,
      tenGod: pillar.tenGod,
      hidden: pillar.hiddenStems.join(""),
      hiddenGods: pillar.hiddenTenGods.join("·"),
      wuXing: pillar.wuXing,
      stage: pillar.stage,
    })),
  };
}

export async function buildDuoPdf(args: {
  a: BirthInput;
  b: BirthInput;
  relationType: string;
  digest: DuoDigestPayload;
}): Promise<{ reportId: string; pdf: Buffer }> {
  const profileA = analyzeBirth(args.a);
  const profileB = analyzeBirth(args.b);
  const analysis = analyzeRelationship(profileA, profileB, args.relationType);
  const facts = buildDuoFacts(profileA, profileB, analysis);
  const names: [string, string] = [facts.persons[0].name, facts.persons[1].name];
  const charts: [BaziChart, BaziChart] = [
    chartOf(profileA, names[0], facts.persons[0].attachment),
    chartOf(profileB, names[1], facts.persons[1].attachment),
  ];
  const blocks: ReportBlock[] = [];
  for (const page of PAGES) {
    blocks.push({ t: "chapter", no: page.no, title: { zh: page.title, en: page.en } });
    blocks.push({ t: "para", text: { zh: args.digest.pages[page.key].essay, en: "" } });
    blocks.push({ t: "do", text: { zh: `一起做：${args.digest.pages[page.key].advice}`, en: "" } });
  }
  blocks.push({ t: "chapter", no: "陆", title: { zh: "关系全景", en: "Relationship Overview" } });
  blocks.push({ t: "para", text: { zh: analysis.spine.thesis, en: "" } });
  blocks.push({
    t: "bars",
    items: analysis.scoreBreakdown.map((item) => ({ label: { zh: item.label, en: "" }, a: item.score, tone: "green" as const })),
  });
  blocks.push({ t: "small", text: { zh: `关系判词：${analysis.guide.verdict.title}。${analysis.guide.verdict.tagline}`, en: "" } });
  blocks.push({ t: "chapter", no: "柒", title: { zh: "未来五年", en: "The Next Five Years" } });
  for (const year of analyzeDuoRhythm(profileA, profileB, args.relationType, new Date().getFullYear(), 5)) {
    blocks.push({ t: "h2", title: { zh: `${year.year} ${year.ganZhi}`, en: "" } });
    blocks.push({ t: "para", text: { zh: year.reading, en: "" } });
    blocks.push({ t: "small", text: { zh: `这一年怎么过：${year.advice}`, en: "" } });
  }
  const reportId = `FATE-DUO-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const pdf = await buildReportPdf({
    meta: {
      reportId,
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
      relationType: args.relationType,
      names,
      verdictTitle: analysis.guide.verdict.title,
      verdictQuip: analysis.guide.verdict.quip,
      disclaimerZh: "免责声明：本报告只用于娱乐与自我认知参考，不构成婚恋、医疗、心理、法律或投资建议，不作任何吉凶祸福的断言或承诺。",
      disclaimerEn: "Disclaimer: This report is for entertainment and self-reflection only. It does not constitute professional advice or make any promise about outcomes.",
    },
    charts,
    toc: [...PAGES.map((page) => ({ no: page.no, zh: page.title, en: page.en })), { no: "陆", zh: "关系全景", en: "Relationship Overview" }, { no: "柒", zh: "未来五年", en: "The Next Five Years" }],
    blocks,
  });
  return { reportId, pdf };
}
