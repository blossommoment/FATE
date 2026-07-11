import CheckoutSuccess from "@/components/CheckoutSuccess";
import ZwxReportShell from "@/components/zwx/ZwxReportShell";

export default async function CheckoutSuccessPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const sessionId = typeof query.session_id === "string" ? query.session_id : "";
  const state = typeof query.state === "string" ? query.state : "";
  const candidate = typeof query.return_to === "string" ? query.return_to : "/";
  const returnTo = candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
  if (!sessionId || !state) {
    return <ZwxReportShell><main className="report-page"><p className="report-error">缺少支付订单或报告状态，无法自动领取权益。</p></main></ZwxReportShell>;
  }
  return <ZwxReportShell><CheckoutSuccess sessionId={sessionId} state={state} returnTo={returnTo} /></ZwxReportShell>;
}
