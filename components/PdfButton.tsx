"use client";

import { useState } from "react";
import type { BirthInput } from "@/lib/types";

// 命书 PDF 下载按钮（解锁权益；2026-07-09 用户拍板挂在「打开我的深度解读」旁）。
// 评述命中服务端缓存时秒级出书，否则约一分钟；未解锁时服务端 402，前端给指引。
export default function PdfButton({ birth, profileId }: { birth: BirthInput; profileId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      let token: string | null = null;
      try { token = localStorage.getItem(`fate-unlock-${profileId}`); } catch { /* 无 token 交给服务端 402 */ }
      const res = await fetch("/api/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birth, lang: "zh", unlockToken: token ?? undefined }),
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
