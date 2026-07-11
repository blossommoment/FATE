"use client";

import { useEffect, useState } from "react";

export default function CheckoutSuccess({ sessionId, state, returnTo }: { sessionId: string; state: string; returnTo: string }) {
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const claim = async () => {
      try {
        const response = await fetch("/api/checkout/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, state }),
        });
        const data = await response.json() as { error?: string };
        if (!response.ok) throw new Error(data.error || "支付确认尚未完成。");
        window.location.replace(returnTo);
      } catch (error) {
        if (alive) setError(error instanceof Error ? error.message : "支付确认失败。");
      }
    };
    void claim();
    return () => { alive = false; };
  }, [returnTo, sessionId, state]);

  return <main className="report-page">
    <section className="fate-book fate-book-intro">
      <span className="fb-mono">FATE° · PAYMENT</span>
      <h3>{error ? "支付已完成，但权益确认需要再试一次" : "正在确认支付并打开你的报告…"}</h3>
      <p>{error || "请不要关闭此页面。确认后会自动回到报告。"}</p>
      {error && <button className="fb-cta" type="button" onClick={() => window.location.reload()}>重新确认支付</button>}
    </section>
  </main>;
}
