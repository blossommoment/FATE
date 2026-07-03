// AI 读你 · 数据层（A1）—— 设计依据见 docs/REQ_AI_DIGEST.md
// 职责：把计算器结论翻译成人话标签与推荐候选池（全部确定性，进黄金测试），
// 并打包成 buildPersonalFacts —— AI 叙述层的唯一输入。
// 铁律：标签与候选池由规则表定，AI 只做挑选与措辞；正文零命理黑话，术语只进括号依据。

import type { Elements, UserProfile } from "./types";

export type PersonaTags = { love: string[]; career: string[]; energy: string[] };
export type Recommendation = { name: string; why: string };
export type Recommendations = {
  vocations: Recommendation[];   // 职业（工作方式）——十神×四维映射，优先展示
  industries: Recommendation[];  // 行业（环境场）——喜忌五行多归属制，辅助
  environments: string[];        // 环境倾向——只说特征不点名城市（已拍板）
  currentPhase: string;          // 当下大运的补耗策略
};

const ELEMENT_CN: Record<keyof Elements, string> = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };

const deep = (p: UserProfile, key: string) => p.deepAnalysis.find((i) => i.key === key)?.score ?? 50;
const trait = (p: UserProfile, key: string) => p.traitAnalysis.find((i) => i.key === key)?.score ?? 50;

type GodGroup = "authority" | "resource" | "wealth" | "peer" | "output";
const godGroup = (god: string): GodGroup =>
  ["正官", "七杀"].includes(god) ? "authority"
    : ["正印", "偏印"].includes(god) ? "resource"
      : ["正财", "偏财"].includes(god) ? "wealth"
        : ["食神", "伤官"].includes(god) ? "output" : "peer";

const isWeak = (p: UserProfile) => p.energy.dayMaster.level === "身弱" || p.energy.dayMaster.level === "从弱";

// ── 人话标签（规则表映射，确定性）────────────────────────────────

