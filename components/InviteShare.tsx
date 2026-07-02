"use client";

import { useState } from "react";

// 邀请合盘：把当前用户的生辰编码进链接，TA 打开后只需填自己的生日。
export default function InviteShare({ query }: { query: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${window.location.origin}/?${query}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("复制下面的邀请链接发给 TA：", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2600);
  };

  return (
    <div className="invite-share">
      <div>
        <span>SYNASTRY INVITE</span>
        <h3>不知道 TA 的出生时间？发个邀请</h3>
        <p>TA 打开链接、填好自己的生日，你们看到的是同一份合盘结果。无需注册，链接即档案。</p>
      </div>
      <button type="button" onClick={copy} className={copied ? "copied" : ""}>
        {copied ? "已复制 · 发给 TA 吧 ✓" : "复制邀请链接 ↗"}
      </button>
    </div>
  );
}
