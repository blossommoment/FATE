import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";

// Agent 报告 PDF：全内容双语 + 双方四柱命盘 + 编辑风版式。
// 字体：全部用磁盘 TTF（楷体标题 + 黑体正文，英文借用其拉丁字形）。
// 【不用 pdfkit 内置字体】——其 .afm 度量文件在 Next.js 打包后按 C:\ROOT 解析失败(ENOENT)。

// 字体候选：环境变量优先 → Linux 部署路径（开源中文字体）→ Windows 本地兜底。
const LINUX_HEI = ["/opt/fate/fonts/NotoSansSC-Regular.otf", "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"];
const LINUX_KAI = ["/opt/fate/fonts/NotoSerifSC-Regular.otf", "/usr/share/fonts/truetype/arphic/ukai.ttc", ...LINUX_HEI];
const HEI_CANDIDATES = [process.env.FATE_PDF_FONT_HEI ?? "", ...LINUX_HEI, "C:\\Windows\\Fonts\\simhei.ttf"];
const KAI_CANDIDATES = [process.env.FATE_PDF_FONT_KAI ?? "", ...LINUX_KAI, "C:\\Windows\\Fonts\\simkai.ttf", "C:\\Windows\\Fonts\\simhei.ttf"];

const INK = "#26241d";
const SUB = "#5f5b50";
const FAINT = "#9a9587";
const CINNABAR = "#a5402e"; // 朱砂
const GREEN = "#4b9a82";
const PINK = "#c96f7d";
const GOLD = "#bf9a4e";
const LINE = "#ddd8c9";
const CARD = "#f6f3ea";
const TRACK = "#eae7db";

export type Bi = { zh: string; en: string };
export type BarItem = { label: Bi; a: number; b?: number; tone?: "green" | "pink" | "gold" };
export type BaziChart = {
  name: string;
  dayMaster: string;
  strength: string;
  favorable: string;
  attachment: string;
  pillars: { label: string; gan: string; zhi: string; tenGod: string; hidden: string; hiddenGods: string; wuXing: string; stage: string }[];
};

export type ReportBlock =
  | { t: "chapter"; no: string; title: Bi }
  | { t: "h2"; title: Bi }
  | { t: "para"; text: Bi }
  | { t: "small"; text: Bi }
  | { t: "do"; text: Bi }
  | { t: "dont"; text: Bi }
  | { t: "bars"; legend?: [string, string]; items: BarItem[] }
  | { t: "divider" }
  | { t: "spacer" };

export type ReportMeta = {
  reportId: string;
  generatedAt: string;
  relationType: string;
  names: [string, string];
  verdictTitle: string;
  verdictQuip: string;
  disclaimerZh: string;
  disclaimerEn: string;
};

const TONE_COLOR = { green: GREEN, pink: PINK, gold: GOLD } as const;
const PILLAR_LABEL: Record<string, string> = { 年柱: "Year", 月柱: "Month", 日柱: "Day", 时柱: "Hour" };

