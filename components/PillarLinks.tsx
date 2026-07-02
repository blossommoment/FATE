import type { RelationshipAnalysis, UserProfile } from "@/lib/types";

// 双盘连线图：两排四柱上下排开，合冲相制画成连线。
// 干支按五行着色，线宽随结构强度，徽章下标注具体地支对。
const pillarIndex: Record<string, number> = { 年柱: 0, 月柱: 1, 日柱: 2, 时柱: 3 };
const typeColor: Record<string, string> = { 冲: "#b25b4e", 六合: "#4f7d68", 三合: "#5a6f9e", 三会: "#5a6f9e", 天干克: "#c99a3f" };
const charElementColor: Record<string, string> = {
  甲: "#4e9a78", 乙: "#4e9a78", 寅: "#4e9a78", 卯: "#4e9a78",
  丙: "#cf6a55", 丁: "#cf6a55", 巳: "#cf6a55", 午: "#cf6a55",
  戊: "#bd8f45", 己: "#bd8f45", 辰: "#bd8f45", 戌: "#bd8f45", 丑: "#bd8f45", 未: "#bd8f45",
  庚: "#8b8f6a", 辛: "#8b8f6a", 申: "#8b8f6a", 酉: "#8b8f6a",
  壬: "#5b83bd", 癸: "#5b83bd", 子: "#5b83bd", 亥: "#5b83bd",
};

export default function PillarLinks({ user, partner, userName, partnerName, dynamics }: {
  user: UserProfile;
  partner: UserProfile;
  userName: string;
  partnerName: string;
  dynamics: RelationshipAnalysis["branchDynamics"];
}) {
  const x = (index: number) => 118 + index * 148;
  const links = dynamics.flatMap((dynamic, dynamicIndex) =>
    dynamic.userPillars.flatMap((userPillar) => dynamic.partnerPillars.map((partnerPillar) => ({
      from: pillarIndex[userPillar] ?? 0,
      to: pillarIndex[partnerPillar] ?? 0,
      type: dynamic.type,
      strength: dynamic.strength,
      pair: dynamic.branches.join(dynamic.type === "天干克" ? "→" : "·"),
      key: `${dynamicIndex}-${userPillar}-${partnerPillar}`,
    }))));
  const usedTypes = [...new Set(links.map((link) => link.type))];
  const glyph = (gan: string, zhi: string, cx: number, cy: number) => (
    <text x={cx} y={cy} className="pl-glyph">
      <tspan fill={charElementColor[gan] ?? "#2f3833"}>{gan}</tspan>
      <tspan dx="3" fill={charElementColor[zhi] ?? "#2f3833"}>{zhi}</tspan>
    </text>
  );
  return (
    <div className="pillar-links">
      <svg viewBox="0 0 640 336" role="img" aria-label={`${userName}与${partnerName}的四柱结构连线图`}>
        <text x="40" y="60" className="pl-name">{userName.slice(0, 3)}</text>
        <text x="40" y="298" className="pl-name">{partnerName.slice(0, 3)}</text>
        {user.bazi.pillars.map((pillar, index) => (
          <g key={`user-${pillar.label}`}>
            <rect x={x(index) - 38} y="22" width="76" height="62" rx="14" className={`pl-box pl-mine${index === 2 ? " pl-day" : ""}`} />
            {glyph(pillar.gan, pillar.zhi, x(index), 62)}
            <text x={x(index)} y="100" className="pl-label">{pillar.label}{index === 2 ? " ·日主" : ""}</text>
          </g>
        ))}
        {partner.bazi.pillars.map((pillar, index) => (
          <g key={`partner-${pillar.label}`}>
            <rect x={x(index) - 38} y="252" width="76" height="62" rx="14" className={`pl-box pl-theirs${index === 2 ? " pl-day" : ""}`} />
            {glyph(pillar.gan, pillar.zhi, x(index), 292)}
            <text x={x(index)} y="242" className="pl-label">{pillar.label}{index === 2 ? " ·日主" : ""}</text>
          </g>
        ))}
        {links.map((link, index) => {
          const bend = (index - (links.length - 1) / 2) * 17;
          const fromX = x(link.from);
          const toX = x(link.to);
          const midX = (fromX + toX) / 2 + bend;
          const midY = 168 + Math.round(bend * .42);
          const color = typeColor[link.type] ?? "#8a9690";
          const width = Math.round((1.4 + link.strength / 42) * 10) / 10;
          return (
            <g key={link.key}>
              <path
                d={`M ${fromX} 108 C ${fromX + bend * .4} ${midY - 12}, ${midX} ${midY + 8}, ${toX} 230`}
                className={`pl-line${link.type === "天干克" ? " pl-dashed" : ""}`}
                style={{ stroke: color, strokeWidth: width }}
              />
              <circle cx={midX} cy={midY} r="12" style={{ fill: color }} className="pl-badge" />
              <text x={midX} y={midY + 4.5} className="pl-badge-text">{link.type === "天干克" ? "制" : link.type[0]}</text>
              <text x={midX} y={midY + 27} className="pl-pair">{link.pair}</text>
            </g>
          );
        })}
        {!links.length && <text x="320" y="172" className="pl-empty">两盘之间无强合冲结构 · 互动由行为层主导</text>}
      </svg>
      <div className="pl-legend">
        {usedTypes.map((type) => <span key={type}><i style={{ background: typeColor[type] ?? "#8a9690" }} />{type === "天干克" ? "天干相制" : type}</span>)}
        <small>线越粗，结构强度越高 · 干支颜色对应五行</small>
      </div>
    </div>
  );
}
