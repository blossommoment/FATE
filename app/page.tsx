import type { Metadata } from "next";
import ZwxLanding from "@/components/zwx/ZwxLanding";
import ZwxReportShell from "@/components/zwx/ZwxReportShell";
import InviteLanding from "@/components/InviteLanding";
import { ResultContent } from "@/app/result/page";
import type { BirthInput } from "@/lib/types";

export async function generateMetadata({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const query = await searchParams;
  const ogImage = { url: "/images/five-elements-hero.png", width: 1200, height: 630 };
  if (query.inviteYear && query.year === undefined) {
    const inviter = String(query.inviteName ?? "TA");
    const title = `「${inviter}」想和你合一盘 | FATE°`;
    const description = "填上你的出生时间，两个人的关系剧本同时展开：怎么沟通、如何升温、冲突从哪里开始。不需要注册，一条链接就是档案。";
    return { title, description, openGraph: { title, description, images: [ogImage] } };
  }
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
  const hasBirth = ["year", "month", "day", "hour"].every((key) => query[key] !== undefined);
  if (!hasBirth && query.inviteYear) {
    const inviter: BirthInput = {
      year: Number(query.inviteYear), month: Number(query.inviteMonth),
      day: Number(query.inviteDay), hour: Number(query.inviteHour),
      minute: Number(query.inviteMinute ?? 0), name: String(query.inviteName ?? "TA"),
      gender: query.inviteGender === "male" ? "male" : "female",
      calendarType: query.inviteCalendarType === "lunar" ? "lunar" : "solar",
      isLeapMonth: query.inviteIsLeapMonth === "true",
    };
    return <ZwxReportShell><InviteLanding inviter={inviter} relationType={String(query.relationType ?? "恋爱")} /></ZwxReportShell>;
  }
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
  // 排盘后结果页顶部直接是日主信息卡；落地页只在没有生辰参数时出现
  return (
    <>
      {!hasBirth && <ZwxLanding />}
      {hasBirth && <ZwxReportShell><ResultContent birth={birth} view={view} partnerBirth={partnerBirth} relationType={String(query.relationType ?? "恋爱")} detail={String(query.detail ?? "")} assistantQuestion={String(query.ask ?? "")} flowYear={Number(query.flowYear ?? new Date().getFullYear())} moduleKey={typeof query.module === "string" ? query.module : ""} /></ZwxReportShell>}
    </>
  );
}
