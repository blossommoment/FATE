import Landing from "@/components/Landing";
import { ResultContent } from "@/app/result/page";
import type { BirthInput } from "@/lib/types";

export default async function Home({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const hasBirth = ["year", "month", "day", "hour"].every((key) => query[key] !== undefined);
  const birth: BirthInput = {
    year: Number(query.year), month: Number(query.month),
    day: Number(query.day), hour: Number(query.hour),
    minute: Number(query.minute ?? 0), name: String(query.name ?? "我"),
    gender: query.gender === "male" || query.gender === "other" ? query.gender : "female",
  };
  const partnerBirth: BirthInput | undefined = query.partnerYear ? {
    year: Number(query.partnerYear), month: Number(query.partnerMonth),
    day: Number(query.partnerDay), hour: Number(query.partnerHour),
    minute: Number(query.partnerMinute ?? 0), name: String(query.partnerName ?? "TA"),
    gender: query.partnerGender === "female" || query.partnerGender === "other" ? query.partnerGender : "male",
  } : undefined;
  const view = query.view === "deep" || query.view === "match" || query.view === "square" ? query.view : "overview";

  return (
    <>
      {(!hasBirth || view === "overview") && <Landing embeddedResult={hasBirth} />}
      {hasBirth && <ResultContent birth={birth} embedded={view === "overview"} view={view} partnerBirth={partnerBirth} relationType={String(query.relationType ?? "恋爱")} detail={String(query.detail ?? "")} assistantQuestion={String(query.ask ?? "")} />}
    </>
  );
}