export function buildPersonaTags(p: UserProfile): PersonaTags {
  const P = p.personality;
  const social = p.socialProfile;

  // 感情域：按超出阈值的幅度排序取前 3，不足 2 个时以依恋类型、关系节奏兜底
  const loveRules: { tag: string; hit: boolean; margin: number }[] = [
    { tag: "引导型恋人", hit: trait(p, "initiative") >= 60 && P.control >= 60, margin: trait(p, "initiative") + P.control - 120 },
    { tag: "需要被接住的人", hit: deep(p, "dependency") >= 58 && P.emotion >= 65, margin: deep(p, "dependency") + P.emotion - 123 },
    { tag: "慢热观察员", hit: deep(p, "trust_speed") <= 45 && deep(p, "vigilance") >= 55, margin: 45 - deep(p, "trust_speed") + deep(p, "vigilance") - 55 },
    { tag: "独立空间型", hit: deep(p, "autonomy") >= 62 && deep(p, "dependency") <= 45, margin: deep(p, "autonomy") - 62 + 45 - deep(p, "dependency") },
    { tag: "黏人补给型", hit: deep(p, "dependency") >= 58 && social.communication_need === "high", margin: deep(p, "dependency") - 58 },
    { tag: "直球选手", hit: deep(p, "conflict_expression") >= 60 && trait(p, "expressiveness") >= 60, margin: deep(p, "conflict_expression") + trait(p, "expressiveness") - 120 },
    { tag: "情绪翻译官", hit: trait(p, "empathy") >= 65 && trait(p, "expressiveness") >= 55, margin: trait(p, "empathy") - 65 + trait(p, "expressiveness") - 55 },
    { tag: "浪漫主义者", hit: deep(p, "romance") >= 60 && P.emotion >= 55, margin: deep(p, "romance") - 60 + P.emotion - 55 },
    { tag: "新鲜感猎人", hit: deep(p, "novelty") >= 65, margin: deep(p, "novelty") - 65 },
    { tag: "老派长情型", hit: deep(p, "novelty") <= 42 && P.stability >= 60, margin: 42 - deep(p, "novelty") + P.stability - 60 },
    { tag: "醋意敏感体质", hit: deep(p, "vigilance") >= 62 && P.emotion >= 60, margin: deep(p, "vigilance") - 62 + P.emotion - 60 },
    { tag: "大心脏恋人", hit: deep(p, "vigilance") <= 42 && P.stability >= 60, margin: 42 - deep(p, "vigilance") + P.stability - 60 },
    { tag: "被追才有感觉", hit: trait(p, "initiative") <= 42 && deep(p, "romance") >= 50, margin: 42 - trait(p, "initiative") + deep(p, "romance") - 50 },
    { tag: "嘴硬心软型", hit: deep(p, "conflict_expression") >= 58 && trait(p, "empathy") >= 58, margin: deep(p, "conflict_expression") - 58 + trait(p, "empathy") - 58 },
    { tag: "安静陪伴型", hit: trait(p, "expressiveness") <= 45 && P.stability >= 55, margin: 45 - trait(p, "expressiveness") + P.stability - 55 },
    { tag: "仪式感大户", hit: deep(p, "romance") >= 62 && deep(p, "novelty") >= 50, margin: deep(p, "romance") - 62 + deep(p, "novelty") - 50 },
    { tag: "冷静调解人", hit: P.stability >= 68 && deep(p, "conflict_expression") <= 45, margin: P.stability - 68 + 45 - deep(p, "conflict_expression") },
    { tag: "恋爱规划师", hit: P.control >= 60 && P.stability >= 60 && deep(p, "romance") <= 50, margin: P.control + P.stability - 120 },
    { tag: "心动就行动", hit: deep(p, "trust_speed") >= 62 && deep(p, "social_openness") >= 52, margin: deep(p, "trust_speed") - 62 + deep(p, "social_openness") - 52 },
    { tag: "行动派爱人", hit: trait(p, "expressiveness") <= 48 && trait(p, "initiative") >= 52, margin: 48 - trait(p, "expressiveness") + trait(p, "initiative") - 52 },
  ];
  const love = loveRules.filter((r) => r.hit).sort((a, b) => b.margin - a.margin).slice(0, 3).map((r) => r.tag);
  if (love.length < 2) {
    const fallback = { secure: "稳定供电型", anxious: "需要确认的人", avoidant: "靠近需要耐心" }[social.attachment_style];
    if (!love.includes(fallback)) love.push(fallback);
  }
  if (love.length < 2) {
    const paceTag = { slow: "慢热观察员", medium: "顺其自然派", fast: "心动就行动" }[social.relationship_speed];
    if (!love.includes(paceTag)) love.push(paceTag);
  }

  // 事业域：主轴十神组定基调（主轴规则 +8 权重保证优先），四维与深维扩展泛化标签
  const group = godGroup(p.dominantPersona.god);
  const god = p.dominantPersona.god;
  const AXIS = 8; // 主轴标签的排序加成
  const careerRules: { tag: string; hit: boolean; margin: number }[] = [
    // —— 主轴基调 ——
    { tag: "深耕专家型", hit: group === "resource" || (isWeak(p) && p.tenGodAnalysis[1].score >= Math.max(p.tenGodAnalysis[0].score, p.tenGodAnalysis[2].score)), margin: AXIS + p.tenGodAnalysis[1].score / 5 },
    { tag: "军师参谋型", hit: group === "resource" && trait(p, "expressiveness") <= 55, margin: AXIS + 55 - trait(p, "expressiveness") },
    { tag: "创意输出型", hit: group === "output" && !isWeak(p), margin: AXIS + p.tenGodAnalysis[4].score / 5 },
    { tag: "细水长流的创作者", hit: group === "output" && isWeak(p), margin: AXIS + p.tenGodAnalysis[4].score / 5 },
    { tag: "抗压执行型", hit: group === "authority" && deep(p, "resilience") >= 70, margin: AXIS + deep(p, "resilience") - 70 },
    { tag: "规则里的稳手", hit: group === "authority" && deep(p, "resilience") < 70 && P.stability >= 55, margin: AXIS + P.stability - 55 },
    { tag: "资源整合型", hit: group === "wealth" && P.extroversion >= 55, margin: AXIS + P.extroversion - 55 },
    { tag: "务实操盘手", hit: group === "wealth" && P.extroversion < 55, margin: AXIS + 55 - P.extroversion },
    { tag: "并肩作战型", hit: group === "peer", margin: AXIS + p.tenGodAnalysis[3].score / 5 }, // 比劫靠同伴成事、不服层级——不是单打独斗（2026-07-03 拍板修正）
    { tag: "破局开创型", hit: god === "伤官" && !isWeak(p), margin: AXIS + deep(p, "conflict_expression") - 50 },
    { tag: "机会嗅觉型", hit: god === "偏财" && deep(p, "novelty") >= 55, margin: AXIS + deep(p, "novelty") - 55 },
    { tag: "靠谱交付型", hit: (god === "正财" || god === "正官") && P.stability >= 60, margin: AXIS + P.stability - 60 },
    { tag: "稳步爬梯型", hit: group === "authority" && P.stability >= 65, margin: AXIS / 2 + P.stability - 65 },
    // —— 泛化风格（不依赖主轴，任何盘都可能命中）——
    { tag: "自由个体型", hit: deep(p, "autonomy") >= 62 && social.communication_need === "low" && (group === "output" || god === "偏印"), margin: deep(p, "autonomy") - 62 },
    { tag: "台前发光体", hit: P.extroversion >= 65 && trait(p, "expressiveness") >= 60, margin: P.extroversion - 65 + trait(p, "expressiveness") - 60 },
    { tag: "幕后操盘手", hit: P.extroversion <= 45 && P.control >= 60, margin: 45 - P.extroversion + P.control - 60 },
    { tag: "救火队长", hit: deep(p, "resilience") >= 75 && trait(p, "adaptability") >= 55, margin: deep(p, "resilience") - 75 + trait(p, "adaptability") - 55 },
    { tag: "多线程选手", hit: trait(p, "adaptability") >= 65 && deep(p, "novelty") >= 55, margin: trait(p, "adaptability") - 65 + deep(p, "novelty") - 55 },
    { tag: "单线程深潜员", hit: deep(p, "autonomy") >= 60 && deep(p, "novelty") <= 45, margin: deep(p, "autonomy") - 60 + 45 - deep(p, "novelty") },
    { tag: "长期主义者", hit: deep(p, "novelty") <= 42 && P.stability >= 62, margin: 42 - deep(p, "novelty") + P.stability - 62 },
  ];
  const career = careerRules.filter((r) => r.hit).sort((a, b) => b.margin - a.margin).slice(0, 3).map((r) => r.tag);
  if (career.length < 2) {
    const groupDefault: Record<GodGroup, string> = {
      output: "创意输出型", resource: "深耕专家型", wealth: "务实操盘手", authority: "规则里的稳手", peer: "并肩作战型",
    };
    if (!career.includes(groupDefault[group])) career.push(groupDefault[group]);
  }

  // 能量域
  const energyTags: string[] = [];
  if (social.communication_need === "low" || (deep(p, "autonomy") >= 60 && P.extroversion < 50)) energyTags.push("独处回血");
  if (P.extroversion >= 65) energyTags.push("人群充电");
  if (deep(p, "resilience") >= 70) energyTags.push("压力转化者");
  if (deep(p, "vigilance") >= 60 || P.stability < 45) energyTags.push("节奏敏感体质");
  if (P.stability >= 70 && !energyTags.includes("独处回血")) energyTags.push("稳定供电型");
  if (energyTags.length < 2) energyTags.push(isWeak(p) ? "省电模式选手" : "长续航体质");

  return { love, career: career.slice(0, 3), energy: energyTags.slice(0, 3) };
}

