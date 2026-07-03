// AI 读你 · 数据层（A1）—— 设计依据见 docs/REQ_AI_DIGEST.md
// 职责：把计算器结论翻译成人话标签与推荐候选池（全部确定性，进黄金测试），
// 并打包成 buildPersonalFacts —— AI 叙述层的唯一输入。
// 铁律：标签与候选池由规则表定，AI 只做挑选与措辞；正文零命理黑话，术语只进括号依据。

import type { Elements, UserProfile } from "./types";

// 标签命中时同时交出判定指标（依据可视化：图文并茂的「文」由 AI 写、「图」由这些指标画）
export type TagHit = { tag: string; metrics: { label: string; value: number }[] };
export type PersonaTags = { love: TagHit[]; career: TagHit[]; energy: TagHit[] };
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
  const M = (label: string, value: number) => ({ label, value });

  // 感情域：按超出阈值的幅度排序取前 3，不足 2 个时以依恋类型、关系节奏兜底；
  // 每条规则同时交出判定指标（m），作为标签卡上的可视化依据
  const loveRules: { tag: string; hit: boolean; margin: number; m: { label: string; value: number }[] }[] = [
    { tag: "引导型恋人", hit: trait(p, "initiative") >= 60 && P.control >= 60, margin: trait(p, "initiative") + P.control - 120, m: [M("关系主动性", trait(p, "initiative")), M("边界控制", P.control)] },
    { tag: "需要被接住的人", hit: deep(p, "dependency") >= 58 && P.emotion >= 65, margin: deep(p, "dependency") + P.emotion - 123, m: [M("情感依赖", deep(p, "dependency")), M("情感感知", P.emotion)] },
    { tag: "慢热观察员", hit: deep(p, "trust_speed") <= 45 && deep(p, "vigilance") >= 55, margin: 45 - deep(p, "trust_speed") + deep(p, "vigilance") - 55, m: [M("信任建立速度", deep(p, "trust_speed")), M("关系警觉", deep(p, "vigilance"))] },
    { tag: "独立空间型", hit: deep(p, "autonomy") >= 62 && deep(p, "dependency") <= 45, margin: deep(p, "autonomy") - 62 + 45 - deep(p, "dependency"), m: [M("自主空间", deep(p, "autonomy")), M("情感依赖", deep(p, "dependency"))] },
    { tag: "黏人补给型", hit: deep(p, "dependency") >= 58 && social.communication_need === "high", margin: deep(p, "dependency") - 58, m: [M("情感依赖", deep(p, "dependency"))] },
    { tag: "直球选手", hit: deep(p, "conflict_expression") >= 60 && trait(p, "expressiveness") >= 60, margin: deep(p, "conflict_expression") + trait(p, "expressiveness") - 120, m: [M("冲突表达", deep(p, "conflict_expression")), M("表达意愿", trait(p, "expressiveness"))] },
    { tag: "情绪翻译官", hit: trait(p, "empathy") >= 65 && trait(p, "expressiveness") >= 55, margin: trait(p, "empathy") - 65 + trait(p, "expressiveness") - 55, m: [M("共情能力", trait(p, "empathy")), M("表达意愿", trait(p, "expressiveness"))] },
    { tag: "浪漫主义者", hit: deep(p, "romance") >= 60 && P.emotion >= 55, margin: deep(p, "romance") - 60 + P.emotion - 55, m: [M("浪漫倾向", deep(p, "romance")), M("情感感知", P.emotion)] },
    { tag: "新鲜感猎人", hit: deep(p, "novelty") >= 65, margin: deep(p, "novelty") - 65, m: [M("新鲜感需求", deep(p, "novelty"))] },
    { tag: "老派长情型", hit: deep(p, "novelty") <= 42 && P.stability >= 60, margin: 42 - deep(p, "novelty") + P.stability - 60, m: [M("新鲜感需求", deep(p, "novelty")), M("情绪稳定", P.stability)] },
    { tag: "醋意敏感体质", hit: deep(p, "vigilance") >= 62 && P.emotion >= 60, margin: deep(p, "vigilance") - 62 + P.emotion - 60, m: [M("关系警觉", deep(p, "vigilance")), M("情感感知", P.emotion)] },
    { tag: "大心脏恋人", hit: deep(p, "vigilance") <= 42 && P.stability >= 60, margin: 42 - deep(p, "vigilance") + P.stability - 60, m: [M("关系警觉", deep(p, "vigilance")), M("情绪稳定", P.stability)] },
    { tag: "被追才有感觉", hit: trait(p, "initiative") <= 42 && deep(p, "romance") >= 50, margin: 42 - trait(p, "initiative") + deep(p, "romance") - 50, m: [M("关系主动性", trait(p, "initiative")), M("浪漫倾向", deep(p, "romance"))] },
    { tag: "嘴硬心软型", hit: deep(p, "conflict_expression") >= 58 && trait(p, "empathy") >= 58, margin: deep(p, "conflict_expression") - 58 + trait(p, "empathy") - 58, m: [M("冲突表达", deep(p, "conflict_expression")), M("共情能力", trait(p, "empathy"))] },
    { tag: "安静陪伴型", hit: trait(p, "expressiveness") <= 45 && P.stability >= 55, margin: 45 - trait(p, "expressiveness") + P.stability - 55, m: [M("表达意愿", trait(p, "expressiveness")), M("情绪稳定", P.stability)] },
    { tag: "仪式感大户", hit: deep(p, "romance") >= 62 && deep(p, "novelty") >= 50, margin: deep(p, "romance") - 62 + deep(p, "novelty") - 50, m: [M("浪漫倾向", deep(p, "romance")), M("新鲜感需求", deep(p, "novelty"))] },
    { tag: "冷静调解人", hit: P.stability >= 68 && deep(p, "conflict_expression") <= 45, margin: P.stability - 68 + 45 - deep(p, "conflict_expression"), m: [M("情绪稳定", P.stability), M("冲突表达", deep(p, "conflict_expression"))] },
    { tag: "恋爱规划师", hit: P.control >= 60 && P.stability >= 60 && deep(p, "romance") <= 50, margin: P.control + P.stability - 120, m: [M("边界控制", P.control), M("情绪稳定", P.stability)] },
    { tag: "心动就行动", hit: deep(p, "trust_speed") >= 62 && deep(p, "social_openness") >= 52, margin: deep(p, "trust_speed") - 62 + deep(p, "social_openness") - 52, m: [M("信任建立速度", deep(p, "trust_speed")), M("社交开放度", deep(p, "social_openness"))] },
    { tag: "行动派爱人", hit: trait(p, "expressiveness") <= 48 && trait(p, "initiative") >= 52, margin: 48 - trait(p, "expressiveness") + trait(p, "initiative") - 52, m: [M("表达意愿", trait(p, "expressiveness")), M("关系主动性", trait(p, "initiative"))] },
  ];
  const love: TagHit[] = loveRules.filter((r) => r.hit).sort((a, b) => b.margin - a.margin).slice(0, 3).map((r) => ({ tag: r.tag, metrics: r.m }));
  if (love.length < 2) {
    const fallback = { secure: "稳定供电型", anxious: "需要确认的人", avoidant: "靠近需要耐心" }[social.attachment_style];
    if (!love.some((h) => h.tag === fallback)) love.push({ tag: fallback, metrics: [M("情感依赖", deep(p, "dependency")), M("情绪稳定", P.stability)] });
  }
  if (love.length < 2) {
    const paceTag = { slow: "慢热观察员", medium: "顺其自然派", fast: "心动就行动" }[social.relationship_speed];
    if (!love.some((h) => h.tag === paceTag)) love.push({ tag: paceTag, metrics: [M("信任建立速度", deep(p, "trust_speed"))] });
  }

  // 事业域：主轴十神组定基调（主轴规则 +8 权重保证优先），四维与深维扩展泛化标签
  const group = godGroup(p.dominantPersona.god);
  const god = p.dominantPersona.god;
  const AXIS = 8; // 主轴标签的排序加成
  const axisScore = (idx: number) => p.tenGodAnalysis[idx].score;
  const careerRules: { tag: string; hit: boolean; margin: number; m: { label: string; value: number }[] }[] = [
    // —— 主轴基调 ——
    { tag: "深耕专家型", hit: group === "resource" || (isWeak(p) && axisScore(1) >= Math.max(axisScore(0), axisScore(2))), margin: AXIS + axisScore(1) / 5, m: [M("主轴·吸收理解", axisScore(1))] },
    { tag: "军师参谋型", hit: group === "resource" && trait(p, "expressiveness") <= 55, margin: AXIS + 55 - trait(p, "expressiveness"), m: [M("主轴·吸收理解", axisScore(1)), M("表达意愿", trait(p, "expressiveness"))] },
    { tag: "创意输出型", hit: group === "output" && !isWeak(p), margin: AXIS + axisScore(4) / 5, m: [M("主轴·表达创造", axisScore(4))] },
    { tag: "细水长流的创作者", hit: group === "output" && isWeak(p), margin: AXIS + axisScore(4) / 5, m: [M("主轴·表达创造", axisScore(4))] },
    { tag: "抗压执行型", hit: group === "authority" && deep(p, "resilience") >= 70, margin: AXIS + deep(p, "resilience") - 70, m: [M("主轴·秩序执行", axisScore(0)), M("压力韧性", deep(p, "resilience"))] },
    { tag: "规则里的稳手", hit: group === "authority" && deep(p, "resilience") < 70 && P.stability >= 55, margin: AXIS + P.stability - 55, m: [M("主轴·秩序执行", axisScore(0)), M("情绪稳定", P.stability)] },
    { tag: "资源整合型", hit: group === "wealth" && P.extroversion >= 55, margin: AXIS + P.extroversion - 55, m: [M("主轴·现实资源", axisScore(2)), M("外向表达", P.extroversion)] },
    { tag: "务实操盘手", hit: group === "wealth" && P.extroversion < 55, margin: AXIS + 55 - P.extroversion, m: [M("主轴·现实资源", axisScore(2)), M("外向表达", P.extroversion)] },
    { tag: "并肩作战型", hit: group === "peer", margin: AXIS + axisScore(3) / 5, m: [M("主轴·同伴自主", axisScore(3))] }, // 比劫靠同伴成事、不服层级——不是单打独斗（2026-07-03 拍板修正）
    { tag: "破局开创型", hit: god === "伤官" && !isWeak(p), margin: AXIS + deep(p, "conflict_expression") - 50, m: [M("主轴·表达创造", axisScore(4)), M("冲突表达", deep(p, "conflict_expression"))] },
    { tag: "机会嗅觉型", hit: god === "偏财" && deep(p, "novelty") >= 55, margin: AXIS + deep(p, "novelty") - 55, m: [M("主轴·现实资源", axisScore(2)), M("新鲜感需求", deep(p, "novelty"))] },
    { tag: "靠谱交付型", hit: (god === "正财" || god === "正官") && P.stability >= 60, margin: AXIS + P.stability - 60, m: [M("情绪稳定", P.stability)] },
    { tag: "稳步爬梯型", hit: group === "authority" && P.stability >= 65, margin: AXIS / 2 + P.stability - 65, m: [M("主轴·秩序执行", axisScore(0)), M("情绪稳定", P.stability)] },
    // —— 泛化风格（不依赖主轴，任何盘都可能命中）——
    { tag: "自由个体型", hit: deep(p, "autonomy") >= 62 && social.communication_need === "low" && (group === "output" || god === "偏印"), margin: deep(p, "autonomy") - 62, m: [M("自主空间", deep(p, "autonomy"))] },
    { tag: "台前发光体", hit: P.extroversion >= 65 && trait(p, "expressiveness") >= 60, margin: P.extroversion - 65 + trait(p, "expressiveness") - 60, m: [M("外向表达", P.extroversion), M("表达意愿", trait(p, "expressiveness"))] },
    { tag: "幕后操盘手", hit: P.extroversion <= 45 && P.control >= 60, margin: 45 - P.extroversion + P.control - 60, m: [M("外向表达", P.extroversion), M("边界控制", P.control)] },
    { tag: "救火队长", hit: deep(p, "resilience") >= 75 && trait(p, "adaptability") >= 55, margin: deep(p, "resilience") - 75 + trait(p, "adaptability") - 55, m: [M("压力韧性", deep(p, "resilience")), M("关系适应力", trait(p, "adaptability"))] },
    { tag: "多线程选手", hit: trait(p, "adaptability") >= 65 && deep(p, "novelty") >= 55, margin: trait(p, "adaptability") - 65 + deep(p, "novelty") - 55, m: [M("关系适应力", trait(p, "adaptability")), M("新鲜感需求", deep(p, "novelty"))] },
    { tag: "单线程深潜员", hit: deep(p, "autonomy") >= 60 && deep(p, "novelty") <= 45, margin: deep(p, "autonomy") - 60 + 45 - deep(p, "novelty"), m: [M("自主空间", deep(p, "autonomy")), M("新鲜感需求", deep(p, "novelty"))] },
    { tag: "长期主义者", hit: deep(p, "novelty") <= 42 && P.stability >= 62, margin: 42 - deep(p, "novelty") + P.stability - 62, m: [M("新鲜感需求", deep(p, "novelty")), M("情绪稳定", P.stability)] },
  ];
  const GROUP_IDX: Record<GodGroup, number> = { authority: 0, resource: 1, wealth: 2, peer: 3, output: 4 };
  const career: TagHit[] = careerRules.filter((r) => r.hit).sort((a, b) => b.margin - a.margin).slice(0, 3).map((r) => ({ tag: r.tag, metrics: r.m }));
  if (career.length < 2) {
    const groupDefault: Record<GodGroup, string> = {
      output: "创意输出型", resource: "深耕专家型", wealth: "务实操盘手", authority: "规则里的稳手", peer: "并肩作战型",
    };
    if (!career.some((h) => h.tag === groupDefault[group])) {
      career.push({ tag: groupDefault[group], metrics: [M("主轴强度", axisScore(GROUP_IDX[group]))] });
    }
  }

  // 能量域
  const energyTags: TagHit[] = [];
  if (social.communication_need === "low" || (deep(p, "autonomy") >= 60 && P.extroversion < 50)) energyTags.push({ tag: "独处回血", metrics: [M("自主空间", deep(p, "autonomy")), M("外向表达", P.extroversion)] });
  if (P.extroversion >= 65) energyTags.push({ tag: "人群充电", metrics: [M("外向表达", P.extroversion)] });
  if (deep(p, "resilience") >= 70) energyTags.push({ tag: "压力转化者", metrics: [M("压力韧性", deep(p, "resilience"))] });
  if (deep(p, "vigilance") >= 60 || P.stability < 45) energyTags.push({ tag: "节奏敏感体质", metrics: [M("关系警觉", deep(p, "vigilance")), M("情绪稳定", P.stability)] });
  if (P.stability >= 70 && !energyTags.some((h) => h.tag === "独处回血")) energyTags.push({ tag: "稳定供电型", metrics: [M("情绪稳定", P.stability)] });
  if (energyTags.length < 2) energyTags.push({ tag: isWeak(p) ? "省电模式选手" : "长续航体质", metrics: [M("能量基线", Math.round(p.energy.dayMaster.score))] });

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
      why: `这类环境天然给你补给（${ELEMENT_CN[el]}为你的喜用，${item.why}）`,
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

