"use client";

import { useEffect, useState } from "react";
import type { BirthInput } from "@/lib/types";

// 排盘小面板：结果页内展开/收起，不跳离当前页面；提交后直达日主首页（overview）。
// 触发按钮与面板通过自定义事件通信，可放在任意位置（底部导航中央 / 顶部导航）。

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
    <div className="plot-panel" role="dialog" aria-label="排盘">
      <header>
        <div><span>PLOT</span><h3>新的出生信息</h3></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="收起排盘面板">×</button>
      </header>
      {/* 数字输入均为非受控：清空后保持空白，不会自动补 0；required 挡住空提交 */}
      <form action="/" method="get">
        <input type="hidden" name="view" value="overview" />
        <div className="plot-grid">
          <label className="plot-name"><span>称呼</span><input name="name" type="text" defaultValue={defaults.name ?? "我"} required /></label>
          <label><span>年</span><input name="year" type="number" min={1900} max={2100} defaultValue={defaults.year} required /></label>
          <label><span>月</span><input name="month" type="number" min={1} max={12} defaultValue={defaults.month} required /></label>
          <label><span>日</span><input name="day" type="number" min={1} max={31} defaultValue={defaults.day} required /></label>
          <label><span>时</span><input name="hour" type="number" min={0} max={23} defaultValue={defaults.hour} required /></label>
          <label><span>分</span><input name="minute" type="number" min={0} max={59} defaultValue={defaults.minute ?? 0} required /></label>
          <label><span>性别</span><select name="gender" defaultValue={defaults.gender ?? "female"}><option value="female">女</option><option value="male">男</option></select></label>
          <label><span>历法</span><select name="calendarType" value={calendarType} onChange={(event) => setCalendarType(event.target.value as "solar" | "lunar")}><option value="solar">公历</option><option value="lunar">农历</option></select></label>
          {calendarType === "lunar" && <label className="plot-leap"><span>闰月</span><span className="plot-check"><input type="checkbox" name="isLeapMonth" value="true" defaultChecked={defaults.isLeapMonth ?? false} />是闰月</span></label>}
        </div>
        <button type="submit" className="plot-submit">排盘，看日主首页 →</button>
      </form>
    </div>
  );
}