// ── 推荐候选池（确定性，AI 只做挑选与措辞）──────────────────────

const VOCATION_POOLS: Record<GodGroup, { outgoing: string[]; reserved: string[] }> = {
  output: {
    outgoing: ["讲师 / 主播", "产品创意", "文案内容", "设计"],
    reserved: ["文案内容", "设计", "自由创作", "产品创意"],
  },
  resource: {
    outgoing: ["咨询", "教学", "技术研发", "研究分析"],
    reserved: ["技术研发", "研究分析", "编辑", "咨询"],
  },
  wealth: {
    outgoing: ["销售", "商务BD", "市场增长", "买手 / 供应链"],
    reserved: ["市场增长", "买手 / 供应链", "电商运营", "商务BD"],
  },
  authority: {
    outgoing: ["运营", "项目管理", "公共事务", "法务合规"],
    reserved: ["法务合规", "项目管理", "运营", "质量管理"],
  },
  peer: {
    outgoing: ["社群运营", "合伙创业", "团队型执行", "体育竞技相关"],
    reserved: ["工作室合伙", "团队型执行", "合伙创业", "独立手艺"],
  },
};

const GROUP_LABEL: Record<GodGroup, string> = {
  output: "表达与创造", resource: "吸收与理解", wealth: "现实与资源", authority: "秩序与执行", peer: "同伴与自主",
};