// ── 标签人话解释（与 REQ_AI_DIGEST §五 一一对应，兜底与 UI 提示共用）──────

export const TAG_EXPLAIN: Record<string, string> = {
  引导型恋人: "关系里主动带节奏、有掌控欲", 需要被接住的人: "依赖高、感受浓",
  慢热观察员: "信任给得慢、警觉性高", 独立空间型: "要自己的房间和沉默权",
  黏人补给型: "高频联系才安心", 直球选手: "有话当场说",
  情绪翻译官: "能接住对方没说出口的", 浪漫主义者: "相信心动这回事",
  新鲜感猎人: "腻得快、要更新", 老派长情型: "认定了就不换台",
  醋意敏感体质: "风吹草动都接收", 大心脏恋人: "不多想、不内耗",
  被追才有感觉: "浪漫但不先动", 嘴硬心软型: "吵架冲、转头软",
  安静陪伴型: "话少但在场", 仪式感大户: "纪念日一个不能少",
  冷静调解人: "吵不起来的那个", 恋爱规划师: "爱得有条理、不上头",
  心动就行动: "快热、敢开口", 行动派爱人: "不说爱你但接你下班",
  稳定供电型: "情绪输出稳定，是关系里的压舱石", 需要确认的人: "回应慢了会自己写小剧本",
  靠近需要耐心: "熟了才见真心", 顺其自然派: "节奏交给缘分",
  深耕专家型: "把一件事做穿的体质", 军师参谋型: "想得深说得少，幕后出主意",
  创意输出型: "想法有天然的出口", 细水长流的创作者: "创作要配补给，慢产but稳",
  抗压执行型: "压力越大越有形状", 规则里的稳手: "在框架内把事办漂亮",
  稳步爬梯型: "适合有台阶的体系，一层层上", 资源整合型: "把人和资源攒成局",
  务实操盘手: "不声张，把账算明白", 机会嗅觉型: "对风口天生敏感",
  靠谱交付型: "答应的事一定有下文", 破局开创型: "规则是用来重写的",
  并肩作战型: "合伙体质，受不了层级", 自由个体型: "一个人就是一支队伍",
  台前发光体: "站在人前反而来电", 幕后操盘手: "不出面，但盘是你的",
  救火队长: "越乱越冷静", 多线程选手: "几件事并行反而高效",
  单线程深潜员: "一次只做一件事，但做到底", 长期主义者: "慢变量的信徒",
  独处回血: "社交后需要独处充电", 人群充电: "热闹本身就是能量",
  压力转化者: "压力能被消化成动力", 节奏敏感体质: "环境一乱就耗电",
  省电模式选手: "能量预算有限，花在刀刃上", 长续航体质: "耐力型选手，后程发力",
};

