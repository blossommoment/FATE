import Link from "next/link";
import FateReport from "@/components/FateReport";
import ShareButton from "@/components/ShareButton";
import ZwxReportShell from "@/components/zwx/ZwxReportShell";
import { validateBirth } from "@/lib/fate";
import { openReportState, sealReportState } from "@/lib/reportState";
import type { BirthInput } from "@/lib/types";
import { redirect } from "next/navigation";

// 深度解读报告独立页（2026-07-03 拍板：报告开新页 + 分享按钮）

export default async function ReportPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const stateToken = typeof query.state === "string" ? query.state : "";
  const decoded = stateToken ? openReportState(stateToken) : null;
  if (stateToken && !decoded) {
    return <ZwxReportShell><main className="report-page"><p className="report-error">这个私密报告链接已过期或无效，请重新起盘。</p><Link href="/">← 返回首页</Link></main></ZwxReportShell>;
  }
  const legacyBirth: BirthInput = {
    year: Number(query.year), month: Number(query.month),
    day: Number(query.day), hour: Number(query.hour),
    minute: Number(query.minute ?? 0), name: String(query.name ?? "我"),
    gender: query.gender === "male" ? "male" : "female",
    calendarType: query.calendarType === "lunar" ? "lunar" : "solar",
    isLeapMonth: query.isLeapMonth === "true",
  };
  if (!decoded && ["year", "month", "day", "hour"].every((key) => query[key] !== undefined)) {
    try {
      redirect(`/report?state=${encodeURIComponent(sealReportState({ birth: legacyBirth, relationType: "恋爱" }))}`);
    } catch (error) {
      return <ZwxReportShell><main className="report-page"><p className="report-error">{error instanceof Error ? error.message : "无法保护这次报告链接。"}</p><Link href="/">← 返回首页</Link></main></ZwxReportShell>;
    }
  }
  const birth = decoded?.birth ?? legacyBirth;
  const error = validateBirth(birth);
  if (error) {
    return <ZwxReportShell><main className="report-page"><p className="report-error">{error}</p><Link href="/">← 返回首页</Link></main></ZwxReportShell>;
  }
  return <ZwxReportShell><main className="report-page">
    <div className="report-topbar">
      <Link href={`/?state=${encodeURIComponent(stateToken)}&view=deep#deep-report`}>← 返回深度分析</Link>
      <ShareButton title="FATE° 深度解读报告 · 东方人格建模" />
    </div>
    <FateReport state={stateToken} autoGenerate={query.paid === "1"} />
  </main></ZwxReportShell>;
}
