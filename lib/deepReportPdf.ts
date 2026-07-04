import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import type { UserProfile } from "./types";

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

export function buildDeepReportPdf(profile: UserProfile, opts: { lang: "zh" | "en"; reportId: string; generatedAt: string }): Promise<Buffer> {
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
  const ensure = (n: number) => { if (doc.y + n > PH - 78) doc.addPage(); };
  const mono = (s: string) => { doc.font("en").fontSize(7.5).fillColor(FAINT).text(s.toUpperCase(), ML, doc.y, { width: W, characterSpacing: 1.3 }); doc.moveDown(0.3); };
  const chapter = (zh: string, en: string) => { if (doc.y > 96) doc.addPage(); mono(en); const y = doc.y; doc.font("kai").fontSize(23).fillColor(CINNABAR).text(zh, ML, y, { width: W }); doc.moveDown(0.15); doc.font("en").fontSize(10.5).fillColor(GOLD).text(en, ML, doc.y, { width: W }); doc.moveDown(0.4); doc.moveTo(ML, doc.y).lineTo(ML + W, doc.y).lineWidth(1).strokeColor(CINNABAR).stroke(); doc.moveDown(0.55); };
  const h2 = (s: string) => { ensure(40); doc.font("kai").fontSize(13).fillColor(INK).text(s, ML, doc.y, { width: W }); doc.moveDown(0.35); };
  const para = (s: string, color = INK, size = 10) => { ensure(34); doc.font("hei").fontSize(size).fillColor(color).text(s, ML, doc.y, { width: W, lineGap: 3.5 }); doc.moveDown(0.4); };
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

  // ── 封面 ──────────────────────────────────
  doc.addPage();
  doc.rect(0, 0, PW, PH).fillColor("#fbfaf5").fill();
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

  // ── 伍 十二维深度分析 ────────────────────────
  chapter(T(lang, "十二维深度画像", "Twelve-Dimension Profile"), "Derived Personality Scores");
  para(T(lang, "以上命盘结构，折算成十二个可读的行为维度。每维一条依据，说明分数从盘里哪一处来。", "The chart structure above is converted into twelve readable behavioural dimensions. Each carries one line of evidence tying the score back to the chart."), SUB, 9.5);
  const byCat = new Map<string, typeof profile.deepAnalysis>();
  profile.deepAnalysis.forEach((d) => { const arr = byCat.get(d.category) ?? []; arr.push(d); byCat.set(d.category, arr); });
  for (const [cat, items] of byCat) {
    h2(cat);
    items.forEach((d) => {
      const color = d.score >= 66 ? "#4f9d6b" : d.score >= 40 ? "#bf9a4e" : "#9a9587";
      colorBar(`${d.label} · ${d.descriptor}`, d.score, 100, color, { labelW: 180 });
      if (d.evidence[0]) para(`　${d.evidence[0]}`, FAINT, 8);
    });
    doc.moveDown(0.2);
  }

  // ── 陆 人格画像 ──────────────────────────────
  chapter(T(lang, "人格画像", "Persona"), "Who This Chart Describes");
  h2(`${profile.dominantPersona.name}（${profile.dominantPersona.god}）`);
  para(profile.dominantPersona.drive.replaceAll(" / ", "、"), SUB, 9.5);
  para(profile.combinedPersona.summary);
  doc.moveDown(0.2);
  // 身份标签 chips
  let tx = ML; const ty = doc.y;
  ensure(20);
  profile.identityTags.forEach((tag) => {
    const tw = doc.font("hei").fontSize(9).widthOfString(tag) + 16;
    if (tx + tw > ML + W) { tx = ML; doc.y += 20; }
    doc.roundedRect(tx, doc.y, tw, 15, 4).fillColor(CARD).fill();
    doc.fillColor(CINNABAR).text(tag, tx + 8, doc.y + 2.5, { lineBreak: false });
    tx += tw + 6;
  });
  doc.y += 26;

  // ── 免责 ────────────────────────────────────
  chapter(T(lang, "免责声明", "Disclaimer"), "Disclaimer");
  para(T(lang,
    "本报告由 FATE 模型 2.0 基于传统历法结构与行为模型推演生成，内容仅供娱乐与自我认知参考，不构成婚恋、医疗、心理、法律或投资建议，不作任何吉凶祸福的断言或承诺。报告呈现的是结构与倾向，真实的人生由你的选择决定。",
    "This report is generated by FATE Model 2.0 from traditional calendrical structures and behavioural modelling, for entertainment and self-reflection only. It is not relationship, medical, psychological, legal, or financial advice, and makes no claim about fortune. It shows structures and tendencies; your life is shaped by your choices."), SUB, 9.5);

  // 页脚
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) { doc.switchToPage(range.start + i); doc.font("en").fontSize(8).fillColor(FAINT).text(`FATE° · ${opts.reportId}`, ML, PH - 52, { width: W / 2, lineBreak: false }).text(`${i} / ${range.count - 1}`, ML + W / 2, PH - 52, { width: W / 2, align: "right", lineBreak: false }); }

  doc.end();
  return done;
}
