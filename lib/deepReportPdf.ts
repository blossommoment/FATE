import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import type { UserProfile } from "./types";
import type { PersonaTags } from "./digest";

// 单人深度报告 PDF：把命理算法如实亮出来——五行力量占比+计分痕迹、十神分布+出处、
// 日主强弱推导、十二维深度。全部规则引擎数据（零 AI，秒出），彩色标注让人信服"有真东西"。
// 语言由调用方选（lang），单语言输出。

const HEI = ["", "C:\\Windows\\Fonts\\simhei.ttf"].map((c) => c || (process.env.FATE_PDF_FONT_HEI ?? ""));
const KAI = ["", "C:\\Windows\\Fonts\\simkai.ttf", "C:\\Windows\\Fonts\\simhei.ttf"].map((c, i) => i === 0 ? (process.env.FATE_PDF_FONT_KAI ?? "") : c);

const INK = "#26241d", SUB = "#5f5b50", FAINT = "#9a9587", CINNABAR = "#a5402e", LINE = "#ddd8c9", CARD = "#f6f3ea", TRACK = "#eae7db";

// 五行配色（传统色系）+ 中英名
const EL_COLOR: Record<string, string> = { wood: "#4f9d6b", fire: "#c85a4c", earth: "#c39a4e", metal: "#b0862f", water: "#4a7fb0" };
const EL_ZH: Record<string, string> = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
const EL_EN: Record<string, string> = { wood: "Wood", fire: "Fire", earth: "Earth", metal: "Metal", water: "Water" };
const EL_ORDER = ["wood", "fire", "earth", "metal", "water"] as const;

const GAN_EL: Record<string, string> = { 甲: "wood", 乙: "wood", 丙: "fire", 丁: "fire", 戊: "earth", 己: "earth", 庚: "metal", 辛: "metal", 壬: "water", 癸: "water" };
const ZHI_EL: Record<string, string> = { 寅: "wood", 卯: "wood", 巳: "fire", 午: "fire", 辰: "earth", 戌: "earth", 丑: "earth", 未: "earth", 申: "metal", 酉: "metal", 子: "water", 亥: "water" };

// 十神 → 五类 → 配色
const GOD_CAT: Record<string, { cat: string; catEn: string; color: string }> = {
  比肩: { cat: "比劫", catEn: "Peer", color: "#7d8a72" }, 劫财: { cat: "比劫", catEn: "Peer", color: "#7d8a72" },
  食神: { cat: "食伤", catEn: "Output", color: "#4f9d6b" }, 伤官: { cat: "食伤", catEn: "Output", color: "#4f9d6b" },
  正财: { cat: "财星", catEn: "Wealth", color: "#c39a4e" }, 偏财: { cat: "财星", catEn: "Wealth", color: "#c39a4e" },
  正官: { cat: "官杀", catEn: "Authority", color: "#c85a4c" }, 七杀: { cat: "官杀", catEn: "Authority", color: "#c85a4c" },
  正印: { cat: "印星", catEn: "Resource", color: "#4a7fb0" }, 偏印: { cat: "印星", catEn: "Resource", color: "#4a7fb0" },
};

const T = (lang: "zh" | "en", zh: string, en: string) => lang === "en" ? en : zh;
const levelOf = (v: number) => v >= 82 ? "强倾向" : v >= 65 ? "偏高" : v >= 45 ? "中段" : v >= 28 ? "偏低" : "弱倾向";

type ChapterText = { essay: string; advice: string };
export type DeepDigest = { source: "ai" | "fallback"; headline: string; pages: { love: ChapterText; career: ChapterText; social: ChapterText; season: ChapterText } };

