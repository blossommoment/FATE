"use client";

import { useState } from "react";

export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* 用户取消分享或剪贴板不可用 */ }
  };
  return <button className="share-btn" onClick={share}>{copied ? "链接已复制 ✓" : "分享 ↗"}</button>;
}
