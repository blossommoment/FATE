import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import type { AgentReportJson } from "./agentReport";

// Agent 报告 PDF 排版（pdfkit）。中文字体默认取 Windows 黑体，可用 FATE_PDF_FONT 覆盖（部署到 Linux 时指向随包字体）。
// 版式沿网站编辑风：墨黑正文、绿粉双色对比条、等宽小字眉标；数字以条形+数值呈现。

const FONT_CANDIDATES = [
  process.env.FATE_PDF_FONT ?? "",
  "C:\\Windows\\Fonts\\simhei.ttf",
  "C:\\Windows\\Fonts\\msyh.ttc",
];

const INK = "#26241d";
const SUB = "#6f6b5e";
const FAINT = "#9a9587";
const GREEN = "#4b9a82";
const PINK = "#d47c88";
const TRACK = "#eceadf";
const CARD = "#f7f5ee";

export async function buildReportPdf(report: AgentReportJson, options: { bilingual: boolean; names: [string, string] }): Promise<Buffer> {
  const fontPath = FONT_CANDIDATES.find((candidate) => candidate && existsSync(candidate));
  if (!fontPath) throw new Error("未找到可用中文字体：请设置 FATE_PDF_FONT 指向一个 .ttf 字体文件。");

  const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 64, left: 56, right: 56 }, font: fontPath, info: { Title: `FATE Duo Report ${report.reportId}` } });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const pageWidth = doc.page.width - 112;
  const ensure = (needed: number) => { if (doc.y + needed > doc.page.height - 72) doc.addPage(); };
  const mono = (text: string) => { doc.fontSize(8).fillColor(FAINT).text(text.toUpperCase(), { characterSpacing: 1.2 }); doc.moveDown(0.3); };
  const h1 = (zh: string, en?: string) => { ensure(70); doc.fontSize(20).fillColor(INK).text(zh); if (en) doc.fontSize(10).fillColor(FAINT).text(en); doc.moveDown(0.6); };
  const h2 = (text: string) => { ensure(50); doc.fontSize(13).fillColor(INK).text(text); doc.moveDown(0.35); };
  const p = (text: string, color = INK, size = 10.5) => { ensure(40); doc.fontSize(size).fillColor(color).text(text, { lineGap: 3.5 }); doc.moveDown(0.4); };
  const small = (text: string) => p(text, SUB, 9);
  const divider = () => { ensure(20); doc.moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).lineWidth(0.5).strokeColor("#ddd8c9").stroke(); doc.moveDown(0.6); };
  const bar = (label: string, value: number, color: string, maxValue = 100, pair?: { value: number; color: string }) => {
    ensure(pair ? 30 : 20);
    const barLeft = 170;
    const barWidth = pageWidth - (barLeft - 56) - 40;
    const startY = doc.y;
    doc.fontSize(9).fillColor(SUB).text(label, 56, startY, { width: barLeft - 66, lineBreak: false });
    const drawLine = (val: number, col: string, yy: number) => {
      doc.rect(barLeft, yy, barWidth, 5).fillColor(TRACK).fill();
      doc.rect(barLeft, yy, Math.max(4, Math.min(barWidth, barWidth * val / maxValue)), 5).fillColor(col).fill();
      doc.fontSize(8.5).fillColor(SUB).text(String(val), barLeft + barWidth + 6, yy - 2, { lineBreak: false });
    };
    drawLine(value, color, startY + 2);
    if (pair) drawLine(pair.value, pair.color, startY + 12);
    doc.x = 56;
    doc.y = startY + (pair ? 24 : 14);
  };
  const [nameA, nameB] = options.names;

  // ── 封面 ─────────────────────────────────────────────────────
  doc.moveDown(3);
  mono("FATE° · Eastern Persona Modeling · FATE Model 2.0");
  doc.fontSize(30).fillColor(INK).text("双人深度解读报告");
  doc.fontSize(13).fillColor(FAINT).text("Duo Compatibility Report");
  doc.moveDown(1.2);
  doc.fontSize(12).fillColor(INK).text(`${nameA} × ${nameB} · ${report.relationType}`);
  report.persons.forEach((person) => { doc.fontSize(10).fillColor(SUB).text(`${person.name} — ${person.dayPillar}日柱 · ${person.strength} · ${person.attachment}依恋`); });
  doc.moveDown(1.2);
  doc.fontSize(16).fillColor(INK).text(`关系判词：${report.verdict.title}`);
  doc.fontSize(10.5).fillColor(SUB).text(report.verdict.quip, { lineGap: 3 });
  doc.moveDown(2);
  doc.fontSize(9).fillColor(FAINT).text(`报告编号 Report ID：${report.reportId}`);
  doc.fontSize(9).fillColor(FAINT).text(`生成时间 Generated：${report.generatedAt}`);

  // ── 目录（双语） ─────────────────────────────────────────────
  doc.addPage();
  mono("Table of Contents");
  h1("目录", "Contents");
  report.toc.forEach((item) => {
    ensure(24);
    doc.fontSize(11).fillColor(INK).text(`${item.no} · ${item.zh}`, { continued: false });
    doc.fontSize(8.5).fillColor(FAINT).text(`     ${item.en}`);
    doc.moveDown(0.35);
  });
  doc.moveDown(0.5);
  divider();
  mono("Executive Summary");
  h2("执行摘要");
  p(report.summary.zh);
  if (options.bilingual && report.summary.en) { doc.moveDown(0.3); h2("Executive Summary (EN)"); p(report.summary.en, SUB, 9.5); }

  // ── 壹 · 关系总览 ────────────────────────────────────────────
  doc.addPage();
  mono("Chapter 1 · Relationship Overview");
  h1("壹 · 关系总览");
  p(`综合评分 ${report.score} 分 —— ${report.chapters.overview.thesis}`);
  small(report.chapters.overview.scoreSummary);
  doc.moveDown(0.3);
  report.scoreBreakdown.forEach((dim) => bar(`${dim.label}`, dim.score, GREEN));
  doc.moveDown(0.4);
  small(`判据：${report.verdict.basis} —— ${report.verdict.tagline}`);

  // ── 贰 · 两人底色 ────────────────────────────────────────────
  doc.addPage();
  mono("Chapter 2 · Two Blueprints");
  h1("贰 · 两人底色");
  h2("你们最不一样的三处");
  report.chapters.nature.diffs.forEach((diff) => {
    bar(diff.label, diff.a, GREEN, 100, { value: diff.b, color: PINK });
    small(`${nameA} · ${diff.aReading}`);
    small(`${nameB} · ${diff.bReading}`);
    doc.moveDown(0.2);
  });
  report.chapters.nature.manuals.forEach((manual) => {
    ensure(120);
    h2(`${manual.person} 使用说明书`);
    manual.dos.forEach((entry) => p(`＋ ${entry}`, INK, 10));
    manual.donts.forEach((entry) => p(`－ ${entry}`, "#8e4a55", 10));
    doc.moveDown(0.2);
  });

  // ── 叁 · 八字化学反应 ────────────────────────────────────────
  doc.addPage();
  mono("Chapter 3 · Chart Chemistry");
  h1("叁 · 八字化学反应");
  if (!report.chapters.structure.length) p("两张命盘之间没有形成明显的六合、六冲、三合、三会或天干相克，互动重点更多落在双方十神与行为维度。");
  report.chapters.structure.forEach((dynamic) => {
    ensure(110);
    h2(`${dynamic.type} · ${dynamic.title}`);
    small(`${nameA}：${dynamic.userPillars.join("、")} ｜ ${nameB}：${dynamic.partnerPillars.join("、")} ｜ ${dynamic.scoreImpact > 0 ? "增益结构" : "压力结构"}`);
    bar("结构强度", dynamic.strength, dynamic.scoreImpact > 0 ? GREEN : PINK);
    p(dynamic.summary);
    p(dynamic.scenarioImpact, SUB, 10);
    small(`怎么相处：${dynamic.advice}`);
    divider();
  });

  // ── 肆 · 相处样态 ────────────────────────────────────────────
  doc.addPage();
  mono("Chapter 4 · Everyday Patterns");
  h1("肆 · 相处样态");
  small(`对比条：绿 = ${nameA}，粉 = ${nameB}`);
  report.chapters.manner.forEach((behavior) => {
    ensure(90);
    h2(`${behavior.label} —— ${behavior.conclusion}`);
    p(behavior.basis, SUB, 10);
    behavior.metrics.forEach((metric) => bar(metric.label, metric.a, GREEN, 100, metric.b !== undefined ? { value: metric.b, color: PINK } : undefined));
    doc.moveDown(0.3);
  });

  // ── 伍 · 摩擦与化解 ──────────────────────────────────────────
  doc.addPage();
  mono("Chapter 5 · Frictions & Remedies");
  h1("伍 · 摩擦与化解");
  p(report.chapters.reef.philosophy, SUB, 10);
  report.chapters.reef.hotspots.forEach((hotspot, index) => {
    ensure(110);
    h2(`0${index + 1} ${hotspot.scene}`);
    small(hotspot.source);
    hotspot.metrics.forEach((metric) => bar(metric.label, metric.a, GREEN, 100, metric.b !== undefined ? { value: metric.b, color: PINK } : undefined));
    p(hotspot.risk);
    small(`拆法：${hotspot.playbook}`);
    divider();
  });

  // ── 陆 · 未来五年 ────────────────────────────────────────────
  doc.addPage();
  mono("Chapter 6 · The Next Five Years");
  h1("陆 · 未来五年");
  small("逐年只列倾向：倾向值与触发它的结构信号。节律供安排节奏参考，不作吉凶断言。");
  report.chapters.rhythm.forEach((year) => {
    ensure(120);
    h2(`${year.year} ${year.ganZhi} —— ${year.tendencies[0] ? `${year.tendencies[0].label}倾向为主` : "无强倾向"}`);
    year.tendencies.forEach((tendency) => {
      bar(`${tendency.label}倾向`, tendency.value, tendency.key === "advance" ? GREEN : tendency.key === "turbulence" ? PINK : "#c8a35a");
      small(`信号：${tendency.causes.map((cause) => `${cause.who}·${cause.label}`).join("、")}`);
    });
    p(year.reading, INK, 10);
    small(`这一年怎么过：${year.advice}`);
    divider();
  });

  // ── 柒 · 深度评述五章 ────────────────────────────────────────
  doc.addPage();
  mono("Chapter 7 · In-Depth Essays");
  h1("柒 · 深度评述", report.book.source === "ai" ? "Composed by FATE narrative layer" : "Deterministic edition");
  h2(`「${report.book.headline}」`);
  const pageNames: Record<string, string> = { origin: "缘起", daily: "相处", friction: "摩擦", longrun: "长线", season: "时运" };
  Object.entries(report.book.pages).forEach(([key, page]) => {
    ensure(100);
    h2(pageNames[key] ?? key);
    p(page.essay);
    small(`一起做的一件事：${page.advice}`);
    doc.moveDown(0.2);
  });

  // ── 免责声明（双语） ─────────────────────────────────────────
  doc.addPage();
  mono("Disclaimer");
  h1("免责声明", "Disclaimer");
  ensure(80);
  doc.rect(56, doc.y, pageWidth, 0.1).fillColor(CARD).fill();
  p(report.disclaimer.zh, SUB, 10);
  doc.moveDown(0.4);
  p(report.disclaimer.en, FAINT, 9.5);
  doc.moveDown(1);
  small(`${report.brand} ｜ ${report.reportId}`);

  doc.end();
  return finished;
}