export function buildDeepReportPdf(profile: UserProfile, opts: { lang: "zh" | "en"; reportId: string; generatedAt: string; digest?: DeepDigest; tags?: PersonaTags }): Promise<Buffer> {
  const lang = opts.lang;
  const hei = HEI.find((c) => c && existsSync(c));
  const kai = KAI.find((c) => c && existsSync(c));
  if (!hei) throw new Error("未找到中文字体 simhei.ttf");

  const doc = new PDFDocument({ size: "A4", margins: { top: 62, bottom: 70, left: 60, right: 60 }, bufferPages: true, autoFirstPage: false, info: { Title: `FATE Deep Report ${opts.reportId}` } });
  doc.registerFont("hei", hei); doc.registerFont("kai", kai ?? hei); doc.registerFont("en", hei);
  doc.font("hei");
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("data", (c: Buffer) => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });

  const PW = 595.28, PH = 841.89, ML = 60, W = PW - 120;
  const BG = "#f6f1e4"; // 暖宣纸底
  // 每页自动铺暖底 + 顶部朱砂细条（pageAdded 在内容前触发）
  doc.on("pageAdded", () => { doc.rect(0, 0, PW, PH).fill(BG); doc.rect(0, 0, PW, 5).fill(CINNABAR); doc.fillColor(INK); });
  const ensure = (n: number) => { if (doc.y + n > PH - 78) doc.addPage(); };
  const mono = (s: string) => { doc.font("en").fontSize(7.5).fillColor(FAINT).text(s.toUpperCase(), ML, doc.y, { width: W, characterSpacing: 1.3 }); doc.moveDown(0.3); };
  const chapter = (zh: string, en: string) => { if (doc.y > 96) doc.addPage(); mono(en); const y = doc.y; doc.font("kai").fontSize(23).fillColor(CINNABAR).text(zh, ML, y, { width: W }); doc.moveDown(0.15); doc.font("en").fontSize(10.5).fillColor(GOLD).text(en, ML, doc.y, { width: W }); doc.moveDown(0.4); doc.moveTo(ML, doc.y).lineTo(ML + W, doc.y).lineWidth(1).strokeColor(CINNABAR).stroke(); doc.moveDown(0.55); };
  const h2 = (s: string) => { ensure(42); doc.font("kai").fontSize(15).fillColor(INK).text(s, ML, doc.y, { width: W }); doc.moveDown(0.4); };
  const para = (s: string, color = INK, size = 11) => { ensure(36); doc.font("hei").fontSize(size).fillColor(color).text(s, ML, doc.y, { width: W, lineGap: 4.5 }); doc.moveDown(0.45); };
  const GOLD = "#bf9a4e";

  // 通用彩色横条：label + 轨道 + 值，颜色自定
  const colorBar = (label: string, value: number, max: number, color: string, opts2: { note?: string; labelW?: number } = {}) => {
    ensure(18);
    const y = doc.y, lw = opts2.labelW ?? 96, barLeft = ML + lw, barW = W - lw - 64;
    doc.font("hei").fontSize(9.5).fillColor(SUB).text(label, ML, y + 1, { width: lw - 6, lineBreak: false });
    doc.roundedRect(barLeft, y + 2, barW, 7, 3).fillColor(TRACK).fill();
    doc.roundedRect(barLeft, y + 2, Math.max(4, barW * value / (max || 1)), 7, 3).fillColor(color).fill();
    doc.font("en").fontSize(8.5).fillColor(color).text(value.toFixed(1).replace(/\.0$/, ""), barLeft + barW + 6, y, { width: 30, lineBreak: false });
    if (opts2.note) doc.font("hei").fontSize(7.5).fillColor(FAINT).text(opts2.note, barLeft + barW + 40, y + 1, { width: 24, lineBreak: false });
    doc.x = ML; doc.y = y + 15;
  };

  // 关键词 chips
  const chips = (tags: string[], color = CINNABAR) => {
    ensure(20); let tx = ML;
    tags.forEach((tag) => {
      const tw = doc.font("hei").fontSize(8.5).widthOfString(tag) + 14;
      if (tx + tw > ML + W) { tx = ML; doc.y += 19; ensure(19); }
      doc.roundedRect(tx, doc.y, tw, 14, 4).fillColor(CARD).fill();
      doc.fillColor(color).fontSize(8.5).text(tag, tx + 7, doc.y + 2.5, { lineBreak: false });
      tx += tw + 5;
    });
    doc.x = ML; doc.y += 22;
  };

  // 带彩色小标签的一段：标签内联，正文接排成一段（字号可调）
  const labeled = (tag: string, text: string, color = CINNABAR, size = 11) => {
    if (!text) return;
    ensure(26);
    doc.font("hei").fontSize(size).fillColor(color).text(`${tag}　`, ML, doc.y, { width: W, continued: true });
    doc.font("hei").fontSize(size).fillColor(SUB).text(text, { width: W, lineGap: 4.5 });
    doc.moveDown(0.45); doc.x = ML;
  };

  // ── 封面 ──────────────────────────────────
  doc.addPage();
  doc.y = 150;
  doc.font("en").fontSize(9).fillColor(CINNABAR).text("FATE° · EASTERN PERSONA MODELING", ML, doc.y, { width: W, align: "center", characterSpacing: 2 });
  doc.moveDown(1.4);
  doc.font("kai").fontSize(38).fillColor(INK).text(T(lang, "深度人格报告", "Deep Persona Report"), ML, doc.y, { width: W, align: "center" });
  doc.moveDown(2);
  const name = profile.birth.name ?? "命主";
  const dayEl = profile.energy.dayMaster.element;
  doc.font("hei").fontSize(14).fillColor(INK).text(name, ML, doc.y, { width: W, align: "center" });
  doc.font("hei").fontSize(11).fillColor(SUB).text(`${T(lang, "日主", "Day Master")} ${profile.bazi.dayPillar[0]}${EL_ZH[dayEl]} · ${profile.energy.dayMaster.level} · ${profile.archetype}`, ML, doc.y, { width: W, align: "center" });
  doc.moveDown(1.4);
  doc.font("kai").fontSize(12).fillColor(SUB).text(profile.combinedPersona.name, ML + 40, doc.y, { width: W - 80, align: "center", lineGap: 4 });
  doc.y = PH - 120;
  doc.font("en").fontSize(8.5).fillColor(FAINT).text(`${opts.reportId}   ·   ${opts.generatedAt}`, ML, doc.y, { width: W, align: "center" });

  const secAssessment = () => {
  // ── 综合评定（第二页：四域标签 + 分数 + 阈值刻度）──
  if (opts.tags) {
    const domains: [keyof PersonaTags, string, string, string][] = [
      ["love", "感情", "Love", "#c96f7d"], ["career", "事业", "Career", "#bf9a4e"],
      ["social", "人际", "Social", "#4f9d6b"], ["energy", "能量·时运", "Energy", "#4a7fb0"],
    ];
    chapter(T(lang, "综合评定", "Overall Assessment"), "Persona Tags at a Glance");
    para(T(lang, "把命盘一次性读成四个领域的人话标签，每个标签下方给出触发它的指标分数——刻度线是命中阈值，条越过线，标签才成立。", "The chart read at a glance into tags across four domains. Under each tag are the metric scores that triggered it — the tick marks the threshold; the bar crossing it is why the tag holds."), SUB, 10);
    doc.moveDown(0.2);
    for (const [key, zh, en, color] of domains) {
      const hits = opts.tags[key];
      if (!hits?.length) continue;
      ensure(30);
      doc.font("kai").fontSize(14).fillColor(color).text(T(lang, zh, en), ML, doc.y, { width: W });
      doc.moveDown(0.3);
      for (const hit of hits) {
        ensure(20 + hit.metrics.length * 15);
        // 标签名（药丸）
        const tw = doc.font("hei").fontSize(10.5).widthOfString(hit.tag) + 18;
        doc.roundedRect(ML, doc.y, tw, 17, 5).fillColor(color).fill();
        doc.fillColor("#fff").fontSize(10.5).text(hit.tag, ML + 9, doc.y + 3, { lineBreak: false });
        doc.x = ML; doc.y += 22;
        // 指标条（带阈值刻度）
        for (const m of hit.metrics) {
          ensure(15); const y = doc.y, lw = 96, barLeft = ML + lw, barW = W - lw - 40;
          doc.font("hei").fontSize(9).fillColor(SUB).text(m.label, ML + 8, y + 1, { width: lw - 12, lineBreak: false });
          doc.roundedRect(barLeft, y + 2, barW, 6, 3).fillColor(TRACK).fill();
          doc.roundedRect(barLeft, y + 2, Math.max(4, barW * Math.min(100, m.value) / 100), 6, 3).fillColor(color).fill();
          if (m.t !== undefined) { const tx = barLeft + barW * Math.min(100, m.t) / 100; doc.moveTo(tx, y).lineTo(tx, y + 10).lineWidth(1).strokeColor(INK).stroke(); }
          doc.font("en").fontSize(8.5).fillColor(color).text(String(m.value), barLeft + barW + 6, y, { width: 30, lineBreak: false });
          doc.x = ML; doc.y = y + 14;
        }
        doc.moveDown(0.25);
      }
      doc.moveDown(0.2);
    }
  }

  };

  const secChart = () => {
  // ── 壹 四柱命盘 ──────────────────────────────
  chapter(T(lang, "四柱命盘", "The Four Pillars"), "The Natal Chart");
  para(T(lang, "四柱是全部推算的起点。天干地支各自属五行，颜色即其五行归属——一眼看出这张盘由什么能量构成。", "The four pillars are the starting point of every calculation. Each stem and branch carries one of the five elements; the colour is that element."), SUB, 9.5);
  const pillars = profile.bazi.pillars;
  const colW = W / 4, tableY = doc.y + 6;
  const rows: [string, string, (i: number) => { text: string; color?: string }][] = [
    [T(lang, "天干", "Stem"), "", (i) => ({ text: pillars[i].gan, color: EL_COLOR[GAN_EL[pillars[i].gan]] })],
    [T(lang, "地支", "Branch"), "", (i) => ({ text: pillars[i].zhi, color: EL_COLOR[ZHI_EL[pillars[i].zhi]] })],
    [T(lang, "十神", "Ten God"), "", (i) => ({ text: pillars[i].tenGod })],
    [T(lang, "藏干", "Hidden"), "", (i) => ({ text: pillars[i].hiddenStems.join("") })],
    [T(lang, "长生", "Stage"), "", (i) => ({ text: pillars[i].stage })],
  ];
  // 柱头
  pillars.forEach((p, i) => { doc.font("hei").fontSize(9).fillColor(CINNABAR).text(p.label, ML + i * colW, tableY, { width: colW, align: "center" }); });
  let ry = tableY + 18;
  rows.forEach(([label, , val], ri) => {
    doc.font("hei").fontSize(8).fillColor(FAINT).text(label, ML, ry + 5, { width: 40 });
    pillars.forEach((_, i) => { const c = val(i); doc.font(ri < 2 ? "kai" : "hei").fontSize(ri < 2 ? 20 : 9.5).fillColor(c.color ?? INK).text(c.text, ML + i * colW, ry + (ri < 2 ? 2 : 5), { width: colW, align: "center" }); });
    ry += ri < 2 ? 30 : 18;
  });
  doc.y = ry + 6;

  };

  const secElements = () => {
  // ── 贰 五行力量分布 ──────────────────────────
  chapter(T(lang, "五行力量分布", "Five-Element Power"), "How the Elements Weigh");
  para(T(lang, "把命盘里每个字的力量按五行归堆、归一化成百分比。这不是拍脑袋，下方「测算明细」列出每一分的来源。", "Every character's strength is tallied by element and normalised to a percentage. Not guesswork — the breakdown below lists where every point comes from."), SUB, 9.5);
  const ep = profile.energy.elementPower;
  const epMax = Math.max(...EL_ORDER.map((e) => ep[e]));
  const fav = new Set(profile.energy.dayMaster.favorable);
  const unfav = new Set(profile.energy.dayMaster.unfavorable);
  EL_ORDER.forEach((e) => {
    const mark = fav.has(e) ? T(lang, "喜", "fav") : unfav.has(e) ? T(lang, "忌", "unf") : "";
    colorBar(`${EL_ZH[e]} ${lang === "en" ? EL_EN[e] : ""}`.trim() + `　${ep[e]}%`, ep[e], epMax, EL_COLOR[e], { note: mark, labelW: 120 });
  });
  doc.moveDown(0.4);
  h2(T(lang, "力量测算明细", "Power Breakdown — the Math"));
  para(T(lang, `共 ${profile.energy.trace.length} 条计分记录（节选）：来源 → 五行 → 得分 → 说明。`, `${profile.energy.trace.length} scoring records (excerpt): source → element → points → note.`), FAINT, 8.5);
  profile.energy.trace.slice(0, 12).forEach((tr) => {
    ensure(14); const y = doc.y;
    doc.circle(ML + 4, y + 5, 3).fillColor(EL_COLOR[tr.element]).fill();
    doc.font("hei").fontSize(8.5).fillColor(SUB).text(`${tr.source}`, ML + 14, y + 1, { width: 150, lineBreak: false });
    doc.font("hei").fontSize(8.5).fillColor(EL_COLOR[tr.element]).text(EL_ZH[tr.element], ML + 168, y + 1, { width: 18, lineBreak: false });
    doc.font("en").fontSize(8.5).fillColor(INK).text(`+${tr.points}`, ML + 190, y + 1, { width: 40, lineBreak: false });
    doc.font("hei").fontSize(7.5).fillColor(FAINT).text(tr.note ?? "", ML + 236, y + 1.5, { width: W - 236, lineBreak: false });
    doc.x = ML; doc.y = y + 13;
  });

  };

  const secDayMaster = () => {
  // ── 叁 日主强弱判定 ──────────────────────────
  chapter(T(lang, "日主强弱判定", "Day-Master Strength"), "Strong or Weak — and Why");
  const dm = profile.energy.dayMaster;
  ensure(60);
  const statY = doc.y;
  doc.roundedRect(ML, statY, W, 52, 8).fillColor(CARD).fill();
  doc.font("kai").fontSize(26).fillColor(CINNABAR).text(dm.level, ML + 16, statY + 12, { width: 120 });
  doc.font("hei").fontSize(9).fillColor(SUB).text(`${T(lang, "同党占比", "Self-party ratio")} ${dm.score}%　${dm.rooted ? T(lang, "· 有根", "· rooted") : T(lang, "· 无根", "· rootless")}　${T(lang, "置信", "conf.")} ${dm.confidence}`, ML + 150, statY + 14, { width: W - 160 });
  // 喜忌 chips
  let chipX = ML + 150, chipY = statY + 30;
  doc.font("hei").fontSize(8).fillColor(SUB).text(T(lang, "喜用", "Favorable"), chipX, chipY + 2, { width: 34, lineBreak: false }); chipX += 36;
  dm.favorable.forEach((e) => { doc.roundedRect(chipX, chipY, 20, 13, 3).fillColor(EL_COLOR[e]).fill(); doc.font("hei").fontSize(8.5).fillColor("#fff").text(EL_ZH[e], chipX, chipY + 2, { width: 20, align: "center" }); chipX += 24; });
  chipX += 8;
  doc.font("hei").fontSize(8).fillColor(SUB).text(T(lang, "忌", "Unfav."), chipX, chipY + 2, { width: 20, lineBreak: false }); chipX += 22;
  dm.unfavorable.forEach((e) => { doc.roundedRect(chipX, chipY, 20, 13, 3).lineWidth(1).strokeColor(EL_COLOR[e]).stroke(); doc.font("hei").fontSize(8.5).fillColor(EL_COLOR[e]).text(EL_ZH[e], chipX, chipY + 2, { width: 20, align: "center" }); chipX += 24; });
  doc.y = statY + 62;
  h2(T(lang, "判定依据", "The Reasoning"));
  dm.reasons.forEach((r) => para(`· ${r}`, SUB, 9));

  };

  const secTenGods = () => {
  // ── 肆 十神分布 ──────────────────────────────
  chapter(T(lang, "十神分布", "Ten-God Distribution"), "Which Forces Dominate");
  para(T(lang, "十神是命盘的「性格算子」。按五类归堆，权重越高，这类心理动力越主导——颜色区分五类。", "The Ten Gods are the chart's personality operators, grouped into five families. Higher weight means a more dominant drive; colour marks the family."), SUB, 9.5);
  const tga = profile.tenGodAnalysis;
  const tgaMax = Math.max(...tga.map((g) => g.count));
  tga.forEach((g) => {
    const color = GOD_CAT[g.members.split("·")[0]?.trim()]?.color ?? SUB;
    colorBar(`${g.label}（${g.members}）`, g.count, tgaMax, color, { labelW: 168 });
  });
  doc.moveDown(0.4);
  h2(T(lang, "十神出处", "Where Each God Comes From"));
  para(T(lang, "每一分十神都能追到具体的柱与藏干层，不是空穴来风：", "Every Ten-God point traces back to a specific pillar and hidden-stem layer — nothing is invented:"), FAINT, 8.5);
  profile.tenGodSources.forEach((s) => {
    ensure(13); const y = doc.y;
    const color = GOD_CAT[s.god]?.color ?? SUB;
    doc.circle(ML + 4, y + 5, 3).fillColor(color).fill();
    doc.font("hei").fontSize(8.5).fillColor(SUB).text(`${s.pillar} · ${s.layer}`, ML + 14, y + 1, { width: 110, lineBreak: false });
    doc.font("hei").fontSize(8.5).fillColor(color).text(s.god, ML + 128, y + 1, { width: 40, lineBreak: false });
    doc.font("en").fontSize(8.5).fillColor(INK).text(`权重 ${s.weight}`, ML + 172, y + 1, { width: 60, lineBreak: false });
    doc.x = ML; doc.y = y + 12;
  });

  };

  const secPersona = () => {
  // ── 人格画像（前移，铺满一页）──────────────────
  chapter(T(lang, "人格画像", "Persona"), "Who This Chart Describes");
  const dp = profile.dominantPersona;
  doc.font("kai").fontSize(20).fillColor(CINNABAR).text(`${dp.name}（${dp.god}）`, ML, doc.y, { width: W });
  doc.moveDown(0.3);
  para(dp.drive.replaceAll(" / ", "、"), SUB, 11);
  para(profile.combinedPersona.summary, INK, 12);
  doc.moveDown(0.3);
  labeled(T(lang, "行为底色", "Behaviour"), dp.behavior, CINNABAR);
  labeled(T(lang, "关系里", "In relationships"), dp.relationship, CINNABAR);
  doc.moveDown(0.4);
  h2(T(lang, "副轴与配轴", "Secondary Threads"));
  const sp = profile.secondaryPersona;
  if (sp) labeled(`${sp.name}（${sp.god}）`, sp.drive.replaceAll(" / ", "、"), "#4f9d6b");
  const tp = profile.tertiaryPersona;
  if (tp) labeled(`${tp.name}（${tp.god}）`, tp.drive.replaceAll(" / ", "、"), "#bf9a4e");
  doc.moveDown(0.5);
  h2(T(lang, "身份标签", "Identity Tags"));
  chips(profile.identityTags);

  };

  const secBehavior = () => {
  // ── 行为模式（traitAnalysis）────────────────────
  if (profile.traitAnalysis.length) {
    chapter(T(lang, "行为模式", "Behaviour Patterns"), "How This Chart Acts");
    para(T(lang, "把命盘折算成可观察的行为倾向，每一条都附命盘依据——分数越高，该模式越稳定鲜明。", "The chart translated into observable behavioural tendencies, each with its chart-based evidence. The higher the score, the more consistently the pattern shows."), SUB, 10.5);
    doc.moveDown(0.3);
    const tMax = 100;
    for (const t of profile.traitAnalysis) {
      ensure(40);
      const color = t.displayScore >= 66 ? "#4f9d6b" : t.displayScore >= 40 ? "#bf9a4e" : "#9a9587";
      colorBar(t.label, t.displayScore, tMax, color, { labelW: 120 });
      if (t.basis) para(`　${t.basis}`, FAINT, 9);
      doc.moveDown(0.15);
    }
  }

  };

  const secTiming = () => {
  // ── 流年大运（时运结构：本命冲合 + 大运走势 + 今年流年）──
  {
    chapter(T(lang, "流年大运", "Fortune Cycles"), "Timing — Clashes & Cycles");
    const clashMap: Record<string, string> = { 子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅", 卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳" };
    const combineMap: Record<string, string> = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };
    // 本命结构冲合
    if (profile.specialPoints.length) {
      h2(T(lang, "本命结构（原局冲合）", "Native Structure"));
      for (const s of profile.specialPoints) {
        ensure(38);
        const color = s.type === "冲" ? "#c85a4c" : "#4f9d6b";
        doc.font("hei").fontSize(11).fillColor(color).text(`${s.type} · ${s.title}`, ML, doc.y, { width: W - 90, continued: false });
        doc.font("en").fontSize(9).fillColor(FAINT).text(T(lang, `强度 ${s.strength}`, `str. ${s.strength}`), ML + W - 80, doc.y - 13, { width: 80, align: "right", lineBreak: false });
        para(s.summary, SUB, 10);
        doc.moveDown(0.1);
      }
      doc.moveDown(0.3);
    }
    // 大运走势
    if (profile.luckCycles.periods.length) {
      h2(T(lang, "大运走势", "Decade Cycles"));
      const toneColor: Record<string, string> = { boost: "#4f9d6b", drain: "#c85a4c", mixed: "#bf9a4e", neutral: "#9a9587" };
      for (const per of profile.luckCycles.periods.slice(0, 8)) {
        ensure(20); const y = doc.y;
        const tc = toneColor[per.verdict?.tone ?? "neutral"];
        if (per.isCurrent) { doc.roundedRect(ML - 4, y - 2, W + 8, 18, 3).fillColor("#efe9d8").fill(); }
        doc.font("kai").fontSize(12).fillColor(per.isCurrent ? CINNABAR : INK).text(per.ganZhi, ML, y, { width: 40, lineBreak: false });
        doc.font("hei").fontSize(9.5).fillColor(SUB).text(`${per.startAge}–${per.endAge} ${T(lang, "岁", "y")}`, ML + 44, y + 1, { width: 70, lineBreak: false });
        doc.circle(ML + 124, y + 6, 3.2).fillColor(tc).fill();
        doc.font("hei").fontSize(10).fillColor(tc).text(per.verdict?.label ?? "—", ML + 134, y + 1, { width: 90, lineBreak: false });
        doc.font("hei").fontSize(8.5).fillColor(FAINT).text(per.isCurrent ? T(lang, "← 当前", "← now") : "", ML + 230, y + 1.5, { width: 80, lineBreak: false });
        doc.x = ML; doc.y = y + 20;
      }
      doc.moveDown(0.3);
    }
    // 今年流年（当前流年支 vs 日支）
    const yearBranch = profile.luckCycles.currentGanZhi?.[1];
    const dayBranch = profile.bazi.dayPillar[1];
    if (yearBranch && dayBranch) {
      h2(T(lang, `今年流年 · ${profile.luckCycles.currentYear} ${profile.luckCycles.currentGanZhi}`, `This Year · ${profile.luckCycles.currentYear}`));
      const rel = clashMap[yearBranch] === dayBranch ? { z: "流年冲日支（婚姻宫）", e: "annual branch clashes the day branch (marriage palace)", c: "#c85a4c" }
        : combineMap[yearBranch] === dayBranch ? { z: "流年合日支（婚姻宫）", e: "annual branch combines the day branch", c: "#4f9d6b" }
          : yearBranch === dayBranch ? { z: "流年与日支同气（值太岁）", e: "annual branch same as day branch", c: "#bf9a4e" }
            : { z: "流年与日支无直接刑冲，节奏相对平顺", e: "no direct clash with the day branch this year", c: "#9a9587" };
      para(T(lang, `${rel.z}——${rel.z.includes("冲") ? "核心关系与既定节奏更容易被外部事件打断或加速，宜提前商量、多留确认时间。" : rel.z.includes("合") ? "环境与核心宫位更容易配合，是推进的顺手窗口。" : rel.z.includes("值太岁") ? "自我课题被放大，容易生出重新选择的冲动，落地前多给自己一个季度观察。" : "外部结构不加戏，质量取决于经营本身。"}`, `${rel.e}.`), rel.c, 11);
    }
  
    // —— 未来五年流年评定（含冲克合 / 桃花 / 驿马 / 补耗）——
    const GANS = "甲乙丙丁戊己庚辛壬癸", ZHIS = "子丑寅卯辰巳午未申酉戌亥";
    const gzOf = (y: number) => { const i = ((y - 1984) % 60 + 60) % 60; return GANS[i % 10] + ZHIS[i % 12]; };
    const ganEl: Record<string, string> = GAN_EL;
    const peachOf = (b: string) => ["寅","午","戌"].includes(b) ? "卯" : ["亥","卯","未"].includes(b) ? "子" : ["申","子","辰"].includes(b) ? "酉" : "午";
    const horseOf = (b: string) => ["申","子","辰"].includes(b) ? "寅" : ["寅","午","戌"].includes(b) ? "申" : ["巳","酉","丑"].includes(b) ? "亥" : "巳";
    const favSet = new Set<string>(profile.energy.dayMaster.favorable);
    const unfavSet = new Set<string>(profile.energy.dayMaster.unfavorable);
    const db = profile.bazi.dayPillar[1];
    const yb = profile.bazi.yearPillar[1];
    if (db) {
      h2(T(lang, "未来五年流年", "The Next Five Years"));
      para(T(lang, "逐年看流年地支与你命盘的关系：冲/合婚姻宫、桃花与驿马是否引动、当年五行对你是补还是耗。刻度色即倾向——红为动荡、绿为顺、金为变。", "Year by year: whether the annual branch clashes or combines your marriage palace, whether the Peach-Blossom or Travel star is triggered, and whether the year's element feeds or drains you."), FAINT, 9);
      const baseYear = profile.luckCycles.currentYear || new Date().getFullYear();
      for (let k = 0; k < 5; k++) {
        const y = baseYear + k, gz = gzOf(y), zhi = gz[1], stem = gz[0];
        const signals: { t: string; c: string }[] = [];
        if (clashMap[zhi] === db) signals.push({ t: T(lang, "冲婚姻宫", "clash palace"), c: "#c85a4c" });
        else if (combineMap[zhi] === db) signals.push({ t: T(lang, "合婚姻宫", "combine palace"), c: "#4f9d6b" });
        else if (zhi === yb) signals.push({ t: T(lang, "值太岁", "same as year"), c: "#bf9a4e" });
        if (zhi === peachOf(db) || zhi === peachOf(yb)) signals.push({ t: T(lang, "桃花", "peach-blossom"), c: "#c96f7d" });
        if (zhi === horseOf(db) || zhi === horseOf(yb)) signals.push({ t: T(lang, "驿马", "travel"), c: "#bf9a4e" });
        const el = ganEl[stem];
        if (favSet.has(el)) signals.push({ t: T(lang, "补气", "feeds you"), c: "#4f9d6b" });
        else if (unfavSet.has(el)) signals.push({ t: T(lang, "耗气", "drains you"), c: "#9a9587" });
        ensure(22); const yy = doc.y;
        doc.font("kai").fontSize(13).fillColor(k === 0 ? CINNABAR : INK).text(`${y}`, ML, yy, { width: 40, lineBreak: false });
        doc.font("hei").fontSize(11).fillColor(SUB).text(gz, ML + 44, yy + 1, { width: 40, lineBreak: false });
        let sx = ML + 96;
        if (!signals.length) signals.push({ t: T(lang, "平顺", "steady"), c: "#9a9587" });
        for (const sig of signals) {
          const w = doc.font("hei").fontSize(8.5).widthOfString(sig.t) + 12;
          doc.roundedRect(sx, yy, w, 15, 4).fillColor(sig.c).fill();
          doc.fillColor("#fff").fontSize(8.5).text(sig.t, sx + 6, yy + 2.5, { lineBreak: false });
          sx += w + 5;
        }
        doc.x = ML; doc.y = yy + 20;
      }
    }

  }

  };

  const secDims = () => {
  // ── 十二维深度画像 ────────────────────────
  const CAT_COLOR: Record<string, string> = { "亲密与安全": "#4a7fb0", "沟通与连接": "#4f9d6b", "边界与冲突": "#c85a4c", "成长与行动": "#bf9a4e" };
  chapter(T(lang, "十二维深度画像", "Twelve-Dimension Profile"), "Derived Personality — In Full");
  para(T(lang, "命盘结构折算成十二个可读的行为维度。先看整体雷达，再一维一页逐条拆开——每维都给出分数、构成、判定依据、反向信号与自我验证方式。", "The chart becomes twelve readable behavioural dimensions. First the overall radar, then one page per dimension — each with its score, composition, evidence, counter-signals and how to verify it."), SUB, 10);
  doc.moveDown(0.3);
  // —— 十二维雷达（按四类排序，使同类的三维在报告里连续成组）——
  const CAT_ORDER = ["亲密与安全", "沟通与连接", "边界与冲突", "成长与行动"];
  const dims = [...profile.deepAnalysis].sort((a, b) => (CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category)) || 0);
  const cx = ML + W / 2, cy = doc.y + 150, R = 130;
  const pt = (i: number, r: number) => { const a = -Math.PI / 2 + i * Math.PI * 2 / dims.length; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const; };
  [0.25, 0.5, 0.75, 1].forEach((f) => { doc.polygon(...dims.map((_, i) => pt(i, R * f) as [number, number])).lineWidth(0.5).strokeColor("#d8d2c0").stroke(); });
  dims.forEach((_, i) => { const [x, y] = pt(i, R); doc.moveTo(cx, cy).lineTo(x, y).lineWidth(0.4).strokeColor("#e0dac8").stroke(); });
  doc.polygon(...dims.map((d, i) => pt(i, R * d.displayScore / 100) as [number, number])).fillOpacity(0.28).fill(CINNABAR);
  doc.fillOpacity(1);
  doc.polygon(...dims.map((d, i) => pt(i, R * d.displayScore / 100) as [number, number])).lineWidth(1.2).strokeColor(CINNABAR).stroke();
  dims.forEach((d, i) => { const [x, y] = pt(i, R * d.displayScore / 100); doc.circle(x, y, 2.2).fill(CAT_COLOR[d.category] ?? CINNABAR); });
  dims.forEach((d, i) => { const [x, y] = pt(i, R + 16); doc.font("hei").fontSize(7.5).fillColor(SUB).text(d.label, x - 30, y - 4, { width: 60, align: "center" }); });
  doc.y = cy + R + 34; doc.x = ML;

  // 解析「十神/五行 权重×次数」→ 构成柱状图
  const parseFactors = (evidence: string[]) => {
    const out: { label: string; value: number; color: string }[] = [];
    const re = /([一-龥]{1,2})\s*([\d.]+)×(\d+)/g;
    for (const line of evidence) { let m: RegExpExecArray | null; while ((m = re.exec(line))) { const g = m[1]; const v = parseFloat(m[2]) * parseInt(m[3], 10); if (v <= 0) continue; const color = GOD_CAT[g]?.color ?? EL_COLOR[Object.keys(EL_ZH).find((k) => EL_ZH[k] === g) ?? ""] ?? SUB; out.push({ label: g, value: Math.round(v * 10) / 10, color }); } }
    return out.slice(0, 6);
  };

  // —— 一维一页（同类连续，首维标注「第 N/3」）——
  let lastCat = "";
  const catSeq: Record<string, number> = {};
  for (const d of dims) {
    doc.addPage();
    const accent = CAT_COLOR[d.category] ?? CINNABAR;
    catSeq[d.category] = (catSeq[d.category] ?? 0) + 1;
    const catCount = dims.filter((x) => x.category === d.category).length;
    const isFirstOfCat = d.category !== lastCat; lastCat = d.category;
    const ty = doc.y;
    // 类目 banner（首维更醒目）
    if (isFirstOfCat) { doc.roundedRect(ML, ty, 4, 13, 1).fillColor(accent).fill(); }
    doc.font("hei").fontSize(10).fillColor(accent).text(`${d.category}　${catSeq[d.category]}/${catCount}`, ML + (isFirstOfCat ? 10 : 0), ty, { width: W - 90 });
    doc.font("en").fontSize(34).fillColor(accent).text(String(d.displayScore), ML + W - 84, ty - 4, { width: 84, align: "right", lineBreak: false });
    doc.font("kai").fontSize(24).fillColor(INK).text(d.label, ML, doc.y + 2, { width: W - 90 });
    doc.font("hei").fontSize(12).fillColor(accent).text(`${d.descriptor} · ${levelOf(d.displayScore)}`, ML, doc.y + 2, { width: W });
    doc.moveDown(0.5); doc.x = ML;
    // 醒目分数条
    doc.roundedRect(ML, doc.y, W, 8, 4).fillColor(TRACK).fill();
    doc.roundedRect(ML, doc.y, Math.max(6, W * d.displayScore / 100), 8, 4).fillColor(accent).fill();
    doc.y += 18;
    if (d.keywords.length) chips(d.keywords, accent);
    doc.moveDown(0.2);
    para(d.summary, INK, 12);
    doc.moveDown(0.2);
    // 判定依据 → 构成柱状图
    const factors = parseFactors(d.evidence);
    if (factors.length) {
      h2(T(lang, "构成（判定依据）", "Composition (Evidence)"));
      const fmax = Math.max(...factors.map((f) => f.value));
      factors.forEach((f) => colorBar(f.label, f.value, fmax, f.color, { labelW: 70 }));
      doc.moveDown(0.3);
    } else if (d.evidence.length) {
      labeled(T(lang, "判定依据", "Evidence"), d.evidence.join("；"), accent);
    }
    labeled(T(lang, "倾向来源", "Origin"), d.logic.premise, accent);
    labeled(T(lang, "反向信号", "Counter"), d.logic.counterSignal, accent);
    labeled(T(lang, "如何验证", "Verify"), d.logic.realWorldCheck, accent);
    labeled(T(lang, "优势", "Strength"), d.logic.strength, "#4f9d6b");
    labeled(T(lang, "盲点", "Blind spot"), d.logic.blindSpot, "#c85a4c");
    doc.moveDown(0.2);
    d.sceneInsights.forEach((s) => labeled(`${s.scene}·${s.title}`, s.text, accent));
  }

  };

  const secSpecialty = () => {
  // ── 专长与天赋（一节一页 + 命理注释：为什么这些结构代表该天赋）──
  // 注释固定表：说明每类天赋在命理上由哪些结构支撑（偏印/正印/华盖/十灵/桃花等）
  const SPECIALTY_NOTE: Record<string, { zh: string; en: string }> = {
    intuition: { zh: "命理依据：偏印主感知与灵性、正印主吸收与内化；华盖为孤高玄思之星，十灵日主聪慧敏感——三者叠加，故取为直觉与灵感的结构指标。", en: "Basis: Indirect Resource governs perception and spirituality, Direct Resource absorption; the Canopy star marks solitary contemplation and the Ten-Spirit day marks acuity — together they mark intuitive aptitude." },
    love_structure: { zh: "命理依据：官杀与财星的配置决定亲密里的吸引与投入方式，印星调和情感的接收——由此读出你在爱里的默认结构。", en: "Basis: the interplay of Authority, Wealth and Resource stars sets how attraction and investment work in intimacy — hence your default structure in love." },
    attraction: { zh: "命理依据：桃花（咸池）主人际吸引与曝光，食伤主表达魅力，财星主流动与机会——共同抬升被看见、被靠近的密度。", en: "Basis: the Peach-Blossom star governs charm and exposure, Output stars expressive appeal, Wealth stars flow and opportunity — together they raise how often you are noticed." },
    creative_sensitivity: { zh: "命理依据：食伤主创造与输出，偏印主异想与灵感，水木相生主流动与生发——由此取为创造敏感度的结构来源。", en: "Basis: Output stars drive creation, Indirect Resource unconventional imagination, and Water-feeding-Wood the sense of flow — the structural source of creative sensitivity." },
  };
  if (profile.specialtyAnalysis.length) {
    for (const s of profile.specialtyAnalysis) {
      doc.addPage();
      const accent = s.displayScore >= 66 ? "#4f9d6b" : s.displayScore >= 40 ? "#bf9a4e" : "#9a9587";
      mono(T(lang, "专长与天赋", "Special Aptitude"));
      const ty = doc.y;
      doc.font("en").fontSize(34).fillColor(accent).text(String(s.displayScore), ML + W - 84, ty - 4, { width: 84, align: "right", lineBreak: false });
      doc.font("kai").fontSize(24).fillColor(INK).text(s.label, ML, ty, { width: W - 90 });
      doc.font("hei").fontSize(12).fillColor(accent).text(`${s.descriptor} · ${levelOf(s.displayScore)}`, ML, doc.y + 2, { width: W });
      doc.moveDown(0.5); doc.x = ML;
      doc.roundedRect(ML, doc.y, W, 8, 4).fillColor(TRACK).fill();
      doc.roundedRect(ML, doc.y, Math.max(6, W * s.displayScore / 100), 8, 4).fillColor(accent).fill();
      doc.y += 18;
      para(s.summary, INK, 12);
      doc.moveDown(0.2);
      if (s.evidence.length) labeled(T(lang, "命盘依据", "Chart evidence"), s.evidence.join("；"), accent);
      labeled(T(lang, "提醒", "Caution"), s.caution, "#c85a4c");
      // 玄学天赋注释（为什么这些结构代表该天赋）
      const note = SPECIALTY_NOTE[s.key];
      if (note) {
        doc.moveDown(0.4);
        const ny = doc.y;
        doc.roundedRect(ML, ny, W, 2, 1).fillColor(accent).fill();
        doc.y = ny + 8;
        doc.font("hei").fontSize(9.5).fillColor(FAINT).text(T(lang, note.zh, note.en), ML, doc.y, { width: W, lineGap: 4 });
      }
    }
  }

  };

  const secAI = () => {
  // ── 捌 AI 综合评述（后端 DeepSeek 生成，压轴）──
  if (opts.digest) {
    chapter(T(lang, "综合评述", "Holistic Reading"), opts.digest.source === "ai" ? "Composed by FATE narrative layer" : "Deterministic edition");
    doc.font("kai").fontSize(15).fillColor(CINNABAR).text(`「${opts.digest.headline}」`, ML, doc.y, { width: W });
    doc.moveDown(0.6);
    const chapterMap: [keyof DeepDigest["pages"], string, string][] = [["love", "感情", "Love"], ["career", "事业", "Career"], ["social", "人际", "Social"], ["season", "时运", "Timing"]];
    for (const [key, zh, en] of chapterMap) {
      const page = opts.digest.pages[key];
      h2(T(lang, zh, en));
      para(page.essay, INK, 10);
      labeled(T(lang, "建议", "Advice"), page.advice, CINNABAR);
      doc.moveDown(0.4);
    }
  }

  };

  const secDisclaimer = () => {
  // ── 免责 ────────────────────────────────────
  chapter(T(lang, "免责声明", "Disclaimer"), "Disclaimer");
  para(T(lang,
    "本报告由 FATE 模型 2.0 基于传统历法结构与行为模型推演生成，内容仅供娱乐与自我认知参考，不构成婚恋、医疗、心理、法律或投资建议，不作任何吉凶祸福的断言或承诺。报告呈现的是结构与倾向，真实的人生由你的选择决定。",
    "This report is generated by FATE Model 2.0 from traditional calendrical structures and behavioural modelling, for entertainment and self-reflection only. It is not relationship, medical, psychological, legal, or financial advice, and makes no claim about fortune. It shows structures and tendencies; your life is shaped by your choices."), SUB, 9.5);

  };


  // —— 第二部分分隔页：告知用户以下是底层算法逻辑 ——
  const partDivider = (zh: string, en: string, note: string, noteEn: string) => {
    doc.addPage(); doc.y = 300;
    doc.font("en").fontSize(9).fillColor(CINNABAR).text("PART TWO", ML, doc.y, { width: W, align: "center", characterSpacing: 3 });
    doc.moveDown(1);
    doc.font("kai").fontSize(30).fillColor(INK).text(T(lang, zh, en), ML, doc.y, { width: W, align: "center" });
    doc.moveDown(1.2);
    doc.font("hei").fontSize(11).fillColor(SUB).text(T(lang, note, noteEn), ML + 60, doc.y, { width: W - 120, align: "center", lineGap: 5 });
  };

  // ── 执行顺序 ────────────────────────────────
  // 第一部分 · 评定结果（给所有人看）
  secAssessment();
  secTiming();
  secPersona();
  secBehavior();
  secSpecialty();
  secAI();
  // 第二部分 · 底层算法逻辑（需要一定命理了解）
  partDivider("底层算法逻辑", "The Underlying Method",
    "以下是这份报告的推算依据：四柱、五行力量、日主强弱、十神分布与十二维拆解。这部分展示「结论从哪里来」，需要一点命理基础才能完全看懂——看不懂不影响前面的评定结果。",
    "What follows is how the report was computed: the pillars, element weights, day-master strength, Ten-God distribution and the twelve-dimension breakdown. It shows where the conclusions come from and assumes some familiarity with the method.");
  secChart();
  secElements();
  secDayMaster();
  secTenGods();
  secDims();
  secDisclaimer();

  // 页脚（每页统一：基于 FATE 模型 2.0 生成报告 + 页码）
  // 关键：页脚 y 在底边距之下，必须先把该页 bottom 边距设 0，否则 pdfkit 判为溢出→每写一次多开一张空白页
  const range = doc.bufferedPageRange();
  const fy = PH - 44;
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;
    doc.moveTo(ML, fy - 7).lineTo(ML + W, fy - 7).lineWidth(0.4).strokeColor(LINE).stroke();
    doc.font("hei").fontSize(8).fillColor(FAINT).text(T(lang, "基于 FATE 模型 2.0 生成报告", "Generated by FATE Model 2.0"), ML, fy, { width: W * 0.7, lineBreak: false });
    doc.font("en").fontSize(8).fillColor(FAINT).text(`${i} / ${range.count - 1}`, ML + W * 0.7, fy, { width: W * 0.3, align: "right", lineBreak: false });
  }

  doc.end();
  return done;
}