// 正文禁用的命理黑话（校验器与测试共用）
export const JARGON_RE = /食神|伤官|比肩|劫财|正印|偏印|正官|七杀|正财|偏财|日主|喜用|忌神|身弱|身强|从弱|从强|禄|刃|藏干|十神|用神/;

// ── AI 叙述层：提示词契约、校验器、确定性兜底 ─────────────────────

export type DigestPayload = {
  headline: string;                                  // 一句话人设，≤15字
  tagReads: { tag: string; note: string }[];         // 标签逐条人话解释
  advice: { vocation: string; industry: string; environment: string; love: string; phase: string };
  summary: string;                                   // 80~120字收束
};

export function buildDigestPrompt(facts: ReturnType<typeof buildPersonalFacts>): { system: string; user: string } {
  return {
    system: [
      "你是 Fate 的「AI 读你」撰稿人。输入是一份由规则引擎算好的个人事实清单（JSON），你的工作是把它组织成普通人爱读的人话，不是算命。",
      `硬性契约：${facts.contract.rule}`,
      "输出严格为 JSON（不要 markdown 代码块），结构：",
      `{"headline":"一句话人设，15字以内","tagReads":[{"tag":"标签名","note":"这个人身上这条标签的具体样子，30字内，要具体到场景不要泛泛"}],"advice":{"vocation":"职业建议，只能从清单 recommendations.vocations 里挑，100字内，说清为什么顺手","industry":"行业建议，限定 industries，80字内","environment":"环境建议，基于 environments，80字内","love":"感情里的你：喜欢什么样的相处、什么最耗你、最该跟对方说清楚的一件事，100字内","phase":"当下时段策略，基于 currentPhase，60字内"},"summary":"100~160字总结，落在接下来怎么活"}`,
      "tagReads 必须覆盖清单 tags 里 love/career/energy 的每一个标签，一个不落；标签名只能用清单给出的，不得自创。",
      "每条 note 和建议都可引用清单里的具体分数增强说服力（放在括号里）；语气具体、有画面、不端着；禁止吉凶断言，禁止「注定/命中」类词。",
    ].join("\n"),
    user: `事实清单：\n${JSON.stringify(facts, null, 0)}`,
  };
}

