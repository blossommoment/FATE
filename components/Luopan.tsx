// 罗盘背景：三层反向缓旋的干支环，作低透明度装饰，不承载数据。
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const TRIGRAMS = ["☰", "☱", "☲", "☳", "☴", "☵", "☶", "☷"];

const point = (radius: number, index: number, count: number) => {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
  return {
    x: Math.round((300 + Math.cos(angle) * radius) * 10) / 10,
    y: Math.round((300 + Math.sin(angle) * radius) * 10) / 10,
    deg: Math.round(angle * 180 / Math.PI) + 90,
  };
};

export default function Luopan({ className = "" }: { className?: string }) {
  return (
    <svg className={`luopan-bg ${className}`} viewBox="0 0 600 600" aria-hidden="true" focusable="false">
      <g className="luopan-spin">
        <circle cx="300" cy="300" r="292" />
        <circle cx="300" cy="300" r="288" />
        <circle cx="300" cy="300" r="242" />
        {Array.from({ length: 60 }, (_, index) => {
          const outer = point(288, index, 60);
          const inner = point(index % 5 === 0 ? 276 : 282, index, 60);
          return <line key={index} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />;
        })}
        {BRANCHES.map((branch, index) => {
          const p = point(262, index, 12);
          return <text key={branch} x={p.x} y={p.y} transform={`rotate(${p.deg} ${p.x} ${p.y})`}>{branch}</text>;
        })}
      </g>
      <g className="luopan-spin-reverse">
        <circle cx="300" cy="300" r="222" />
        <circle cx="300" cy="300" r="176" />
        {STEMS.map((stem, index) => {
          const p = point(198, index, 10);
          return <text key={stem} x={p.x} y={p.y} transform={`rotate(${p.deg} ${p.x} ${p.y})`}>{stem}</text>;
        })}
        {TRIGRAMS.map((trigram, index) => {
          const p = point(150, index, 8);
          return <text className="luopan-trigram" key={trigram} x={p.x} y={p.y} transform={`rotate(${p.deg} ${p.x} ${p.y})`}>{trigram}</text>;
        })}
      </g>
      <g className="luopan-spin-slow">
        <circle cx="300" cy="300" r="122" />
        <circle cx="300" cy="300" r="86" />
        {Array.from({ length: 24 }, (_, index) => {
          const outer = point(122, index, 24);
          const inner = point(112, index, 24);
          return <line key={index} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />;
        })}
      </g>
      <circle cx="300" cy="300" r="30" />
      <line x1="300" y1="255" x2="300" y2="345" />
      <line x1="255" y1="300" x2="345" y2="300" />
    </svg>
  );
}
