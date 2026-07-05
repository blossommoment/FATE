import Link from "next/link";
import DuoReport from "@/components/DuoReport";
import ShareButton from "@/components/ShareButton";
import ZwxReportShell from "@/components/zwx/ZwxReportShell";
import { validateBirth } from "@/lib/fate";
import type { BirthInput } from "@/lib/types";

// 双人深度解读报告独立页（REQ_DUO_REPORT B3：单开一页 + 分享按钮）

const profileId = (birth: BirthInput) =>
  `${birth.year}${String(birth.month).padStart(2, "0")}${String(birth.day).padStart(2, "0")}${String(birth.hour).padStart(2, "0")}${String(birth.minute ?? 0).padStart(2, "0")}`;

export default async function DuoReportPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const a: BirthInput = {
    year: Number(query.year), month: Number(query.month),
    day: Number(query.day), hour: Number(query.hour),
    minute: Number(query.minute ?? 0), name: String(query.name ?? "我"),
    gender: query.gender === "male" ? "male" : "female",
    calendarType: query.calendarType === "lunar" ? "lunar" : "solar",
    isLeapMonth: query.isLeapMonth === "true",
  };
  const b: BirthInput = {
    year: Number(query.partnerYear), month: Number(query.partnerMonth),
    day: Number(query.partnerDay), hour: Number(query.partnerHour),
    minute: Number(query.partnerMinute ?? 0), name: String(query.partnerName ?? "TA"),
    gender: query.partnerGender === "female" ? "female" : "male",
    calendarType: query.partnerCalendarType === "lunar" ? "lunar" : "solar",
    isLeapMonth: query.partnerIsLeapMonth === "true",
  };
  const relationType = String(query.relationType ?? "恋爱");
  const error = validateBirth(a) ?? validateBirth(b);
  if (error) {
    return <ZwxReportShell><main className="report-page"><p className="report-error">{error}</p><Link href="/">← 返回首页</Link></main></ZwxReportShell>;
  }
  const backQuery = new URLSearchParams({
    year: String(a.year), month: String(a.month), day: String(a.day), hour: String(a.hour),
    minute: String(a.minute ?? 0), name: a.name ?? "我", gender: a.gender ?? "female",
    calendarType: a.calendarType ?? "solar", isLeapMonth: String(a.isLeapMonth ?? false),
    partnerYear: String(b.year), partnerMonth: String(b.month), partnerDay: String(b.day),
    partnerHour: String(b.hour), partnerMinute: String(b.minute ?? 0), partnerName: b.name ?? "TA",
    partnerGender: b.gender ?? "male", partnerCalendarType: b.calendarType ?? "solar",
    partnerIsLeapMonth: String(b.isLeapMonth ?? false), relationType,
  }).toString();
  const pairId = `${profileId(a)}-${profileId(b)}-${relationType}`;
  return <ZwxReportShell><main className="report-page">
    <div className="report-topbar">
      <Link href={`/?${backQuery}&view=match#match-report`}>← 返回关系剧本</Link>
      <ShareButton title={`FATE° 双人深度解读 · ${a.name ?? "我"} × ${b.name ?? "TA"}`} />
    </div>
    <DuoReport a={a} b={b} relationType={relationType} pairId={pairId} />
  </main></ZwxReportShell>;
}
