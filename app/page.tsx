import type { Metadata } from "next";
import ZwxLanding from "@/components/zwx/ZwxLanding";
import ZwxReportShell from "@/components/zwx/ZwxReportShell";
import { ResultContent } from "@/app/result/page";
import type { BirthInput } from "@/lib/types";
import { openReportState, sealReportState } from "@/lib/reportState";
import { validateBirth } from "@/lib/fate";
import { redirect } from "next/navigation";

export async function generateMetadata({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const query = await searchParams;
  const ogImage = { url: "/images/five-elements-hero.png", width: 1200, height: 630 };
  if (query.year !== undefined) {
    const name = String(query.name ?? "我");
    const isMatch = query.partnerYear !== undefined;
    const title = isMatch
      ? `${name} × ${String(query.partnerName ?? "TA")}的${String(query.relationType ?? "恋爱")}合盘 | FATE°`
      : `${name}的八字关系画像 | FATE°`;
    const description = isMatch
      ? "两张命盘放在一起，看你们怎么沟通、如何升温、冲突从哪里开始、吵架后怎么修复。"
      : "四柱、五行、十神与十二维关系人格——出生数据变成一种理解关系的新语言。";
    return { title, description, openGraph: { title, description, images: [ogImage] } };
  }
  const title = "FATE° — 星垂万古，照见一人";
  const description = "八字为经，星宿为纬。输入出生时间，FATE 模型 2.0 为你织就一册可解释的深度人格命书。";
  return { title, description, openGraph: { title, description, images: [ogImage] } };
}

export default async function Home({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const stateToken = typeof query.state === "string" ? query.state : "";
  if (stateToken) {
    const state = openReportState(stateToken);
    if (!state) {
      return <ZwxReportShell><main className="report-page"><p className="report-error">这个私密报告链接已过期或无效，请重新起盘。</p><a href="/">← 返回首页</a></main></ZwxReportShell>;
    }
    const error = [state.birth, state.partnerBirth].filter(Boolean).map((birth) => validateBirth(birth!)).find(Boolean);
    if (error) {
      return <ZwxReportShell><main className="report-page"><p className="report-error">{error}</p><a href="/">← 返回首页</a></main></ZwxReportShell>;
    }
    const view = query.view === "deep" || query.view === "match" || query.view === "square" ? query.view : "overview";
    return <ZwxReportShell><ResultContent state={stateToken} birth={state.birth} view={view} partnerBirth={state.partnerBirth} relationType={state.relationType} detail={String(query.detail ?? "")} assistantQuestion={String(query.ask ?? "")} flowYear={Number(query.flowYear ?? new Date().getFullYear())} moduleKey={typeof query.module === "string" ? query.module : ""} /></ZwxReportShell>;
  }
  const hasBirth = ["year", "month", "day", "hour"].every((key) => query[key] !== undefined);
  if (!hasBirth && query.inviteYear) redirect("/");
  const birth: BirthInput = {
    year: Number(query.year), month: Number(query.month),
    day: Number(query.day), hour: Number(query.hour),
    minute: Number(query.minute ?? 0), name: String(query.name ?? "我"),
    gender: query.gender === "male" ? "male" : "female",
    calendarType: query.calendarType === "lunar" ? "lunar" : "solar",
    isLeapMonth: query.isLeapMonth === "true",
  };
  const partnerBirth: BirthInput | undefined = query.partnerYear ? {
    year: Number(query.partnerYear), month: Number(query.partnerMonth),
    day: Number(query.partnerDay), hour: Number(query.partnerHour),
    minute: Number(query.partnerMinute ?? 0), name: String(query.partnerName ?? "TA"),
    gender: query.partnerGender === "female" ? "female" : "male",
    calendarType: query.partnerCalendarType === "lunar" ? "lunar" : "solar",
    isLeapMonth: query.partnerIsLeapMonth === "true",
  } : undefined;
  const view = query.view === "deep" || query.view === "match" || query.view === "square" ? query.view : "overview";
  if (hasBirth) {
    try {
      const state = sealReportState({ birth, partnerBirth, relationType: String(query.relationType ?? "恋爱") });
      const next = new URLSearchParams({ state, view });
      for (const key of ["detail", "ask", "flowYear", "module"] as const) {
        if (typeof query[key] === "string") next.set(key, query[key]);
      }
      redirect(`/?${next.toString()}`);
    } catch (error) {
      return <ZwxReportShell><main className="report-page"><p className="report-error">{error instanceof Error ? error.message : "无法保护这次报告链接。"}</p><a href="/">← 返回首页</a></main></ZwxReportShell>;
    }
  }
  // 落地页只在没有出生信息时出现。
  return (
    <>
      {!hasBirth && <ZwxLanding />}
    </>
  );
}