export async function buildReportPdf(args: {
  meta: ReportMeta;
  charts: [BaziChart, BaziChart];
  toc: { no: string; zh: string; en: string }[];
  blocks: ReportBlock[];
}): Promise<Buffer> {
  const hei = HEI_CANDIDATES.find((c) => c && existsSync(c));
  const kai = KAI_CANDIDATES.find((c) => c && existsSync(c));
  if (!hei) throw new Error("未找到中文字体：请设置 FATE_PDF_FONT_HEI 指向 .ttf。");

  const doc = new PDFDocument({ size: "A4", margins: { top: 62, bottom: 70, left: 60, right: 60 }, bufferPages: true, autoFirstPage: false, info: { Title: `FATE Duo Report ${args.meta.reportId}`, Author: "FATE Model 2.0" } });
  // 只用磁盘 TTF，绝不触碰 pdfkit 内置字体（其 .afm 度量文件在 Next.js 打包后路径解析失败）。
  // 英文也用中文字体的拉丁字形：黑体拉丁干净、楷体拉丁作重点点缀。
  doc.registerFont("hei", hei);
  doc.registerFont("kai", kai ?? hei);
  doc.registerFont("en", hei);
  doc.registerFont("enItalic", kai ?? hei);
  doc.font("hei"); // 立刻切到 TTF，避免默认 Helvetica 触发 .afm 读取
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const PAGE_W = 595.28, PAGE_H = 841.89; // A4 pt（autoFirstPage:false，首页前 doc.page 为 null，故用常量）
  const ML = 60, MR = 60;
  const W = PAGE_W - ML - MR;
  const bottomLimit = () => PAGE_H - 78;
  const ensure = (need: number) => { if (doc.y + need > bottomLimit()) doc.addPage(); };

  // ── 中英排版原子 ──────────────────────────────────────────
  const zhPara = (text: string, opts: { font?: "hei" | "kai"; size?: number; color?: string; gap?: number } = {}) => {
    doc.font(opts.font ?? "hei").fontSize(opts.size ?? 10.5).fillColor(opts.color ?? INK).text(text, ML, doc.y, { width: W, lineGap: opts.gap ?? 3.5, align: "left" });
  };
  const enPara = (text: string, opts: { serif?: boolean; size?: number; color?: string; italic?: boolean } = {}) => {
    const f = opts.serif ? (opts.italic ? "enItalic" : "en") : "en";
    doc.font(f).fontSize(opts.size ?? 9).fillColor(opts.color ?? SUB).text(text, ML, doc.y, { width: W, lineGap: 2.5, align: "left" });
  };
  const mono = (text: string) => { doc.font("en").fontSize(7.5).fillColor(FAINT).text(text.toUpperCase(), ML, doc.y, { width: W, characterSpacing: 1.3 }); doc.moveDown(0.35); };
  const divider = (color = LINE) => { ensure(16); doc.moveTo(ML, doc.y).lineTo(ML + W, doc.y).lineWidth(0.6).strokeColor(color).stroke(); doc.moveDown(0.55); };

  const biBlock = (zh: string, en: string, o: { size?: number; enSize?: number; color?: string; gap?: number } = {}) => {
    ensure(46);
    zhPara(zh, { size: o.size ?? 10.5, color: o.color ?? INK, gap: o.gap });
    if (en) { doc.moveDown(0.12); enPara(en, { serif: true, size: o.enSize ?? 9, color: FAINT, italic: true }); }
    doc.moveDown(0.5);
  };

  const h2 = (zh: string, en: string) => {
    ensure(48);
    doc.font("kai").fontSize(14).fillColor(INK).text(zh, ML, doc.y, { width: W });
    if (en) doc.font("enItalic").fontSize(9.5).fillColor(GOLD).text(en, ML, doc.y, { width: W });
    doc.moveDown(0.4);
  };

  const bars = (items: BarItem[], legend?: [string, string]) => {
    ensure(items.length * 20 + (legend ? 16 : 0) + 8);
    if (legend) {
      const y = doc.y;
      doc.rect(ML, y + 2, 14, 5).fillColor(GREEN).fill();
      doc.font("hei").fontSize(8.5).fillColor(SUB).text(legend[0], ML + 20, y, { width: 120, lineBreak: false });
      doc.rect(ML + 150, y + 2, 14, 5).fillColor(PINK).fill();
      doc.font("hei").fontSize(8.5).fillColor(SUB).text(legend[1], ML + 170, y, { width: 120, lineBreak: false });
      doc.x = ML; doc.y = y + 15;
    }
    const labelW = 200;
    const barLeft = ML + labelW;
    const barW = W - labelW - 30;
    for (const item of items) {
      const paired = item.b !== undefined;
      ensure(paired ? 26 : 16);
      const y = doc.y;
      doc.font("hei").fontSize(9).fillColor(SUB).text(item.label.zh, ML, y, { width: labelW - 8, lineBreak: false });
      if (item.label.en) doc.font("en").fontSize(7.5).fillColor(FAINT).text(item.label.en, ML, y + 10, { width: labelW - 8, lineBreak: false });
      const draw = (val: number, color: string, yy: number) => {
        doc.roundedRect(barLeft, yy, barW, 5, 2.5).fillColor(TRACK).fill();
        doc.roundedRect(barLeft, yy, Math.max(5, Math.min(barW, barW * val / 100)), 5, 2.5).fillColor(color).fill();
        doc.font("en").fontSize(8).fillColor(SUB).text(String(val), barLeft + barW + 6, yy - 1.5, { lineBreak: false });
      };
      draw(item.a, paired ? GREEN : TONE_COLOR[item.tone ?? "green"], y + 2);
      if (paired) draw(item.b!, PINK, y + 12);
      doc.x = ML; doc.y = y + (paired ? 24 : 15);
    }
    doc.moveDown(0.3);
  };

  // ── 封面 ──────────────────────────────────────────────────
  doc.addPage();
  doc.rect(0, 0, PAGE_W, PAGE_H).fillColor("#fbfaf5").fill();
  doc.y = 120;
  doc.font("en").fontSize(9).fillColor(CINNABAR).text("FATE° · EASTERN PERSONA MODELING", ML, doc.y, { width: W, align: "center", characterSpacing: 2 });
  doc.moveDown(1.4);
  doc.font("kai").fontSize(40).fillColor(INK).text("双人深度解读", ML, doc.y, { width: W, align: "center" });
  doc.font("en").fontSize(15).fillColor(FAINT).text("Duo Compatibility Report", ML, doc.y, { width: W, align: "center" });
  doc.moveDown(1.6);
  doc.font("hei").fontSize(13).fillColor(INK).text(`${args.meta.names[0]}  ×  ${args.meta.names[1]}`, ML, doc.y, { width: W, align: "center" });
  doc.font("hei").fontSize(10).fillColor(SUB).text(`${args.meta.relationType}  ·  ${args.meta.relationType === "恋爱" ? "Romance" : args.meta.relationType === "朋友" ? "Friendship" : args.meta.relationType === "同事" ? "Colleagues" : "Family"}`, ML, doc.y, { width: W, align: "center" });
  doc.moveDown(2);
  // 判词印章
  const sealW = 300, sealX = ML + (W - sealW) / 2, sealY = doc.y;
  doc.roundedRect(sealX, sealY, sealW, 74, 8).lineWidth(1.4).strokeColor(CINNABAR).stroke();
  doc.font("hei").fontSize(8).fillColor(CINNABAR).text("关系判词 · THE VERDICT", sealX, sealY + 12, { width: sealW, align: "center", characterSpacing: 1 });
  doc.font("kai").fontSize(24).fillColor(CINNABAR).text(args.meta.verdictTitle, sealX, sealY + 30, { width: sealW, align: "center" });
  doc.y = sealY + 74;
  doc.moveDown(1);
  doc.font("kai").fontSize(11).fillColor(SUB).text(args.meta.verdictQuip, ML + 40, doc.y, { width: W - 80, align: "center", lineGap: 4 });
  doc.y = PAGE_H - 130;
  doc.font("en").fontSize(8.5).fillColor(FAINT).text(`报告编号 Report ID   ${args.meta.reportId}`, ML, doc.y, { width: W, align: "center" });
  doc.font("en").fontSize(8.5).fillColor(FAINT).text(`生成时间 Generated   ${args.meta.generatedAt}`, ML, doc.y, { width: W, align: "center" });

  // ── 双方命盘 ──────────────────────────────────────────────
  doc.addPage();
  mono("The Two Charts · 双方命盘");
  doc.font("kai").fontSize(20).fillColor(CINNABAR).text("双方八字命盘", ML, doc.y, { width: W });
  doc.font("en").fontSize(11).fillColor(FAINT).text("The Two Natal Charts", ML, doc.y, { width: W });
  doc.moveDown(0.6);
  biBlock("先看清两个人，再谈这段关系。以下是双方的四柱排盘——天干地支、藏干与十神，是后续所有分析的底层依据。",
    "Understand two people first, then the bond between them. Below are both four-pillar charts — stems, branches, hidden stems and Ten Gods — the foundation of everything that follows.", { size: 10, enSize: 9 });
  doc.moveDown(0.3);

  const drawBazi = (chart: BaziChart) => {
    const rows: [string, string, (p: BaziChart["pillars"][number]) => string][] = [
      ["天干", "Stem", (p) => `${p.gan}·${p.tenGod}`],
      ["地支", "Branch", (p) => p.zhi],
      ["藏干", "Hidden", (p) => p.hidden],
      ["十神", "Ten God", (p) => p.hiddenGods],
      ["五行", "Element", (p) => p.wuXing],
      ["长生", "Stage", (p) => p.stage],
    ];
    ensure(30 + rows.length * 22 + 40);
    // 头部
    doc.font("hei").fontSize(11).fillColor(INK).text(chart.name, ML, doc.y, { width: W, continued: false });
    doc.font("hei").fontSize(8.5).fillColor(SUB).text(`日主 ${chart.dayMaster} · ${chart.strength} · 喜用 ${chart.favorable || "随岁运"} · ${chart.attachment}依恋`, ML, doc.y, { width: W });
    doc.font("en").fontSize(7.5).fillColor(FAINT).text(`Day Master ${chart.dayMaster} · ${chart.attachment}`, ML, doc.y, { width: W });
    doc.moveDown(0.4);
    const tableY = doc.y;
    const labelColW = 78;
    const cellW = (W - labelColW) / 4;
    const rowH = 22;
    // 列头
    doc.font("hei").fontSize(8).fillColor(FAINT).text("", ML, tableY);
    chart.pillars.forEach((p, i) => {
      const cx = ML + labelColW + i * cellW;
      const isDay = p.label === "日柱";
      if (isDay) doc.rect(cx, tableY, cellW, rowH * (rows.length + 1)).fillColor(CARD).fill();
      doc.font("hei").fontSize(8.5).fillColor(isDay ? CINNABAR : SUB).text(p.label, cx, tableY + 5, { width: cellW, align: "center" });
      doc.font("en").fontSize(6.5).fillColor(FAINT).text(PILLAR_LABEL[p.label] ?? "", cx, tableY + 15, { width: cellW, align: "center" });
    });
    let ry = tableY + rowH;
    rows.forEach(([zh, en, val]) => {
      doc.font("hei").fontSize(8.5).fillColor(SUB).text(zh, ML, ry + 5, { width: labelColW - 6, align: "left" });
      doc.font("en").fontSize(6.5).fillColor(FAINT).text(en, ML, ry + 15, { width: labelColW - 6, align: "left" });
      chart.pillars.forEach((p, i) => {
        const cx = ML + labelColW + i * cellW;
        doc.font("hei").fontSize(9).fillColor(INK).text(val(p), cx + 3, ry + 6, { width: cellW - 6, align: "center" });
      });
      ry += rowH;
    });
    // 表格网格线
    doc.lineWidth(0.4).strokeColor(LINE);
    for (let r = 0; r <= rows.length + 1; r++) doc.moveTo(ML, tableY + r * rowH).lineTo(ML + W, tableY + r * rowH).stroke();
    for (let c = 0; c <= 4; c++) doc.moveTo(ML + labelColW + c * cellW, tableY).lineTo(ML + labelColW + c * cellW, tableY + (rows.length + 1) * rowH).stroke();
    doc.moveTo(ML, tableY).lineTo(ML, tableY + (rows.length + 1) * rowH).stroke();
    doc.y = tableY + (rows.length + 1) * rowH + 10;
  };
  drawBazi(args.charts[0]);
  doc.moveDown(0.5);
  drawBazi(args.charts[1]);
  doc.moveDown(0.4);
  doc.font("hei").fontSize(7.5).fillColor(FAINT).text("十神 Ten Gods：比肩劫财=同类 Peer / 食神伤官=输出 Output / 正财偏财=经营 Wealth / 正官七杀=约束 Authority / 正印偏印=支持 Resource。", ML, doc.y, { width: W, lineGap: 2 });

  // ── 目录 ──────────────────────────────────────────────────
  doc.addPage();
  mono("Table of Contents · 目录");
  doc.font("kai").fontSize(20).fillColor(CINNABAR).text("目录", ML, doc.y, { width: W });
  doc.font("en").fontSize(11).fillColor(FAINT).text("Contents", ML, doc.y, { width: W });
  doc.moveDown(0.8);
  args.toc.forEach((item) => {
    ensure(30);
    const y = doc.y;
    doc.font("kai").fontSize(14).fillColor(CINNABAR).text(item.no, ML, y, { width: 30, lineBreak: false });
    doc.font("hei").fontSize(11.5).fillColor(INK).text(item.zh, ML + 34, y, { width: W - 34, lineBreak: false });
    doc.font("enItalic").fontSize(9).fillColor(FAINT).text(item.en, ML + 34, y + 15, { width: W - 34 });
    doc.moveDown(0.6);
  });

  // ── 正文 blocks ───────────────────────────────────────────
  doc.addPage();
  for (const block of args.blocks) {
    switch (block.t) {
      case "chapter": {
        if (doc.y > 90) doc.addPage();
        mono(`${block.title.en}`);
        const y = doc.y;
        doc.font("kai").fontSize(34).fillColor(CINNABAR).text(block.no, ML, y, { width: 60, lineBreak: false });
        doc.font("kai").fontSize(22).fillColor(INK).text(block.title.zh, ML + 58, y + 6, { width: W - 58 });
        doc.font("enItalic").fontSize(11).fillColor(GOLD).text(block.title.en, ML + 58, doc.y, { width: W - 58 });
        doc.y = Math.max(doc.y, y + 46);
        doc.moveDown(0.5);
        divider(CINNABAR);
        break;
      }
      case "h2": h2(block.title.zh, block.title.en); break;
      case "para": biBlock(block.text.zh, block.text.en); break;
      case "small": ensure(30); zhPara(block.text.zh, { size: 9, color: SUB, gap: 2.5 }); if (block.text.en) { doc.moveDown(0.1); enPara(block.text.en, { size: 8, color: FAINT }); } doc.moveDown(0.4); break;
      case "do": ensure(34); zhPara(`＋ ${block.text.zh}`, { size: 10, color: "#2c6a58" }); if (block.text.en) enPara(block.text.en, { size: 8.5, color: FAINT }); doc.moveDown(0.35); break;
      case "dont": ensure(34); zhPara(`－ ${block.text.zh}`, { size: 10, color: "#93454f" }); if (block.text.en) enPara(block.text.en, { size: 8.5, color: FAINT }); doc.moveDown(0.35); break;
      case "bars": bars(block.items, block.legend); break;
      case "divider": divider(); break;
      case "spacer": doc.moveDown(0.6); break;
    }
  }

  // ── 免责声明 ──────────────────────────────────────────────
  doc.addPage();
  mono("Disclaimer · 免责声明");
  doc.font("kai").fontSize(20).fillColor(CINNABAR).text("免责声明", ML, doc.y, { width: W });
  doc.font("en").fontSize(11).fillColor(FAINT).text("Disclaimer", ML, doc.y, { width: W });
  doc.moveDown(0.8);
  const dy = doc.y;
  doc.roundedRect(ML, dy, W, 4, 0).fillColor(CARD).fill();
  doc.y = dy + 12;
  zhPara(args.meta.disclaimerZh, { size: 10, color: SUB, gap: 4 });
  doc.moveDown(0.6);
  enPara(args.meta.disclaimerEn, { serif: true, size: 9, color: FAINT });

  // ── 页脚页码（buffered） ──────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.font("en").fontSize(8).fillColor(FAINT)
      .text(`FATE°  ·  ${args.meta.reportId}`, ML, PAGE_H - 52, { width: W / 2, lineBreak: false })
      .text(`${i} / ${range.count - 1}`, ML + W / 2, PAGE_H - 52, { width: W / 2, align: "right", lineBreak: false });
  }

  doc.end();
  return done;
}
