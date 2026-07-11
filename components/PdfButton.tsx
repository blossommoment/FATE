"use client";

import { useState } from "react";

// 命书 PDF 下载按钮：仅传递加密报告状态，出生信息不会进入请求体或下载 URL。
export default function PdfButton({ state }: { state: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, lang: "zh" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(res.status === 402
          ? "命书 PDF 为解锁权益——打开深度解读，解锁全册后即可下载。"
          : data?.error || "生成失败，请稍后重试。");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${res.headers.get("X-Report-Id") ?? "FATE-命书"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请稍后重试。");
    }
    setBusy(false);
  };

  return <>
    <button className="fb-cta fb-cta-ghost" onClick={download} disabled={busy}>
      {busy ? "正在成书…（最多约一分钟）" : "生成 30 页命书 PDF"}
    </button>
    {error && <span className="fb-unlock-err">{error}</span>}
  </>;
}
