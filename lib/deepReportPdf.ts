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

type ChapterText = { essay: string; advice: string };
export type DeepDigest = { source: "ai" | "fallback"; headline: string; pages: { love: ChapterText; career: ChapterText; social: ChapterText; season: ChapterText } };

export function buildDeepReportPdf(profile: UserProfile, opts: { lang: "zh" | "en"; reportId: string; generatedAt: string; digest?: DeepDigest }): Promise<Buffer> {
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
  const labeled = (tag: string, text: string, color = CINNABAR, size = 10) => {
    if (!text) return;
    ensure(24);
    doc.font("hei").fontSize(size).fillColor(color).text(`${tag}　`, ML, doc.y, { width: W, continued: true });
    doc.font("hei").fontSize(size).fillColor(SUB).text(text, { width: W, lineGap: 4 });
    doc.moveDown(0.4); doc.x = ML;
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

  // ── 伍 十二维深度画像 ────────────────────────
  const CAT_COLOR: Record<string, string> = { "亲密与安全": "#4a7fb0", "沟通与连接": "#4f9d6b", "边界与冲突": "#c85a4c", "成长与行动": "#bf9a4e" };
  chapter(T(lang, "十二维深度画像", "Twelve-Dimension Profile"), "Derived Personality — In Full");
  para(T(lang, "命盘结构折算成十二个可读的行为维度。先看整体雷达，再一维一页逐条拆开——每维都给出分数、构成、判定依据、反向信号与自我验证方式。", "The chart becomes twelve readable behavioural dimensions. First the overall radar, then one page per dimension — each with its score, composition, evidence, counter-signals and how to verify it."), SUB, 10);
  doc.moveDown(0.3);
  // —— 十二维雷达 ——
  const dims = profile.deepAnalysis;
  const cx = ML + W / 2, cy = doc.y + 150, R = 130;
  const pt = (i: number, r: number) => { const a = -Math.PI / 2 + i * Math.PI * 2 / dims.length; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const; };
  [0.25, 0.5, 0.75, 1].forEach((f) => { doc.polygon(...dims.map((_, i) => pt(i, R * f) as [number, number])).lineWidth(0.5).strokeColor("#d8d2c0").stroke(); });
  dims.forEach((_, i) => { const [x, y] = pt(i, R); doc.moveTo(cx, cy).lineTo(x, y).lineWidth(0.4).strokeColor("#e0dac8").stroke(); });
  doc.polygon(...dims.map((d, i) => pt(i, R * d.score / 100) as [number, number])).fillOpacity(0.28).fill(CINNABAR);
  doc.fillOpacity(1);
  doc.polygon(...dims.map((d, i) => pt(i, R * d.score / 100) as [number, number])).lineWidth(1.2).strokeColor(CINNABAR).stroke();
  dims.forEach((d, i) => { const [x, y] = pt(i, R * d.score / 100); doc.circle(x, y, 2.2).fill(CAT_COLOR[d.category] ?? CINNABAR); });
  dims.forEach((d, i) => { const [x, y] = pt(i, R + 16); doc.font("hei").fontSize(7.5).fillColor(SUB).text(d.label, x - 30, y - 4, { width: 60, align: "center" }); });
  doc.y = cy + R + 34; doc.x = ML;

  // 解析「十神/五行 权重×次数」→ 构成柱状图
  const parseFactors = (evidence: string[]) => {
    const out: { label: string; value: number; color: string }[] = [];
    const re = /([一-龥]{1,2})\s*([\d.]+)×(\d+)/g;
    for (const line of evidence) { let m: RegExpExecArray | null; while ((m = re.exec(line))) { const g = m[1]; const v = parseFloat(m[2]) * parseInt(m[3], 10); if (v <= 0) continue; const color = GOD_CAT[g]?.color ?? EL_COLOR[Object.keys(EL_ZH).find((k) => EL_ZH[k] === g) ?? ""] ?? SUB; out.push({ label: g, value: Math.round(v * 10) / 10, color }); } }
    return out.slice(0, 6);
  };

  // —— 一维一页 ——
  for (const d of dims) {
    doc.addPage();
    const accent = CAT_COLOR[d.category] ?? CINNABAR;
    const ty = doc.y;
    doc.font("hei").fontSize(10).fillColor(accent).text(d.category, ML, ty, { width: W - 90 });
    doc.font("en").fontSize(34).fillColor(accent).text(String(d.score), ML + W - 84, ty - 4, { width: 84, align: "right", lineBreak: false });
    doc.font("kai").fontSize(24).fillColor(INK).text(d.label, ML, doc.y + 2, { width: W - 90 });
    doc.font("hei").fontSize(12).fillColor(accent).text(`${d.descriptor} · ${d.level}`, ML, doc.y + 2, { width: W });
    doc.moveDown(0.5); doc.x = ML;
    // 醒目分数条
    doc.roundedRect(ML, doc.y, W, 8, 4).fillColor(TRACK).fill();
    doc.roundedRect(ML, doc.y, Math.max(6, W * d.score / 100), 8, 4).fillColor(accent).fill();
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

  // ── 陆 专长天赋 ──────────────────────────────
  if (profile.specialtyAnalysis.length) {
    chapter(T(lang, "专长与天赋", "Special Aptitudes"), "Where the Chart Sharpens");
    for (const s of profile.specialtyAnalysis) {
      ensure(70);
      const accent = s.score >= 66 ? "#4f9d6b" : s.score >= 40 ? "#bf9a4e" : "#9a9587";
      doc.font("kai").fontSize(12.5).fillColor(INK).text(`${s.label} · ${s.descriptor}`, ML, doc.y, { width: W - 50, lineBreak: false });
      doc.font("en").fontSize(14).fillColor(accent).text(String(s.score), ML + W - 40, doc.y, { width: 40, align: "right", lineBreak: false });
      doc.moveDown(0.5); doc.x = ML;
      doc.roundedRect(ML, doc.y, W, 5, 2.5).fillColor(TRACK).fill();
      doc.roundedRect(ML, doc.y, Math.max(4, W * s.score / 100), 5, 2.5).fillColor(accent).fill();
      doc.y += 12;
      para(s.summary, INK, 9.5);
      if (s.evidence.length) labeled(T(lang, "依据", "Evidence"), s.evidence.join("；"), accent);
      labeled(T(lang, "提醒", "Caution"), s.caution, "#c85a4c");
      doc.moveDown(0.3);
      doc.moveTo(ML, doc.y).lineTo(ML + W, doc.y).lineWidth(0.4).strokeColor(LINE).stroke();
      doc.moveDown(0.5);
    }
  }

  // ── 柒 人格画像 ──────────────────────────────
  chapter(T(lang, "人格画像", "Persona"), "Who This Chart Describes");
  h2(`${profile.dominantPersona.name}（${profile.dominantPersona.god}）`);
  para(profile.dominantPersona.drive.replaceAll(" / ", "、"), SUB, 9.5);
  para(profile.combinedPersona.summary);
  doc.moveDown(0.2);
  chips(profile.identityTags);

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

  // ── 免责 ────────────────────────────────────
  chapter(T(lang, "免责声明", "Disclaimer"), "Disclaimer");
  para(T(lang,
    "本报告由 FATE 模型 2.0 基于传统历法结构与行为模型推演生成，内容仅供娱乐与自我认知参考，不构成婚恋、医疗、心理、法律或投资建议，不作任何吉凶祸福的断言或承诺。报告呈现的是结构与倾向，真实的人生由你的选择决定。",
    "This report is generated by FATE Model 2.0 from traditional calendrical structures and behavioural modelling, for entertainment and self-reflection only. It is not relationship, medical, psychological, legal, or financial advice, and makes no claim about fortune. It shows structures and tendencies; your life is shaped by your choices."), SUB, 9.5);

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