// 行业多归属制：括号注明取性（行业五行各派不一，此表为本产品口径）
const INDUSTRY_POOLS: Record<keyof Elements, Recommendation[]> = {
  water: [
    { name: "互联网内容与平台", why: "信息流通属水" },
    { name: "心理咨询", why: "情绪与流动属水" },
    { name: "物流贸易", why: "流转属水" },
    { name: "数据研究", why: "智识属水" },
  ],
  wood: [
    { name: "教育培训", why: "生发育人属木" },
    { name: "医疗健康", why: "生机属木" },
    { name: "出版内容", why: "文教属木" },
    { name: "设计创意", why: "生长与美感属木" },
  ],
  fire: [
    { name: "电子科技 / 硬件", why: "电与显示属火" },
    { name: "传媒影视", why: "光与声量属火" },
    { name: "市场营销", why: "热度属火" },
    { name: "餐饮消费", why: "烟火气属火" },
  ],
  earth: [
    { name: "地产建筑", why: "土木安居属土" },
    { name: "供应链仓储", why: "承载属土" },
    { name: "行政运营", why: "安稳属土" },
    { name: "资产管理", why: "积蓄属土" },
  ],
  metal: [
    { name: "金融", why: "金主财器" },
    { name: "法务", why: "规则肃杀属金" },
    { name: "精密制造", why: "器械属金" },
    { name: "审计质检", why: "明辨属金" },
  ],
};

// 中和盘行业改由主轴十神定池（喜忌为空，行业不挑人）
const NEUTRAL_INDUSTRY: Record<GodGroup, Recommendation[]> = {
  output: [{ name: "内容与设计行业", why: "顺表达主轴" }, { name: "教育培训", why: "输出即讲授" }],
  resource: [{ name: "研究与咨询行业", why: "顺吸收主轴" }, { name: "教育出版", why: "理解变产品" }],
  wealth: [{ name: "商贸与消费行业", why: "顺资源主轴" }, { name: "市场增长类", why: "对机会敏感" }],
  authority: [{ name: "运营与公共事务", why: "顺秩序主轴" }, { name: "法务合规", why: "规则内成事" }],
  peer: [{ name: "团队协作密集的行业", why: "顺同伴主轴" }, { name: "体育社群类", why: "并肩感是燃料" }],
};

const ENVIRONMENT_POOLS: Record<keyof Elements, string> = {
  water: "临水、节奏舒缓的城市更养你——水边散步是最便宜的回血方式",
  wood: "绿化多、文教气息浓的环境更养你——公园和书店密度是选房参考",
  fire: "日照充足、有烟火气的城市更养你——阴冷萧条的环境是慢性消耗",
  earth: "安定、生活半径小的环境更养你——频繁搬家换城市对你成本偏高",
  metal: "秩序感强、干净利落的环境更养你——混乱嘈杂的环境格外耗你",
};

