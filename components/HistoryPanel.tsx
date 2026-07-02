"use client";

import { useEffect, useState } from "react";
import { HISTORY_KEY, type HistoryEntry } from "@/components/HistoryRecorder";

// 首页"最近的记录"：只读本机 localStorage，没有记录时不渲染任何内容。
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
    <section className="history-panel">
      <header>
        <div>
          <div className="section-number">最近的记录 / 仅保存在这台设备上</div>
          <h2>上次算到哪了。</h2>
        </div>
        <button type="button" onClick={clear}>清空记录</button>
      </header>
      <div className="history-list">
        {items.map((item) => (
          <a key={item.url} href={item.url}>
            <strong>{item.partnerName ? `${item.name} × ${item.partnerName}` : item.name}</strong>
            <small>{item.partnerName ? "双人合盘" : "个人画像"} · {item.birthLabel}</small>
            <span>→</span>
          </a>
        ))}
      </div>
    </section>
  );
}