// 校验：结构完整、标签只能来自清单、正文零黑话——不合格即弃用（调用方走兜底或重试）
export function validateDigestPayload(raw: unknown, facts: ReturnType<typeof buildPersonalFacts>): DigestPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<DigestPayload>;
  if (typeof d.headline !== "string" || d.headline.length === 0 || d.headline.length > 24) return null;
  if (!Array.isArray(d.tagReads) || d.tagReads.length < 3) return null;
  const allTags = new Set([...facts.tags.love, ...facts.tags.career, ...facts.tags.energy].map((h) => h.tag));
  for (const item of d.tagReads) {
    if (!item || typeof item.tag !== "string" || typeof item.note !== "string") return null;
    if (!allTags.has(item.tag)) return null; // 标签不得自创
  }
  // 逐条覆盖：清单里的每个标签都必须有解读
  const covered = new Set(d.tagReads.map((t) => t.tag));
  for (const tag of allTags) if (!covered.has(tag)) return null;
  const a = d.advice;
  if (!a || [a.vocation, a.industry, a.environment, a.love, a.phase].some((s) => typeof s !== "string" || s.length === 0)) return null;
  if (typeof d.summary !== "string" || d.summary.length < 40) return null;
  const everything = [d.headline, d.summary, a.vocation, a.industry, a.environment, a.love, a.phase, ...d.tagReads.map((t) => t.note)].join("");
  // 契约允许术语出现在括号依据里——剥掉括号内容后，正文必须零命理黑话
  if (JARGON_RE.test(everything.replace(/（[^）]*）|\([^)]*\)/g, ""))) return null;
  return d as DigestPayload;
}

