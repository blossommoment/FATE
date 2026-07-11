"use client";

import { useState } from "react";
import type { DuoDigestPayload } from "@/lib/duo";

export default function DuoPdfButton({ state, digest }: { state: string; digest: DuoDigestPayload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/report/duo/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, digest }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "生成 PDF 失败，请稍后重试。");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${response.headers.get("X-Report-Id") ?? "FATE-双人报告"}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "生成 PDF 失败，请稍后重试。");
    }
    setBusy(false);
  };

  return <div className="fb-cta-row">
    <button className="fb-cta fb-cta-ghost" type="button" onClick={download} disabled={busy}>{busy ? "正在生成 PDF…" : "导出双人报告 PDF"}</button>
    {error && <span className="fb-unlock-err">{error}</span>}
  </div>;
}