export function buildRecommendations(p: UserProfile): Recommendations {
  const primary = godGroup(p.dominantPersona.god);
  const secondary = godGroup(p.secondaryPersona.god);
  const outgoing = p.personality.extroversion >= 58;

  const primaryPool = VOCATION_POOLS[primary][outgoing ? "outgoing" : "reserved"];
  const secondaryPool = VOCATION_POOLS[secondary][outgoing ? "outgoing" : "reserved"];
  const seen = new Set<string>();
  const vocations: Recommendation[] = [];
  for (const name of [...primaryPool.slice(0, 3), ...secondaryPool]) {
    if (seen.has(name)) continue;
    seen.add(name);
    const fromPrimary = primaryPool.slice(0, 3).includes(name);
    vocations.push({
      name,
      why: fromPrimary
        ? `你的主轴是${GROUP_LABEL[primary]}（${p.dominantPersona.god}主导），这类工作顺着主轴走不费力`
        : `副轴${GROUP_LABEL[secondary]}（${p.secondaryPersona.god}）的加成方向`,
    });
    if (vocations.length >= 4) break;
  }

  const dm = p.energy.dayMaster;
  const industries: Recommendation[] = dm.favorable.length === 0
    ? NEUTRAL_INDUSTRY[primary]
    : dm.favorable.flatMap((el) => INDUSTRY_POOLS[el].slice(0, 2).map((item) => ({
      name: item.name,
      why: `${ELEMENT_CN[el]}是你的喜用（${item.why}）`,
    }))).slice(0, 4);

  const environments = dm.favorable.length === 0
    ? ["环境不挑你，节奏挑你——偏强的时段住哪都行，偏弱的时段选让你省电的地方"]
    : dm.favorable.slice(0, 2).map((el) => ENVIRONMENT_POOLS[el]);

  const current = p.luckCycles.periods.find((x) => x.isCurrent);
  const verdictTail = current?.verdict
    ? (current.verdict.text.split("——")[1] ?? current.verdict.text).replace(/^[^：]*：/, "")
    : "";
  const currentPhase = current?.verdict
    ? `${current.startAge}—${current.endAge} 岁这步（${current.ganZhi}）是${current.verdict.label}段：${verdictTail}`
    : "尚未起运或大运数据缺失，当下策略以流年为准。";

  return { vocations, industries, environments, currentPhase };
}

// ── 个人事实清单：AI 叙述层的唯一输入 ────────────────────────────

export function buildPersonalFacts(p: UserProfile) {
  const dm = p.energy.dayMaster;
  const attachmentCN = { secure: "偏安全型", anxious: "偏焦虑型", avoidant: "偏回避型" } as const;
  return {
    name: p.birth.name ?? "这位用户",
    gender: p.birth.gender ?? null,
    strength: { level: dm.level, score: dm.score, confidence: dm.confidence },
    favorable: dm.favorable.map((e) => ELEMENT_CN[e]),
    unfavorable: dm.unfavorable.map((e) => ELEMENT_CN[e]),
    spine: p.spine,
    personality: p.personality,
    keyScores: {
      initiative: trait(p, "initiative"),
      expressiveness: trait(p, "expressiveness"),
      empathy: trait(p, "empathy"),
      trustSpeed: deep(p, "trust_speed"),
      vigilance: deep(p, "vigilance"),
      dependency: deep(p, "dependency"),
      autonomy: deep(p, "autonomy"),
      resilience: deep(p, "resilience"),
      conflictExpression: deep(p, "conflict_expression"),
      novelty: deep(p, "novelty"),
    },
    attachment: attachmentCN[p.socialProfile.attachment_style],
    communicationNeed: p.socialProfile.communication_need,
    relationshipSpeed: p.socialProfile.relationship_speed,
    tenGodStructure: p.tenGodAnalysis.map(({ label, score }) => ({ label, score })),
    dominantAxis: { god: p.dominantPersona.god, theme: GROUP_LABEL[godGroup(p.dominantPersona.god)] },
    secondaryAxis: { god: p.secondaryPersona.god, theme: GROUP_LABEL[godGroup(p.secondaryPersona.god)] },
    tags: buildPersonaTags(p),
    recommendations: buildRecommendations(p),
    contract: {
      rule: "只许转述与组织清单中的事实，不得新增任何判断或预测；正文禁用命理术语（十神、五行、格局名），术语只允许出现在句末括号依据里；标签与推荐必须从清单给定项中选取，不得自创。",
      output: "四段结构：①一句话人设（15字内）②三域标签逐条一句人话解释 ③生活建议（职业、行业、环境、感情里的你、当下时段各一小段）④80~120字总结，落在「接下来怎么活」。",
    },
  };
}
