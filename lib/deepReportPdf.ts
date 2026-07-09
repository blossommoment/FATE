import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import type { UserProfile } from "./types";
import type { PersonaTags } from "./digest";

// 单人深度报告 PDF：把命理算法如实亮出来——五行力量占比+计分痕迹、十神分布+出处、
// 日主强弱推导、十二维深度。全部规则引擎数据（零 AI，秒出），彩色标注让人信服"有真东西"。
// 语言由调用方选（lang），单语言输出。

// 字体候选：环境变量优先 → Linux 部署路径（apt/手动放置的开源中文字体）→ Windows 本地兜底。
const LINUX_HEI = ["/opt/fate/fonts/NotoSansSC-Regular.otf", "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"];
const LINUX_KAI = ["/opt/fate/fonts/NotoSerifSC-Regular.otf", "/usr/share/fonts/truetype/arphic/ukai.ttc", ...LINUX_HEI];
const HEI = [process.env.FATE_PDF_FONT_HEI ?? "", ...LINUX_HEI, "C:\\Windows\\Fonts\\simhei.ttf"];
const KAI = [process.env.FATE_PDF_FONT_KAI ?? "", ...LINUX_KAI, "C:\\Windows\\Fonts\\simkai.ttf", "C:\\Windows\\Fonts\\simhei.ttf"];

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
// 命理术语中英对照（英文报告里译掉等级、十神名，避免露中文）
const LEVEL_EN: Record<string, string> = { 从强: "Follow-Strong", 身强: "Strong", 中和: "Balanced", 身弱: "Weak", 从弱: "Follow-Weak" };
const GOD_EN: Record<string, string> = { 比肩: "Friend", 劫财: "Rival", 食神: "Output", 伤官: "Hurting Officer", 正财: "Direct Wealth", 偏财: "Indirect Wealth", 正官: "Direct Officer", 七杀: "Seven Killings", 正印: "Direct Resource", 偏印: "Indirect Resource" };
// 十二长生（日主在各柱地支的生旺死绝状态）
const STAGE_EN: Record<string, string> = { 长生: "Growth", 沐浴: "Bath", 冠带: "Maturing", 临官: "Rising", 帝旺: "Peak", 衰: "Waning", 病: "Ailing", 死: "Fading", 墓: "Tomb", 绝: "Void", 胎: "Seed", 养: "Nurture" };
// 定格（古法）格名中英对照——固定集合走静态表，不进翻译批次
const PATTERN_EN: Record<string, string> = {
  曲直格: "Wood Unity (Qu-Zhi)", 炎上格: "Fire Unity (Yan-Shang)", 稼穑格: "Earth Unity (Jia-Se)", 从革格: "Metal Unity (Cong-Ge)", 润下格: "Water Unity (Run-Xia)",
  杀印相生: "Killings Feeding Resource", 官印相生: "Officer Feeding Resource", 食神制杀: "Output Taming Killings", 伤官配印: "Hurting Officer with Resource",
  财官双美: "Wealth & Officer in Concert", 食伤生财: "Output Generating Wealth", 财滋七杀: "Wealth Feeding Killings",
  正官格: "Direct Officer Structure", 七杀格: "Seven Killings Structure", 正财格: "Direct Wealth Structure", 偏财格: "Indirect Wealth Structure",
  正印格: "Direct Resource Structure", 偏印格: "Indirect Resource Structure", 食神格: "Output Structure", 伤官格: "Hurting Officer Structure",
  建禄格: "Jianlu (Peer-Root) Structure", 阳刃格: "Yang Blade Structure",
};
const godT = (lang: "zh" | "en", god: string) => lang === "en" ? (GOD_EN[god] ?? god) : god;
const patternT = (lang: "zh" | "en", name: string) => lang === "en" ? (PATTERN_EN[name] ?? name) : name;
const stageT = (lang: "zh" | "en", stage: string) => lang === "en" ? (STAGE_EN[stage] ?? stage) : stage;
const levelT = (lang: "zh" | "en", level: string) => lang === "en" ? (LEVEL_EN[level] ?? level) : level;

