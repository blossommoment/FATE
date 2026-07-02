"use client";

import { useEffect, useState } from "react";
import { HISTORY_KEY, type HistoryEntry } from "@/components/HistoryRecorder";

// 首页"上次算到哪了"：紧凑单行条，只读本机 localStorage，无记录不渲染。
export default function HistoryPanel() {
  const [items, setItems] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryEntry[]);
    } catch {
      setItems([]);
    }
  }, []);

  if (!items.length) return null;

  const clear = () => {
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* 忽略 */ }
    setItems([]);
  };

  return (
    <section className="history-strip" aria-label="最近的排盘记录">
      <span className="history-strip-label">上次算到哪了</span>
      <div className="history-chips">
        {items.slice(0, 6).map((item) => (
          <a key={item.url} href={item.url}>
            <strong>{item.partnerName ? `${item.name} × ${item.partnerName}` : item.name}</strong>
            <small>{item.partnerName ? "合盘" : "画像"}</small>
          </a>
        ))}
      </div>
      <button type="button" onClick={clear}>清空</button>
    </section>
  );
}
