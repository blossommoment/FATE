// 十二维人格 · 折线图(2026-07-05 用户拍板:星盘辐辉不好看,改折线)
// 金线走势 + 四域彩点 + 常模线;确定性 SVG,可作服务端组件。
const CAT_COLOR: Record<string, string> = {
  "成长与行动": "#d9b26c", "亲密与安全": "#d98a97", "边界与冲突": "#a98fd6", "沟通与连接": "#7fa9d9",
};

export default function ZwxDimLine({ dims }: {
  dims: { key: string; label: string; score: number; category: string }[];
}) {
  const X0 = 64, STEP = 72, TOP = 44, PLOT = 212; // 纵向绘图区 TOP..TOP+PLOT
  const BASE = TOP + PLOT;
  const x = (i: number) => X0 + i * STEP;
  const y = (score: number) => TOP + (100 - score) / 100 * PLOT;
  const pts = dims.map((d, i) => `${x(i)},${y(d.score).toFixed(1)}`).join(" ");
  const area = `${x(0)},${BASE} ${pts} ${x(dims.length - 1)},${BASE}`;
  const W = X0 + (dims.length - 1) * STEP + 44;
  return (
    <div className="zxln">
      <svg viewBox={`0 0 ${W} 420`} role="img" aria-label="十二维人格分值折线图">
        <defs>
          <linearGradient id="zxlnArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(232,206,154,.22)" />
            <stop offset="1" stopColor="rgba(232,206,154,0)" />
          </linearGradient>
        </defs>
        {/* 横向刻度线 + 左侧分值 */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={X0 - 14} y1={y(v)} x2={W - 24} y2={y(v)}
              stroke={v === 50 ? "rgba(232,206,154,.34)" : "rgba(232,206,154,.10)"}
              strokeDasharray={v === 50 ? "5 5" : undefined} />
            <text x={X0 - 22} y={y(v) + 4} textAnchor="end" className="zxln-scale">{v}</text>
          </g>
        ))}
        <text x={W - 24} y={y(50) - 7} textAnchor="end" className="zxln-norm">常模 50</text>
        {/* 面积 + 折线 */}
        <polygon points={area} fill="url(#zxlnArea)" />
        <polyline points={pts} fill="none" stroke="#bf9a4e" strokeWidth="2.2" strokeLinejoin="round" />
        {/* 逐维:竖导线 / 数据点 / 分值 / 竖排维度名 */}
        {dims.map((d, i) => {
          const col = CAT_COLOR[d.category] ?? "#e8ce9a";
          const px = x(i), py = y(d.score);
          return (
            <g key={d.key}>
              <line x1={px} y1={py + 8} x2={px} y2={BASE} stroke="rgba(232,206,154,.10)" />
              <circle cx={px} cy={py} r="7.5" fill={col} opacity=".2" />
              <circle cx={px} cy={py} r="4.2" fill={col} stroke="rgba(7,6,19,.9)" strokeWidth="1.4" />
              <text x={px} y={py - 13} textAnchor="middle" className="zxln-val">{d.score}</text>
              <text x={px} y={BASE + 16} textAnchor="start" className="zxln-lbl" fill={col}
                style={{ writingMode: "vertical-rl" }}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