// 确定性兜底：AI 不可用时的完整成品（同输入同输出，永不开天窗）
export function buildFallbackDigest(facts: ReturnType<typeof buildPersonalFacts>): DigestPayload {
  const t = facts.tags;
  const r = facts.recommendations;
  const allTags = [...t.love, ...t.career, ...t.energy].map((h) => h.tag);
  const careerTag = t.career[0]?.tag ?? t.energy[0]?.tag ?? "按自己的节奏做事";
  const loveTag = t.love[0]?.tag ?? "顺其自然派";
  const energyTag = t.energy[0]?.tag ?? "长续航体质";
  return {
    headline: `${careerTag} · ${loveTag}`,
    tagReads: allTags.map((tag) => ({ tag, note: TAG_EXPLAIN[tag] ?? "" })),
    advice: {
      vocation: `更顺手的方向：${r.vocations.slice(0, 3).map((v) => v.name).join("、")}。${r.vocations[0]?.why ?? ""}。`,
      industry: `行业优先看：${r.industries.slice(0, 3).map((v) => v.name).join("、")}。`,
      environment: r.environments.join("；"),
      love: `你在感情里是${t.love.map((h) => h.tag).join("、")}——${TAG_EXPLAIN[loveTag] ?? ""}。找能尊重这个节奏的人，别硬改出厂设置。`,
      phase: r.currentPhase,
    },
    summary: `${careerTag}是你的正职人设，${energyTag}是你的能量说明书。${r.currentPhase}把力气花在${r.vocations[0]?.name ?? "顺手的事"}上，感情里保持${loveTag}的本色——顺着结构走，比对抗它省电。`,
  };
}

// ── 个人事实清单：AI 叙述层的唯一输入 ────────────────────────────

export type PersonalFacts = ReturnType<typeof buildPersonalFacts>;

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
