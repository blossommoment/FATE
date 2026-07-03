import Link from "next/link";
import FateReport from "@/components/FateReport";
import ShareButton from "@/components/ShareButton";
import { validateBirth } from "@/lib/fate";
import type { BirthInput } from "@/lib/types";

// 深度解读报告独立页（2026-07-03 拍板：报告开新页 + 分享按钮）

export default async function ReportPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const birth: BirthInput = {
    year: Number(query.year), month: Number(query.month),
    day: Number(query.day), hour: Number(query.hour),
    minute: Number(query.minute ?? 0), name: String(query.name ?? "我"),
    gender: query.gender === "male" ? "male" : "female",
    calendarType: query.calendarType === "lunar" ? "lunar" : "solar",
    isLeapMonth: query.isLeapMonth === "true",
  };
  const error = validateBirth(birth);
  const backQuery = new URLSearchParams({
    year: String(birth.year), month: String(birth.month), day: String(birth.day),
    hour: String(birth.hour), minute: String(birth.minute ?? 0), name: birth.name ?? "我",
    gender: birth.gender ?? "female", calendarType: birth.calendarType ?? "solar",
    isLeapMonth: String(birth.isLeapMonth ?? false),
  }).toString();
  if (error) {
    return <main className="report-page"><p className="report-error">{error}</p><Link href="/">← 返回首页</Link></main>;
  }
  const profileId = `${birth.year}${String(birth.month).padStart(2, "0")}${String(birth.day).padStart(2, "0")}${String(birth.hour).padStart(2, "0")}${String(birth.minute ?? 0).padStart(2, "0")}`;
  return <main className="report-page">
    <div className="report-topbar">
      <Link href={`/?${backQuery}&view=deep#deep-report`}>← 返回深度分析</Link>
      <ShareButton title="FATE° 深度解读报告 · 东方人格建模" />
    </div>
    <FateReport birth={birth} profileId={profileId} />
  </main>;
}
