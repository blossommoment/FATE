import type { RelationshipAnalysis, UserProfile } from "@/lib/types";

// 双盘连线图：两排四柱上下排开，合冲相制画成连线——结构关系一眼可见。
const pillarIndex: Record<string, number> = { 年柱: 0, 月柱: 1, 日柱: 2, 时柱: 3 };
const typeColor: Record<string, string> = { 冲: "#b25b4e", 六合: "#4f7d68", 三合: "#5a6f9e", 三会: "#5a6f9e", 天干克: "#c99a3f" };

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
      key: `${dynamicIndex}-${userPillar}-${partnerPillar}`,
    }))));
  const usedTypes = [...new Set(links.map((link) => link.type))];
  return (
    <div className="pillar-links">
      <svg viewBox="0 0 640 330" role="img" aria-label={`${userName}与${partnerName}的四柱结构连线图`}>
        <text x="40" y="60" className="pl-name">{userName.slice(0, 3)}</text>
        <text x="40" y="292" className="pl-name">{partnerName.slice(0, 3)}</text>
        {user.bazi.pillars.map((pillar, index) => (
          <g key={`user-${pillar.label}`}>
            <rect x={x(index) - 36} y="24" width="72" height="58" rx="13" className="pl-box pl-mine" />
            <text x={x(index)} y="61" className="pl-glyph">{pillar.gan}{pillar.zhi}</text>
            <text x={x(index)} y="98" className="pl-label">{pillar.label}</text>
          </g>
        ))}
        {partner.bazi.pillars.map((pillar, index) => (
          <g key={`partner-${pillar.label}`}>
            <rect x={x(index) - 36} y="248" width="72" height="58" rx="13" className="pl-box pl-theirs" />
            <text x={x(index)} y="285" className="pl-glyph">{pillar.gan}{pillar.zhi}</text>
            <text x={x(index)} y="238" className="pl-label">{pillar.label}</text>
          </g>
        ))}
        {links.map((link, index) => {
          const bend = (index - (links.length - 1) / 2) * 16;
          const fromX = x(link.from);
          const toX = x(link.to);
          const midX = (fromX + toX) / 2 + bend;
          const midY = 168 + Math.round(bend * .45);
          const color = typeColor[link.type] ?? "#8a9690";
          return (
            <g key={link.key}>
              <path
                d={`M ${fromX} 106 C ${fromX + bend * .4} ${midY - 10}, ${midX} ${midY + 8}, ${toX} 226`}
                className={`pl-line${link.type === "天干克" ? " pl-dashed" : ""}`}
                style={{ stroke: color }}
              />
              <circle cx={midX} cy={midY} r="12" style={{ fill: color }} className="pl-badge" />
              <text x={midX} y={midY + 4.5} className="pl-badge-text">{link.type === "天干克" ? "制" : link.type[0]}</text>
            </g>
          );
        })}
        {!links.length && <text x="320" y="172" className="pl-empty">两盘之间无强合冲结构 · 互动由行为层主导</text>}
      </svg>
      <div className="pl-legend">
        {usedTypes.map((type) => <span key={type}><i style={{ background: typeColor[type] ?? "#8a9690" }} />{type === "天干克" ? "天干相制" : type}</span>)}
        <small>连线越多，结构性的牵引与张力越密</small>
      </div>
    </div>
  );
}
