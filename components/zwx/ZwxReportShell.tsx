"use client";

// 报告页亮色壳(2026-07-06 拍板:封面星空,内页纸色)。
// 不再套暗色主题——globals 原生亮色版式全数回归,壳只负责
// 顶部血统色带 + 品牌铭牌 + 桌面端轻微放大。
import "./zwxl.css";

export default function ZwxReportShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="zwxl">
      <div className="zwxl-band" aria-hidden="true" />
      <div className="zwxl-body">{children}</div>
      <div className="zwxl-brandmark" aria-hidden="true">
        <b>FATE° 东方人格建模</b>
        <span>ENGINE 2.0</span>
      </div>
    </div>
  );
}
