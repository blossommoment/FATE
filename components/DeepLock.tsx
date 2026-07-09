"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { BirthInput } from "@/lib/types";

// 深度章节付费锁（2026-07-09 用户拍板：深度目录壹贰免费，叁肆伍陆上锁）。
// 内容为规则引擎数据、随页面服务端渲染，锁的是阅读形式（模糊+遮罩）；
// 解锁状态必须经 /api/unlock/verify 服务端验签——localStorage 伪造 token 解不开。
export default function DeepLock({ birth, profileId, reportHref, open = false, children }: {
  birth: BirthInput; profileId: string; reportHref: string; open?: boolean; children: ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (open) return;
    let alive = true;
    let token: string | null = null;
    try { token = localStorage.getItem(`fate-unlock-${profileId}`); } catch { /* 拿不到就保持锁定 */ }
    if (!token) return;
    fetch("/api/unlock/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birth, token }),
    }).then((res) => res.json())
      .then((data: { unlocked?: boolean }) => { if (alive && data.unlocked) setUnlocked(true); })
      .catch(() => { /* 校验失败保持锁定 */ });
    return () => { alive = false; };
    // birth 与 profileId 一一对应，依赖 profileId 即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, open]);

  if (open || unlocked) return <>{children}</>;
  return <div className="fb-locked deep-locked">
    <div className="fb-blur">{children}</div>
    <div className="fb-unlock">
      <div className="fb-unlock-card">
        <b>本章为解锁内容</b>
        <span>解锁全册解读：深度六章逐维推导 + AI 成册五章 + 30 页命书 PDF</span>
        <Link className="fb-cta" href={reportHref}>去解锁 ↗</Link>
      </div>
    </div>
  </div>;
}
