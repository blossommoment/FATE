import Link from "next/link";
import DuoReport from "@/components/DuoReport";
import ShareButton from "@/components/ShareButton";
import ZwxReportShell from "@/components/zwx/ZwxReportShell";
import { validateBirth } from "@/lib/fate";
import { openReportState, sealReportState } from "@/lib/reportState";
import type { BirthInput } from "@/lib/types";
import { redirect } from "next/navigation";

// 双人深度解读报告独立页（REQ_DUO_REPORT B3：单开一页 + 分享按钮）

export default async function DuoReportPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const stateToken = typeof query.state === "string" ? query.state : "";
  const decoded = stateToken ? openReportState(stateToken) : null;
  if (stateToken && !decoded) {
    return <ZwxReportShell><main className="report-page"><p className="report-error">这个私密报告链接已过期或无效，请重新起盘。</p><Link href="/">← 返回首页</Link></main></ZwxReportShell>;
  }
  const legacyA: BirthInput = {
    year: Number(query.year), month: Number(query.month),
    day: Number(query.day), hour: Number(query.hour),
    minute: Number(query.minute ?? 0), name: String(query.name ?? "我"),
    gender: query.gender === "male" ? "male" : "female",
    calendarType: query.calendarType === "lunar" ? "lunar" : "solar",
    isLeapMonth: query.isLeapMonth === "true",
  };
  const legacyB: BirthInput = {
    year: Number(query.partnerYear), month: Number(query.partnerMonth),
    day: Number(query.partnerDay), hour: Number(query.partnerHour),
    minute: Number(query.partnerMinute ?? 0), name: String(query.partnerName ?? "TA"),
    gender: query.partnerGender === "female" ? "female" : "male",
    calendarType: query.partnerCalendarType === "lunar" ? "lunar" : "solar",
    isLeapMonth: query.partnerIsLeapMonth === "true",
  };
  const legacyRelationType = String(query.relationType ?? "恋爱");
  if (!decoded && ["year", "month", "day", "hour", "partnerYear", "partnerMonth", "partnerDay", "partnerHour"].every((key) => query[key] !== undefined)) {
    try {
      redirect(`/report/duo?state=${encodeURIComponent(sealReportState({ birth: legacyA, partnerBirth: legacyB, relationType: legacyRelationType }))}`);
    } catch (error) {
      return <ZwxReportShell><main className="report-page"><p className="report-error">{error instanceof Error ? error.message : "无法保护这次报告链接。"}</p><Link href="/">← 返回首页</Link></main></ZwxReportShell>;
    }
  }
  const a = decoded?.birth ?? legacyA;
  const b = decoded?.partnerBirth ?? legacyB;
  const relationType = decoded?.relationType ?? legacyRelationType;
  const error = validateBirth(a) ?? validateBirth(b);
  if (error) {
    return <ZwxReportShell><main className="report-page"><p className="report-error">{error}</p><Link href="/">← 返回首页</Link></main></ZwxReportShell>;
  }
  return <ZwxReportShell><main className="report-page">
    <div className="report-topbar">
      <Link href={`/?state=${encodeURIComponent(stateToken)}&view=match#match-report`}>← 返回关系剧本</Link>
      <ShareButton title={`FATE° 双人深度解读 · ${a.name ?? "我"} × ${b.name ?? "TA"}`} />
    </div>
    <DuoReport state={stateToken} autoGenerate={query.paid === "1"} />
  </main></ZwxReportShell>;
}
