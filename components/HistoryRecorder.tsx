"use client";

import { useEffect } from "react";

export type HistoryEntry = {
  name: string;
  birthLabel: string;
  partnerName?: string;
  url: string;
  ts?: number;
};

export const HISTORY_KEY = "fate_history";

// 挂载即记录：把当前排盘/合盘写入本机 localStorage，最多保留 12 条。
export default function HistoryRecorder({ entry }: { entry: HistoryEntry }) {
  useEffect(() => {
    try {
      // 按"人"去重（姓名+生辰+对方），同一个人换视图浏览不产生重复条目
      const identity = (item: HistoryEntry) => `${item.name}|${item.birthLabel}|${item.partnerName ?? ""}`;
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryEntry[];
      const rest = raw.filter((item) => identity(item) !== identity(entry));
      rest.unshift({ ...entry, ts: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(rest.slice(0, 12)));
    } catch {
      // localStorage 不可用（隐私模式等）时静默跳过
    }
  }, [entry.url, entry.name, entry.birthLabel, entry.partnerName]);
  return null;
}
