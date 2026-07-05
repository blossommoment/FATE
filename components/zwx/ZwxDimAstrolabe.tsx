// 星盘辐辉 · 十二维人格图谱(2026-07-05 用户拍板 Option A,中心对接日主)
// 罗盘刻度环 + 十二道光辐,辐长即分值;确定性 SVG,可作服务端组件。
import type { CSSProperties } from "react";

const CAT_COLOR: Record<string, string> = {
  "成长与行动": "#d9b26c", "亲密与安全": "#d98a97", "边界与冲突": "#a98fd6", "沟通与连接": "#7fa9d9",
};
const EL_ZH: Record<string, string> = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
const EL_COLOR: Record<string, string> = { wood: "#6ec98f", fire: "#e0796a", earth: "#d9b26c", metal: "#d2a64e", water: "#7fa9d9" };

const P = (cx: number, cy: number, r: number, aDeg: number): [number, number] => {
  const a = (aDeg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const anchorOf = (a: number) => {
  const c = Math.cos((a - 90) * Math.PI / 180);
  return Math.abs(c) < 0.32 ? "middle" : c > 0 ? "start" : "end";
};

export default function ZwxDimAstrolabe({ dims, dayStem, dayElement }: {
  dims: { key: string; label: string; score: number; category: string }[];
  dayStem: string;
  dayElement: string;
}) {
  const cx = 410, cy = 310, R0 = 78, SPAN = 128; // 辐条从 R0 长至 R0+score%*SPAN
  const elColor = EL_COLOR[dayElement] ?? "#e8ce9a";
  const ticks: React.ReactNode[] = [];
  for (let k = 0; k < 72; k++) {
    const a = k * 5, long = k % 6 === 0;
    const [x1, y1] = P(cx, cy, 232, a);
    const [x2, y2] = P(cx, cy, long ? 222 : 227, a);
    ticks.push(<line key={k} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)}
      stroke={`rgba(232,206,154,${long ? .5 : .22})`} strokeWidth={long ? 1.4 : 0.8} />);
  }
  return (
    <div className="zxal">
      <svg viewBox="0 0 820 620" role="img" aria-label={`十二维人格星盘,中心为日主${dayStem}`}>
        <circle cx={cx} cy={cy} r={232} fill="none" stroke="rgba(232,206,154,.25)" />
        {ticks}
        {[R0, R0 + 43, R0 + 86, R0 + 128].map((r, i) => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(232,206,154,.12)"
            strokeDasharray={i ? "2 6" : undefined} />
        ))}
        {dims.map((d, i) => {
          const a = i * 30;
          const col = CAT_COLOR[d.category] ?? "#e8ce9a";
          const len = Math.max(6, d.score / 100 * SPAN);
          const [x1, y1] = P(cx, cy, R0, a);
          const [tx, ty] = P(cx, cy, R0 + SPAN, a);
          const [x2, y2] = P(cx, cy, R0 + len, a);
          const [vx, vy] = P(cx, cy, Math.min(R0 + len + 19, 214), a);
          const [lx, ly] = P(cx, cy, 254, a);
          return (
            <g key={d.key}>
              <line x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={tx.toFixed(1)} y2={ty.toFixed(1)}
                stroke="rgba(232,206,154,.08)" strokeWidth={8} strokeLinecap="round" />
              <line x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)}
                stroke={col} strokeWidth={8} strokeLinecap="round" opacity={.92} />
              <circle cx={x2.toFixed(1)} cy={y2.toFixed(1)} r={9} fill={col} opacity={.22} />
              <circle cx={x2.toFixed(1)} cy={y2.toFixed(1)} r={3.2} fill="#f6efdd" />
              <text x={vx.toFixed(1)} y={(vy + 4).toFixed(1)} textAnchor={anchorOf(a)}
                className="zxal-val">{d.score}</text>
              <text x={lx.toFixed(1)} y={(ly + 5).toFixed(1)} textAnchor={anchorOf(a)}
                className="zxal-lbl" fill={col}>{d.label}</text>
            </g>
          );
        })}
        {/* 中心:日主 */}
        <circle cx={cx} cy={cy} r={R0 - 24} fill="rgba(10,8,24,.88)" stroke="rgba(232,206,154,.32)" />
        <circle cx={cx} cy={cy} r={R0 - 30} fill="none" stroke="rgba(232,206,154,.14)" strokeDasharray="2 5" />
        <text x={cx} y={cy + 15} textAnchor="middle" className="zxal-stem" fill={elColor}>{dayStem}</text>
        <text x={cx} y={cy + 42} textAnchor="middle" className="zxal-stemsub">日主 · {dayStem}{EL_ZH[dayElement] ?? ""}</text>
      </svg>
    </div>
  );
}