type ChapterText = { essay: string; advice: string };
export type DeepDigest = { source: "ai" | "fallback"; headline: string; pages: { nature: ChapterText; love: ChapterText; career: ChapterText; social: ChapterText; season: ChapterText } };

export function buildDeepReportPdf(profile: UserProfile, opts: { lang: "zh" | "en"; reportId: string; generatedAt: string; digest?: DeepDigest; tags?: PersonaTags; natureTags?: { tag: string; why: string }[] }): Promise<Buffer> {
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
  doc.font("hei").fontSize(11).fillColor(SUB).text(`${T(lang, "日主", "Day Master")} ${profile.bazi.dayPillar[0]}${lang === "en" ? " " + (EL_EN[dayEl] ?? "") : EL_ZH[dayEl]} · ${levelT(lang, profile.energy.dayMaster.level)} · ${profile.archetype}`, ML, doc.y, { width: W, align: "center" });
  doc.moveDown(1.1);
  // 命主八字四柱（封面即见，天干地支按五行上色）
  const cvPillars = profile.bazi.pillars;
  const cvLabels = [T(lang, "年", "Y"), T(lang, "月", "M"), T(lang, "日", "D"), T(lang, "时", "H")];
  const cellW = 66, tableW = cellW * 4, tx0 = ML + (W - tableW) / 2, ty0 = doc.y;
  cvPillars.forEach((p, i) => {
    const cx = tx0 + i * cellW;
    doc.font("hei").fontSize(8).fillColor(FAINT).text(cvLabels[i], cx, ty0, { width: cellW, align: "center" });
    doc.font("kai").fontSize(22).fillColor(EL_COLOR[GAN_EL[p.gan]] ?? INK).text(p.gan, cx, ty0 + 12, { width: cellW, align: "center" });
    doc.font("kai").fontSize(22).fillColor(EL_COLOR[ZHI_EL[p.zhi]] ?? INK).text(p.zhi, cx, ty0 + 38, { width: cellW, align: "center" });
  });
  doc.y = ty0 + 70;
  doc.moveDown(0.6);
  doc.font("kai").fontSize(12).fillColor(SUB).text(profile.combinedPersona.name, ML + 40, doc.y, { width: W - 80, align: "center", lineGap: 4 });
  doc.y = PH - 120;
  doc.font("en").fontSize(8.5).fillColor(FAINT).text(`${opts.reportId}   ·   ${opts.generatedAt}`, ML, doc.y, { width: W, align: "center" });

  // 综合评定（第二页）：性格特点标题 + 四域(标签 + 触发指标 + AI 评述 + 建议)
  const secAssessment = () => {
    chapter(T(lang, "综合评定", "Overall Assessment"), "Who You Are");
    // 性格特点评定：AI 一句话人设 + 主轴人格
    const EN = lang === "en";
    if (opts.digest?.headline) {
      doc.font("kai").fontSize(19).fillColor(CINNABAR).text(`${T(lang, "「", "“")}${opts.digest.headline}${T(lang, "」", "”")}`, ML, doc.y, { width: W, lineGap: EN ? 3 : 0 });
      doc.moveDown(EN ? 0.55 : 0.3);
    }
    doc.font("hei").fontSize(10.5).fillColor(SUB).text(`${T(lang, "性格特点", "Character")}${T(lang, "：", ": ")}${profile.archetype} · ${profile.dominantPersona.name}${T(lang, "（", " (")}${godT(lang, profile.dominantPersona.god)}${T(lang, "）", ")")} · ${T(lang, "定格", "Pattern")} ${patternT(lang, profile.pattern.name)}`, ML, doc.y, { width: W });
    doc.moveDown(EN ? 0.4 : 0.2);
    para(profile.combinedPersona.summary, INK, 11);
    doc.moveDown(EN ? 0.55 : 0.3);
    // 五域（与网页成册五章对齐）：标签 → 触发指标 → AI 评述 → 建议；性情章标签走 matchTags、建议名为「更容易合拍的人」
    const domains: { tagKey?: keyof PersonaTags; pageKey: keyof DeepDigest["pages"]; zh: string; en: string; color: string; adviceZh: string; adviceEn: string }[] = [
      { pageKey: "nature", zh: "性情", en: "Nature", color: "#7a5f28", adviceZh: "更容易合拍的人", adviceEn: "Who fits you" },
      { tagKey: "love", pageKey: "love", zh: "感情", en: "Love", color: "#c96f7d", adviceZh: "建议", adviceEn: "Advice" },
      { tagKey: "career", pageKey: "career", zh: "事业", en: "Career", color: "#bf9a4e", adviceZh: "建议", adviceEn: "Advice" },
      { tagKey: "social", pageKey: "social", zh: "人际", en: "Social", color: "#4f9d6b", adviceZh: "建议", adviceEn: "Advice" },
      { tagKey: "energy", pageKey: "season", zh: "时运", en: "Timing", color: "#4a7fb0", adviceZh: "建议", adviceEn: "Advice" },
    ];
    let first = true;
    for (const dom of domains) {
      const hits: { tag: string }[] = dom.tagKey ? opts.tags?.[dom.tagKey] ?? [] : opts.natureTags ?? [];
      const page = opts.digest?.pages[dom.pageKey];
      ensure(80);
      if (!first) doc.moveDown(EN ? 0.6 : 0.35);
      first = false;
      // 领域标题
      doc.font("kai").fontSize(16).fillColor(dom.color).text(T(lang, dom.zh, dom.en), ML, doc.y, { width: W });
      doc.moveDown(EN ? 0.55 : 0.35);
      // 标签药丸（横排）
      if (hits.length) {
        let tx = ML;
        for (const hit of hits) {
          const tw = doc.font("hei").fontSize(10).widthOfString(hit.tag) + 18;
          if (tx + tw > ML + W) { tx = ML; doc.y += EN ? 24 : 22; ensure(24); }
          doc.roundedRect(tx, doc.y, tw, 17, 5).fillColor(dom.color).fill();
          doc.fillColor("#fff").fontSize(10).text(hit.tag, tx + 9, doc.y + 3, { lineBreak: false });
          tx += tw + (EN ? 8 : 6);
        }
        doc.x = ML; doc.y += EN ? 30 : 24;
      }
      // 性情章附四维数据条（与网页「DATA · 性情四维」对齐）
      if (dom.pageKey === "nature") {
        const quad: [string, number][] = [
          [T(lang, "外向表达", "Extroversion"), profile.personality.extroversion],
          [T(lang, "情绪稳定", "Stability"), profile.personality.stability],
          [T(lang, "边界控制", "Boundary Control"), profile.personality.control],
          [T(lang, "情感感知", "Emotional Radar"), profile.personality.emotion],
        ];
        mono(T(lang, "DATA · 性情四维", "DATA · TEMPERAMENT QUAD"));
        for (const [label, value] of quad) colorBar(label, value, 100, dom.color, { labelW: 120 });
        doc.moveDown(0.25);
      }
      // AI 评述 + 建议（性情章为「更容易合拍的人」）
      if (page) {
        para(page.essay, INK, 11);
        labeled(T(lang, dom.adviceZh, dom.adviceEn), page.advice, dom.color);
      }
      doc.moveDown(0.5);
    }
  };

  const secChart = () => {
  // ── 壹 四柱命盘 ──────────────────────────────
  chapter(T(lang, "四柱命盘", "The Four Pillars"), "The Natal Chart");
  para(T(lang, "四柱是全部推算的起点。天干地支各自属五行，颜色即其五行归属——一眼看出这张盘由什么能量构成。", "The four pillars are the starting point of every calculation. Each stem and branch carries one of the five elements; the colour is that element."), SUB, 9.5);
  const pillars = profile.bazi.pillars;
  // 英文行标签更长（Ten God/Branch…），给左侧留出装订线避免压到第一列数据
  const gutter = lang === "en" ? 54 : 0;
  const tableLeft = ML + gutter, colW = (W - gutter) / 4, tableY = doc.y + 6;
  const rows: [string, string, (i: number) => { text: string; color?: string }][] = [
    [T(lang, "天干", "Stem"), "", (i) => ({ text: pillars[i].gan, color: EL_COLOR[GAN_EL[pillars[i].gan]] })],
    [T(lang, "地支", "Branch"), "", (i) => ({ text: pillars[i].zhi, color: EL_COLOR[ZHI_EL[pillars[i].zhi]] })],
    [T(lang, "十神", "Ten God"), "", (i) => ({ text: pillars[i].tenGod === "日主" ? T(lang, "日主", "Self") : godT(lang, pillars[i].tenGod) })],
    [T(lang, "藏干", "Hidden"), "", (i) => ({ text: pillars[i].hiddenStems.join("") })],
    [T(lang, "长生", "Stage"), "", (i) => ({ text: stageT(lang, pillars[i].stage) })],
  ];
  // 柱头
  const pillarHeadEn = ["Year", "Month", "Day", "Hour"];
  pillars.forEach((p, i) => { doc.font("hei").fontSize(9).fillColor(CINNABAR).text(lang === "en" ? pillarHeadEn[i] : p.label, tableLeft + i * colW, tableY, { width: colW, align: "center" }); });
  let ry = tableY + 18;
  rows.forEach(([label, , val], ri) => {
    doc.font("hei").fontSize(8).fillColor(FAINT).text(label, ML, ry + 5, { width: gutter ? gutter - 4 : 40 });
    pillars.forEach((_, i) => { const c = val(i); doc.font(ri < 2 ? "kai" : "hei").fontSize(ri < 2 ? 20 : 9.5).fillColor(c.color ?? INK).text(c.text, tableLeft + i * colW, ry + (ri < 2 ? 2 : 5), { width: colW, align: "center" }); });
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
  doc.font("kai").fontSize(lang === "en" ? 18 : 26).fillColor(CINNABAR).text(levelT(lang, dm.level), ML + 16, statY + 12, { width: 130 });
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
  doc.font("kai").fontSize(20).fillColor(CINNABAR).text(`${dp.name}（${godT(lang, dp.god)}）`, ML, doc.y, { width: W });
  doc.moveDown(0.3);
  para(dp.drive.replaceAll(" / ", "、"), SUB, 11);
  para(profile.combinedPersona.summary, INK, 12);
  doc.moveDown(0.3);
  labeled(T(lang, "行为底色", "Behaviour"), dp.behavior, CINNABAR);
  labeled(T(lang, "关系里", "In relationships"), dp.relationship, CINNABAR);
  doc.moveDown(0.4);
  // 定格（古法）——与网页人格建模区的「定格 · 古法」卡对齐
  h2(T(lang, "定格 · 古法", "Classical Pattern"));
  doc.font("kai").fontSize(17).fillColor(GOLD).text(patternT(lang, profile.pattern.name), ML, doc.y, { width: W });
  doc.moveDown(0.2);
  para(profile.pattern.basis, SUB, 10);
  doc.moveDown(0.4);
  h2(T(lang, "副轴与配轴", "Secondary Threads"));
  const sp = profile.secondaryPersona;
  if (sp) labeled(`${sp.name}（${godT(lang, sp.god)}）`, sp.drive.replaceAll(" / ", "、"), "#4f9d6b");
  const tp = profile.tertiaryPersona;
  if (tp) labeled(`${tp.name}（${godT(lang, tp.god)}）`, tp.drive.replaceAll(" / ", "、"), "#bf9a4e");
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
      para(T(lang, "逐年拆开：流年地支与你命盘的关系（冲/合婚姻宫、桃花与驿马是否引动、当年五行对你补还是耗），以及这一年具体该怎么过。", "Year by year: how the annual branch relates to your chart — clash/combine of the marriage palace, whether the Peach-Blossom or Travel star fires, and whether the year feeds or drains you — plus what to actually do."), FAINT, 9.5);
      doc.moveDown(0.2);
      // 逐项分析句 + 建议（按信号种类拼装）
      const SIG_TEXT: Record<string, { zh: string; en: string }> = {
        clash: { zh: "婚姻宫受冲：亲密关系与既定节奏这一年更容易被外部事件打断或加速，是感情与生活变动偏大的一年。重大决定放慢、多留确认时间，别在情绪冲动上定下终身大事。", en: "Marriage palace clashed: intimacy and routine are more easily disrupted or sped up this year. Slow big decisions and leave room to confirm." },
        combine: { zh: "婚姻宫得合：环境与核心关系更容易配合，是推进关系、定下名分、见家长这类大事的顺手窗口，想推进的别拖。", en: "Marriage palace combined: a smooth window to advance the relationship — don't stall on what you've been putting off." },
        taisui: { zh: "值太岁：自我课题被放大，容易对现状生出重新选择的冲动。冲动是信号不是命令，落地前给自己一个季度的观察期。", en: "Same as birth-year branch: self-questions amplify; observe a quarter before acting on the urge to change." },
        peach: { zh: "桃花引动：被关注、被示好的社交曝光明显上升。机会变多不等于结果，主动权与筛选权都在你手里；有伴的一方，透明是最省事的解法。", en: "Peach-Blossom fires: social exposure and charm rise. More chances, not outcomes — if attached, transparency is the easy fix." },
        horse: { zh: "驿马引动：搬迁、出差、换城市这类物理位移概率上升，生活半径可能被重画。涉及位置的机会出现时，第一时间纳入规划、和相关的人商量。", en: "Travel star fires: relocation or frequent travel likely; fold any location decision into your plans early." },
        feed: { zh: "流年五行补你的喜用：个人状态偏顺，情绪与精力余量足，是攒力气、做增量、推进个人目标的好时段。", en: "The year's element feeds your favorable element: a good stretch to build and push forward." },
        drain: { zh: "流年五行落忌神：个人耗电偏大，情绪余量变薄。这一年按省电模式过——守成、蓄力、少折腾，把身体和状态照顾好比冲刺更重要。", en: "The year's element hits your unfavorable element: run in low-power mode — consolidate rather than sprint." },
        steady: { zh: "无强结构引动：流年这一年不加戏也不递刀，质量完全取决于你自己怎么经营。适合把平时没空做的细活做了——复盘、储蓄、把关系里的小疙瘩谈开。", en: "No strong structure fires: a neutral year whose quality is up to you — good for the slow, overdue work." },
      };
      const ADVICE: Record<string, { zh: string; en: string }> = {
        clash: { zh: "把今年已知的大变动提前列出来，重大决定至少留一周冷静期。", en: "List the year's known changes early; give big decisions a cooling week." },
        combine: { zh: "想推进的那件事排上日程，趁窗口把它落地。", en: "Schedule the thing you want to advance and land it in the window." },
        taisui: { zh: "重大改变先小步试，别一次性推倒重来。", en: "Test big changes in small steps first." },
        peach: { zh: "把上扬的魅力用回该用的地方；社交多了，边界也要更清楚。", en: "Aim the rising charm where it belongs; keep boundaries clear." },
        horse: { zh: "任何涉及城市/租约/工作的机会，第一时间纳入整体规划。", en: "Bring any location-related opportunity into the plan immediately." },
        feed: { zh: "把重要的事排进今年，趁状态好做增量。", en: "Put the important things in this year while your energy is up." },
        drain: { zh: "降低今年的目标强度，把睡眠、身体和存款放前面。", en: "Lower the year's intensity; prioritise sleep, health and savings." },
        steady: { zh: "挑一件一直想做没做的事，趁平顺把它做了。", en: "Pick one overdue thing and get it done while it's calm." },
      };
      const baseYear = profile.luckCycles.currentYear || new Date().getFullYear();
      for (let k = 0; k < 5; k++) {
        const y = baseYear + k, gz = gzOf(y), zhi = gz[1], stem = gz[0];
        const kinds: string[] = [];
        const chips: { t: string; c: string }[] = [];
        if (clashMap[zhi] === db) { kinds.push("clash"); chips.push({ t: T(lang, "冲婚姻宫", "clash"), c: "#c85a4c" }); }
        else if (combineMap[zhi] === db) { kinds.push("combine"); chips.push({ t: T(lang, "合婚姻宫", "combine"), c: "#4f9d6b" }); }
        else if (zhi === yb) { kinds.push("taisui"); chips.push({ t: T(lang, "值太岁", "tai-sui"), c: "#bf9a4e" }); }
        if (zhi === peachOf(db) || zhi === peachOf(yb)) { kinds.push("peach"); chips.push({ t: T(lang, "桃花", "peach"), c: "#c96f7d" }); }
        if (zhi === horseOf(db) || zhi === horseOf(yb)) { kinds.push("horse"); chips.push({ t: T(lang, "驿马", "travel"), c: "#bf9a4e" }); }
        const el = ganEl[stem];
        if (favSet.has(el)) { kinds.push("feed"); chips.push({ t: T(lang, "补气", "feeds"), c: "#4f9d6b" }); }
        else if (unfavSet.has(el)) { kinds.push("drain"); chips.push({ t: T(lang, "耗气", "drains"), c: "#9a9587" }); }
        if (!kinds.length) { kinds.push("steady"); chips.push({ t: T(lang, "平顺", "steady"), c: "#9a9587" }); }
        ensure(70);
        const yy = doc.y;
        // 年份 + 干支 + 信号 chips
        doc.font("kai").fontSize(15).fillColor(k === 0 ? CINNABAR : INK).text(`${y}`, ML, yy, { width: 44, lineBreak: false });
        doc.font("kai").fontSize(13).fillColor(SUB).text(gz, ML + 46, yy + 2, { width: 40, lineBreak: false });
        let sx = ML + 92;
        for (const c of chips) { const w = doc.font("hei").fontSize(8.5).widthOfString(c.t) + 12; doc.roundedRect(sx, yy + 1, w, 15, 4).fillColor(c.c).fill(); doc.fillColor("#fff").fontSize(8.5).text(c.t, sx + 6, yy + 3.5, { lineBreak: false }); sx += w + 5; }
        doc.x = ML; doc.y = yy + 22;
        // 具体分析（把命中的信号句拼起来）
        const analysis = kinds.map((kk) => T(lang, SIG_TEXT[kk].zh, SIG_TEXT[kk].en)).join(lang === "en" ? " " : "");
        para(analysis, INK, 10.5);
        labeled(T(lang, "这一年怎么过", "This year"), T(lang, ADVICE[kinds[0]].zh, ADVICE[kinds[0]].en), k === 0 ? CINNABAR : "#8a6d2f", 10);
        doc.moveDown(0.35);
        doc.moveTo(ML, doc.y).lineTo(ML + W, doc.y).lineWidth(0.4).strokeColor(LINE).stroke();
        doc.moveDown(0.45);
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

  // 标签判定依据（第二部分）：每个综合评定标签由哪些指标+阈值触发（分数条+阈值刻度线）
  const secTagEvidence = () => {
    if (!opts.tags) return;
    const domains: [keyof PersonaTags, string, string, string][] = [
      ["love", "感情", "Love", "#c96f7d"], ["career", "事业", "Career", "#bf9a4e"],
      ["social", "人际", "Social", "#4f9d6b"], ["energy", "能量·时运", "Energy", "#4a7fb0"],
    ];
    chapter(T(lang, "标签判定依据", "How the Tags Were Assigned"), "Metrics & Thresholds");
    para(T(lang, "前面综合评定的每个标签，都由指标分数越过命中阈值触发。下方给出每个标签的判定指标——竖线是阈值，条越过线，标签才成立。", "Each tag in the assessment is triggered by metric scores crossing a threshold. Below are the metrics behind each tag — the tick is the threshold; a bar past it is why the tag holds."), SUB, 9.5);
    doc.moveDown(0.2);
    for (const [key, zh, en, color] of domains) {
      const hits = opts.tags[key];
      if (!hits?.length) continue;
      ensure(30);
      doc.font("kai").fontSize(14).fillColor(color).text(T(lang, zh, en), ML, doc.y, { width: W });
      doc.moveDown(0.3);
      for (const hit of hits) {
        ensure(20 + hit.metrics.length * 15);
        const tw = doc.font("hei").fontSize(10).widthOfString(hit.tag) + 16;
        doc.roundedRect(ML, doc.y, tw, 16, 5).fillColor(color).fill();
        doc.fillColor("#fff").fontSize(10).text(hit.tag, ML + 8, doc.y + 2.5, { lineBreak: false });
        doc.x = ML; doc.y += 21;
        for (const m of hit.metrics) {
          ensure(15); const y = doc.y, lw = 100, barLeft = ML + lw, barW = W - lw - 40;
          doc.font("hei").fontSize(9).fillColor(SUB).text(m.label, ML + 8, y + 1, { width: lw - 12, lineBreak: false });
          doc.roundedRect(barLeft, y + 2, barW, 6, 3).fillColor(TRACK).fill();
          doc.roundedRect(barLeft, y + 2, Math.max(4, barW * Math.min(100, m.value) / 100), 6, 3).fillColor(color).fill();
          if (m.t !== undefined) { const tx = barLeft + barW * Math.min(100, m.t) / 100; doc.moveTo(tx, y).lineTo(tx, y + 10).lineWidth(1).strokeColor(INK).stroke(); }
          doc.font("en").fontSize(8.5).fillColor(color).text(String(m.value), barLeft + barW + 6, y, { width: 30, lineBreak: false });
          doc.x = ML; doc.y = y + 14;
        }
        doc.moveDown(0.2);
      }
      doc.moveDown(0.15);
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
  // 第一部分 · 结论评定（给所有人看）：只放能直接读懂的结论
  secAssessment();   // 综合评定：性格特点 + 四域标签 + 评述 + 建议
  secTiming();       // 五年流年评定
  // 第二部分 · 深度分析（命理底层，需要一定了解）：结论从哪来
  partDivider("深度分析", "Deep Analysis",
    "以下是这份报告的推算底层：命主八字四柱、五行力量、日主强弱、十神分布、标签判定、人格与行为拆解、十二维与专长天赋。这部分展示「结论从哪里来」，需要一点命理基础才能完全看懂——看不懂不影响前面的评定。",
    "What follows is the method beneath the report: the four pillars, element weights, day-master strength, Ten-God distribution, tag thresholds, persona & behaviour breakdown, the twelve dimensions and aptitudes. It shows where the conclusions come from and assumes some familiarity with the method.");
  secChart();        // 命主八字四柱
  secElements();     // 五行力量 + 计分明细
  secDayMaster();    // 日主强弱判定
  secTenGods();      // 十神分布 + 出处
  secTagEvidence();  // 标签判定依据（指标+阈值）
  secPersona();      // 人格画像
  secBehavior();     // 行为模式
  secDims();         // 十二维深度画像
  secSpecialty();    // 专长与天赋
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
