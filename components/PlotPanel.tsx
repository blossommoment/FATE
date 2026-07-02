"use client";

import { useEffect, useState } from "react";
import type { BirthInput } from "@/lib/types";

// 排盘小面板：结果页内展开/收起，不跳离当前页面；提交后直达日主首页（overview）。
// 表单一比一复用落地页排盘的视觉（深底、下划线输入、白色提交键）。

export function PlotTrigger({ variant = "dock" }: { variant?: "dock" | "link" }) {
  const toggle = () => window.dispatchEvent(new Event("fate:plot-toggle"));
  if (variant === "link") {
    return <button type="button" className="plot-link" onClick={toggle}>重新排盘</button>;
  }
  return (
    <button type="button" className="nav-plot" onClick={toggle} aria-label="排盘">
      <i>缘</i><span>排盘</span>
    </button>
  );
}

export default function PlotPanel({ defaults }: { defaults: BirthInput }) {
  const [open, setOpen] = useState(false);
  const [calendarType, setCalendarType] = useState<"solar" | "lunar">(defaults.calendarType === "lunar" ? "lunar" : "solar");

  useEffect(() => {
    const handler = () => setOpen((value) => !value);
    window.addEventListener("fate:plot-toggle", handler);
    return () => window.removeEventListener("fate:plot-toggle", handler);
  }, []);

  if (!open) return null;

  return (
    <div className="plot-panel" role="dialog" aria-label="重新排盘">
      <header>
        <div><span>PLOT / 排盘</span><h3>从一个新的时间点开始。</h3></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="收起排盘面板">×</button>
      </header>
      {/* 数字输入均为非受控：清空后保持空白，不会自动补 0；required 挡住空提交 */}
      <form action="/" method="get">
        <input type="hidden" name="view" value="overview" />
        <fieldset className="calendar-switch">
          <legend>日期类型</legend>
          <label className={calendarType === "solar" ? "active" : ""}><input type="radio" name="calendarType" value="solar" checked={calendarType === "solar"} onChange={() => setCalendarType("solar")} /><span>公历</span><small>阳历生日</small></label>
          <label className={calendarType === "lunar" ? "active" : ""}><input type="radio" name="calendarType" value="lunar" checked={calendarType === "lunar"} onChange={() => setCalendarType("lunar")} /><span>农历</span><small>阴历生日</small></label>
        </fieldset>
        <label><span>怎么称呼你</span><input name="name" aria-label="怎么称呼你" type="text" defaultValue={defaults.name ?? "我"} required /></label>
        <label><span>出生年份</span><input name="year" aria-label="出生年份" type="number" min={1900} max={2100} defaultValue={defaults.year} required /></label>
        <label><span>出生月份</span><input name="month" aria-label="出生月份" type="number" min={1} max={12} defaultValue={defaults.month} required /></label>
        <label><span>出生日期</span><input name="day" aria-label="出生日期" type="number" min={1} max={31} defaultValue={defaults.day} required /></label>
        <label><span>出生时辰（24小时）</span><input name="hour" aria-label="出生时辰" type="number" min={0} max={23} defaultValue={defaults.hour} required /></label>
        <label><span>出生分钟</span><input name="minute" aria-label="出生分钟" type="number" min={0} max={59} defaultValue={defaults.minute ?? 0} required /></label>
        {calendarType === "lunar" && <label className="leap-field"><span>农历月份</span><span className="check-row"><input type="checkbox" name="isLeapMonth" value="true" defaultChecked={defaults.isLeapMonth ?? false} />这是闰月</span></label>}
        <label className="gender-field"><span>性别</span><select name="gender" aria-label="性别" defaultValue={defaults.gender ?? "female"}><option value="female">女</option><option value="male">男</option></select></label>
        <button type="submit">重新排盘<span>↗</span></button>
      </form>
    </div>
  );
}
