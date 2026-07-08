// AI 读你 · 数据层（A1）—— 设计依据见 docs/REQ_AI_DIGEST.md
// 职责：把计算器结论翻译成人话标签与推荐候选池（全部确定性，进黄金测试），
// 并打包成 buildPersonalFacts —— AI 叙述层的唯一输入。
// 铁律：标签与候选池由规则表定，AI 只做挑选与措辞；正文零命理黑话，术语只进括号依据。

import type { Elements, UserProfile } from "./types";

// 标签命中时同时交出判定指标（t 为触发阈值，图表上画成刻度线）
export type TagMetric = { label: string; value: number; t?: number };
export type TagHit = { tag: string; metrics: TagMetric[] };
export type PersonaTags = { love: TagHit[]; career: TagHit[]; social: TagHit[]; energy: TagHit[] };
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
  const M = (label: string, value: number, t?: number) => ({ label, value, t });

  // 感情域：按超出阈值的幅度排序取前 3，不足 2 个时以依恋类型、关系节奏兜底；
  // 每条规则同时交出判定指标（m），作为标签卡上的可视化依据
  const loveRules: { tag: string; hit: boolean; margin: number; m: { label: string; value: number }[] }[] = [
    { tag: "引导型恋人", hit: trait(p, "initiative") >= 60 && P.control >= 60, margin: trait(p, "initiative") + P.control - 120, m: [M("关系主动性", trait(p, "initiative"), 60), M("边界控制", P.control, 60)] },
    { tag: "需要被接住的人", hit: deep(p, "dependency") >= 58 && P.emotion >= 65, margin: deep(p, "dependency") + P.emotion - 123, m: [M("情感依赖", deep(p, "dependency"), 58), M("情感感知", P.emotion, 65)] },
    { tag: "慢热观察员", hit: deep(p, "trust_speed") <= 45 && deep(p, "vigilance") >= 55, margin: 45 - deep(p, "trust_speed") + deep(p, "vigilance") - 55, m: [M("信任建立速度", deep(p, "trust_speed"), 45), M("关系警觉", deep(p, "vigilance"), 55)] },
    { tag: "独立空间型", hit: deep(p, "autonomy") >= 62 && deep(p, "dependency") <= 45, margin: deep(p, "autonomy") - 62 + 45 - deep(p, "dependency"), m: [M("自主空间", deep(p, "autonomy"), 62), M("情感依赖", deep(p, "dependency"), 45)] },
    { tag: "黏人补给型", hit: deep(p, "dependency") >= 58 && social.communication_need === "high", margin: deep(p, "dependency") - 58, m: [M("情感依赖", deep(p, "dependency"), 58)] },
    { tag: "直球选手", hit: deep(p, "conflict_expression") >= 60 && trait(p, "expressiveness") >= 60, margin: deep(p, "conflict_expression") + trait(p, "expressiveness") - 120, m: [M("冲突表达", deep(p, "conflict_expression"), 60), M("表达意愿", trait(p, "expressiveness"), 60)] },
    { tag: "情绪翻译官", hit: trait(p, "empathy") >= 65 && trait(p, "expressiveness") >= 55, margin: trait(p, "empathy") - 65 + trait(p, "expressiveness") - 55, m: [M("共情能力", trait(p, "empathy"), 65), M("表达意愿", trait(p, "expressiveness"), 55)] },
    { tag: "浪漫主义者", hit: deep(p, "romance") >= 60 && P.emotion >= 55, margin: deep(p, "romance") - 60 + P.emotion - 55, m: [M("浪漫倾向", deep(p, "romance"), 60), M("情感感知", P.emotion, 55)] },
    { tag: "新鲜感猎人", hit: deep(p, "novelty") >= 65, margin: deep(p, "novelty") - 65, m: [M("新鲜感需求", deep(p, "novelty"), 65)] },
    { tag: "老派长情型", hit: deep(p, "novelty") <= 42 && P.stability >= 60, margin: 42 - deep(p, "novelty") + P.stability - 60, m: [M("新鲜感需求", deep(p, "novelty"), 42), M("情绪稳定", P.stability, 60)] },
    { tag: "醋意敏感体质", hit: deep(p, "vigilance") >= 62 && P.emotion >= 60, margin: deep(p, "vigilance") - 62 + P.emotion - 60, m: [M("关系警觉", deep(p, "vigilance"), 62), M("情感感知", P.emotion, 60)] },
    { tag: "大心脏恋人", hit: deep(p, "vigilance") <= 42 && P.stability >= 60, margin: 42 - deep(p, "vigilance") + P.stability - 60, m: [M("关系警觉", deep(p, "vigilance"), 42), M("情绪稳定", P.stability, 60)] },
    { tag: "被追才有感觉", hit: trait(p, "initiative") <= 42 && deep(p, "romance") >= 50, margin: 42 - trait(p, "initiative") + deep(p, "romance") - 50, m: [M("关系主动性", trait(p, "initiative"), 42), M("浪漫倾向", deep(p, "romance"), 50)] },
    { tag: "嘴硬心软型", hit: deep(p, "conflict_expression") >= 58 && trait(p, "empathy") >= 58, margin: deep(p, "conflict_expression") - 58 + trait(p, "empathy") - 58, m: [M("冲突表达", deep(p, "conflict_expression"), 58), M("共情能力", trait(p, "empathy"), 58)] },
    { tag: "安静陪伴型", hit: trait(p, "expressiveness") <= 45 && P.stability >= 55, margin: 45 - trait(p, "expressiveness") + P.stability - 55, m: [M("表达意愿", trait(p, "expressiveness"), 45), M("情绪稳定", P.stability, 55)] },
    { tag: "仪式感大户", hit: deep(p, "romance") >= 62 && deep(p, "novelty") >= 50, margin: deep(p, "romance") - 62 + deep(p, "novelty") - 50, m: [M("浪漫倾向", deep(p, "romance"), 62), M("新鲜感需求", deep(p, "novelty"), 50)] },
    { tag: "冷静调解人", hit: P.stability >= 68 && deep(p, "conflict_expression") <= 45, margin: P.stability - 68 + 45 - deep(p, "conflict_expression"), m: [M("情绪稳定", P.stability, 68), M("冲突表达", deep(p, "conflict_expression"), 45)] },
    { tag: "恋爱规划师", hit: P.control >= 60 && P.stability >= 60 && deep(p, "romance") <= 50, margin: P.control + P.stability - 120, m: [M("边界控制", P.control, 60), M("情绪稳定", P.stability, 60)] },
    { tag: "心动就行动", hit: deep(p, "trust_speed") >= 62 && deep(p, "social_openness") >= 52, margin: deep(p, "trust_speed") - 62 + deep(p, "social_openness") - 52, m: [M("信任建立速度", deep(p, "trust_speed"), 62), M("社交开放度", deep(p, "social_openness"), 52)] },
    { tag: "行动派爱人", hit: trait(p, "expressiveness") <= 48 && trait(p, "initiative") >= 52, margin: 48 - trait(p, "expressiveness") + trait(p, "initiative") - 52, m: [M("表达意愿", trait(p, "expressiveness"), 48), M("关系主动性", trait(p, "initiative"), 52)] },
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
    { tag: "军师参谋型", hit: group === "resource" && trait(p, "expressiveness") <= 55, margin: AXIS + 55 - trait(p, "expressiveness"), m: [M("主轴·吸收理解", axisScore(1)), M("表达意愿", trait(p, "expressiveness"), 55)] },
    { tag: "创意输出型", hit: group === "output" && !isWeak(p), margin: AXIS + axisScore(4) / 5, m: [M("主轴·表达创造", axisScore(4))] },
    { tag: "细水长流的创作者", hit: group === "output" && isWeak(p), margin: AXIS + axisScore(4) / 5, m: [M("主轴·表达创造", axisScore(4))] },
    { tag: "抗压执行型", hit: group === "authority" && deep(p, "resilience") >= 70, margin: AXIS + deep(p, "resilience") - 70, m: [M("主轴·秩序执行", axisScore(0)), M("压力韧性", deep(p, "resilience"), 70)] },
    { tag: "规则里的稳手", hit: group === "authority" && deep(p, "resilience") < 70 && P.stability >= 55, margin: AXIS + P.stability - 55, m: [M("主轴·秩序执行", axisScore(0)), M("情绪稳定", P.stability, 55)] },
    { tag: "资源整合型", hit: group === "wealth" && P.extroversion >= 55, margin: AXIS + P.extroversion - 55, m: [M("主轴·现实资源", axisScore(2)), M("外向表达", P.extroversion, 55)] },
    { tag: "务实操盘手", hit: group === "wealth" && P.extroversion < 55, margin: AXIS + 55 - P.extroversion, m: [M("主轴·现实资源", axisScore(2)), M("外向表达", P.extroversion)] },
    { tag: "并肩作战型", hit: group === "peer", margin: AXIS + axisScore(3) / 5, m: [M("主轴·同伴自主", axisScore(3))] }, // 比劫靠同伴成事、不服层级——不是单打独斗（2026-07-03 拍板修正）
    { tag: "破局开创型", hit: god === "伤官" && !isWeak(p), margin: AXIS + deep(p, "conflict_expression") - 50, m: [M("主轴·表达创造", axisScore(4)), M("冲突表达", deep(p, "conflict_expression"))] },
    { tag: "机会嗅觉型", hit: god === "偏财" && deep(p, "novelty") >= 55, margin: AXIS + deep(p, "novelty") - 55, m: [M("主轴·现实资源", axisScore(2)), M("新鲜感需求", deep(p, "novelty"), 55)] },
    { tag: "靠谱交付型", hit: (god === "正财" || god === "正官") && P.stability >= 60, margin: AXIS + P.stability - 60, m: [M("情绪稳定", P.stability, 60)] },
    { tag: "稳步爬梯型", hit: group === "authority" && P.stability >= 65, margin: AXIS / 2 + P.stability - 65, m: [M("主轴·秩序执行", axisScore(0)), M("情绪稳定", P.stability, 65)] },
    // —— 泛化风格（不依赖主轴，任何盘都可能命中）——
    { tag: "自由个体型", hit: deep(p, "autonomy") >= 62 && social.communication_need === "low" && (group === "output" || god === "偏印"), margin: deep(p, "autonomy") - 62, m: [M("自主空间", deep(p, "autonomy"), 62)] },
    { tag: "台前发光体", hit: P.extroversion >= 65 && trait(p, "expressiveness") >= 60, margin: P.extroversion - 65 + trait(p, "expressiveness") - 60, m: [M("外向表达", P.extroversion, 65), M("表达意愿", trait(p, "expressiveness"), 60)] },
    { tag: "幕后操盘手", hit: P.extroversion <= 45 && P.control >= 60, margin: 45 - P.extroversion + P.control - 60, m: [M("外向表达", P.extroversion, 45), M("边界控制", P.control, 60)] },
    { tag: "救火队长", hit: deep(p, "resilience") >= 75 && trait(p, "adaptability") >= 55, margin: deep(p, "resilience") - 75 + trait(p, "adaptability") - 55, m: [M("压力韧性", deep(p, "resilience"), 75), M("关系适应力", trait(p, "adaptability"), 55)] },
    { tag: "多线程选手", hit: trait(p, "adaptability") >= 65 && deep(p, "novelty") >= 55, margin: trait(p, "adaptability") - 65 + deep(p, "novelty") - 55, m: [M("关系适应力", trait(p, "adaptability"), 65), M("新鲜感需求", deep(p, "novelty"), 55)] },
    { tag: "单线程深潜员", hit: deep(p, "autonomy") >= 60 && deep(p, "novelty") <= 45, margin: deep(p, "autonomy") - 60 + 45 - deep(p, "novelty"), m: [M("自主空间", deep(p, "autonomy"), 60), M("新鲜感需求", deep(p, "novelty"), 45)] },
    { tag: "长期主义者", hit: deep(p, "novelty") <= 42 && P.stability >= 62, margin: 42 - deep(p, "novelty") + P.stability - 62, m: [M("新鲜感需求", deep(p, "novelty"), 42), M("情绪稳定", P.stability, 62)] },
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

  // 人际域：圈子怎么进、分歧怎么处、答应的事算不算数
  const socialRules: { tag: string; hit: boolean; margin: number; m: TagMetric[] }[] = [
    { tag: "小圈子深交型", hit: deep(p, "social_openness") <= 40 && deep(p, "autonomy") >= 50, margin: 40 - deep(p, "social_openness") + deep(p, "autonomy") - 50, m: [M("社交开放度", deep(p, "social_openness"), 40), M("自主空间", deep(p, "autonomy"), 50)] },
    { tag: "人群自来熟", hit: deep(p, "social_openness") >= 60 && P.extroversion >= 55, margin: deep(p, "social_openness") - 60 + P.extroversion - 55, m: [M("社交开放度", deep(p, "social_openness"), 60), M("外向表达", P.extroversion, 55)] },
    { tag: "气氛调节者", hit: trait(p, "empathy") >= 60 && P.extroversion >= 55, margin: trait(p, "empathy") - 60 + P.extroversion - 55, m: [M("共情能力", trait(p, "empathy"), 60), M("外向表达", P.extroversion, 55)] },
    { tag: "靠谱回应者", hit: P.stability >= 60 && trait(p, "adaptability") >= 50, margin: P.stability - 60 + trait(p, "adaptability") - 50, m: [M("情绪稳定", P.stability, 60), M("关系适应力", trait(p, "adaptability"), 50)] },
    { tag: "冲突冷处理", hit: deep(p, "conflict_expression") <= 45 && P.stability >= 50, margin: 45 - deep(p, "conflict_expression") + P.stability - 50, m: [M("冲突表达", deep(p, "conflict_expression"), 45), M("情绪稳定", P.stability, 50)] },
    { tag: "当面掰扯型", hit: deep(p, "conflict_expression") >= 60, margin: deep(p, "conflict_expression") - 60, m: [M("冲突表达", deep(p, "conflict_expression"), 60)] },
    { tag: "独来独往侠", hit: deep(p, "autonomy") >= 62 && deep(p, "social_openness") <= 35, margin: deep(p, "autonomy") - 62 + 35 - deep(p, "social_openness"), m: [M("自主空间", deep(p, "autonomy"), 62), M("社交开放度", deep(p, "social_openness"), 35)] },
    { tag: "慢熟但长久", hit: deep(p, "trust_speed") <= 45 && P.stability >= 55, margin: 45 - deep(p, "trust_speed") + P.stability - 55, m: [M("信任建立速度", deep(p, "trust_speed"), 45), M("情绪稳定", P.stability, 55)] },
    { tag: "边界感大师", hit: P.control >= 65 && deep(p, "vigilance") >= 55, margin: P.control - 65 + deep(p, "vigilance") - 55, m: [M("边界控制", P.control, 65), M("关系警觉", deep(p, "vigilance"), 55)] },
    { tag: "人脉枢纽", hit: deep(p, "social_openness") >= 62 && trait(p, "initiative") >= 55, margin: deep(p, "social_openness") - 62 + trait(p, "initiative") - 55, m: [M("社交开放度", deep(p, "social_openness"), 62), M("关系主动性", trait(p, "initiative"), 55)] },
  ];
  const socialTags: TagHit[] = socialRules.filter((r) => r.hit).sort((a, b) => b.margin - a.margin).slice(0, 3).map((r) => ({ tag: r.tag, metrics: r.m }));
  if (socialTags.length < 2) {
    const commTag = { low: "独来独往侠", medium: "靠谱回应者", high: "人群自来熟" }[social.communication_need];
    if (!socialTags.some((h) => h.tag === commTag)) socialTags.push({ tag: commTag, metrics: [M("社交开放度", deep(p, "social_openness")), M("外向表达", P.extroversion)] });
  }

  // 能量域
  const energyTags: TagHit[] = [];
  if (social.communication_need === "low" || (deep(p, "autonomy") >= 60 && P.extroversion < 50)) energyTags.push({ tag: "独处回血", metrics: [M("自主空间", deep(p, "autonomy"), 60), M("外向表达", P.extroversion)] });
  if (P.extroversion >= 65) energyTags.push({ tag: "人群充电", metrics: [M("外向表达", P.extroversion, 65)] });
  if (deep(p, "resilience") >= 70) energyTags.push({ tag: "压力转化者", metrics: [M("压力韧性", deep(p, "resilience"), 70)] });
  if (deep(p, "vigilance") >= 60 || P.stability < 45) energyTags.push({ tag: "节奏敏感体质", metrics: [M("关系警觉", deep(p, "vigilance"), 60), M("情绪稳定", P.stability)] });
  if (P.stability >= 70 && !energyTags.some((h) => h.tag === "独处回血")) energyTags.push({ tag: "稳定供电型", metrics: [M("情绪稳定", P.stability, 70)] });
  if (energyTags.length < 2) energyTags.push({ tag: isWeak(p) ? "省电模式选手" : "长续航体质", metrics: [M("能量基线", Math.round(p.energy.dayMaster.score))] });

  return { love, career: career.slice(0, 3), social: socialTags, energy: energyTags.slice(0, 3) };
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
  小圈子深交型: "朋友不多，但都是真的", 人群自来熟: "到哪都能聊起来",
  气氛调节者: "冷场终结者", 靠谱回应者: "消息不落空，事有下文",
  冲突冷处理: "先退一步，再讲道理", 当面掰扯型: "有分歧当场说开",
  独来独往侠: "一个人自成体系", 慢熟但长久: "熟得慢，处得久",
  边界感大师: "亲疏有度，不越界也不让越", 人脉枢纽: "朋友的朋友都认识你",
  补给期: "外界给你的多于拿走的", 消耗期: "拿走的多于给的，宜蓄力",
  互见期: "一手补给一手消耗", 平稳期: "不添不减，节奏自定",
  偏强期: "你的进取窗口", 偏弱期: "宜深耕，少扩张", 潮平期: "节奏由事情决定",
  临水而居: "水边是你的充电桩", 绿意栖居: "绿化与书店密度是选房参考",
  向阳而生: "日照充足的地方养你", 安处即家: "稳定的生活半径是地基",
  利落之地: "秩序感强的环境省电", 随运而居: "环境不挑你，节奏挑你",
};

// 正文禁用的命理黑话（校验器与测试共用）
export const JARGON_RE = /食神|伤官|比肩|劫财|正印|偏印|正官|七杀|正财|偏财|日主|喜用|忌神|身弱|身强|从弱|从强|禄|刃|藏干|十神|用神/;

// ── 叙述层：提示词契约、校验器、确定性兜底（成册四章版）─────────────
// 品牌口径（2026-07-03 拍板）：对用户呈现为「报告内容基于 FATE 模型 2.0 得出」，
// 不出现「AI 不算命 / 基于报告生成」类免责话术；正文不引用指标数字（数据由图表呈现）。

export type ReportPageText = { essay: string; advice: string };
export type DigestPayload = {
  headline: string; // 封面一句话人设，≤15字
  // 2026-07-08 用户拍板 A：性情章(nature)由前端模板改为 AI 长评，与贰-伍章同管线
  pages: { nature: ReportPageText; love: ReportPageText; career: ReportPageText; social: ReportPageText; season: ReportPageText };
};

const STYLE_EXAMPLE = "你是先观察再靠近的人。别人用三次约会决定的事，你需要更久——不是犹豫，是你的信任系统出厂就设定了人工审核，每一条暧昧信号都要过一遍你的警觉雷达。你不太把喜欢挂在嘴上，但你记得对方随口提过的忌口；你的爱是把日子排进计划表，是稳定出现，而不是热烈宣言。最消耗你的，是节奏被强行加速、以及边界被反复试探的关系。";

export function buildDigestPrompt(facts: ReturnType<typeof buildPersonalFacts>): { system: string; user: string } {
  return {
    system: [
      "你是 FATE 深度解读报告的撰稿人。输入是 FATE 模型 2.0 已算好的个人事实清单（JSON），你负责把它写成五章报告正文。",
      "输出严格为 JSON（不要 markdown 代码块）：",
      `{"headline":"封面一句话人设，15字以内","pages":{"nature":{"essay":"性情章评述，160~220字","advice":"更容易合拍的人一条，40~70字"},"love":{"essay":"感情章评述，180~240字","advice":"给这个人的相处建议一条，40~70字"},"career":{"essay":"事业章评述，180~240字","advice":"落地行动建议一条，40~70字"},"social":{"essay":"人际章评述，160~220字","advice":"人际建议一条，40~70字"},"season":{"essay":"时运章评述，160~220字，可提及年龄段","advice":"当下策略一条，40~70字"}}}`,
      "铁律：",
      "1. 事实只能来自清单，不得新增判断或预测；每章评述围绕清单里该域展开（nature→dominantAxis+secondaryAxis+attachment+personality 性格四维，写这个人的底色气质与依恋方式；love→tags.love，career→tags.career+recommendations，social→tags.social，season→currentPhase+environments）。",
      "2. 正文与建议里【禁止出现任何数字和指标名】——数据已由图表呈现，你只写人话（season 章可写年龄段如「二十多岁这步」或阿拉伯年龄段）。",
      "3. 禁止命理术语（十神、五行、格局、喜用等字眼一律不得出现）；禁止吉凶断言与「注定/命中」类词。",
      "4. 第二人称，开篇即「你是……的人」式的判断句；写具体场景，不写星座号横行的空话。",
      `风格样例（感情章）：${STYLE_EXAMPLE}`,
    ].join("\n"),
    user: `事实清单：\n${JSON.stringify(facts, null, 0)}`,
  };
}

const DIGIT_RE = /[0-9０-９]/;

// 校验：结构完整、字数达标、正文零黑话零数字（season 章放行数字）——不合格即弃用
export function validateDigestPayload(raw: unknown, _facts: ReturnType<typeof buildPersonalFacts>): DigestPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<DigestPayload>;
  if (typeof d.headline !== "string" || d.headline.length === 0 || d.headline.length > 24) return null;
  const pages = d.pages;
  if (!pages) return null;
  const keys = ["nature", "love", "career", "social", "season"] as const;
  for (const key of keys) {
    const page = pages[key];
    if (!page || typeof page.essay !== "string" || typeof page.advice !== "string") return null;
    if (page.essay.length < 90 || page.advice.length < 15) return null;
    if (key !== "season" && DIGIT_RE.test(page.essay + page.advice)) return null; // 正文不引数字
  }
  const everything = [d.headline, ...keys.flatMap((k) => [pages[k]!.essay, pages[k]!.advice])].join("");
  if (JARGON_RE.test(everything)) return null; // 正文零命理黑话
  return d as DigestPayload;
}

// 确定性兜底：AI 不可用时的完整四章成品（同输入同输出，正文同样零数字零黑话）
export function buildFallbackDigest(facts: ReturnType<typeof buildPersonalFacts>): DigestPayload {
  const t = facts.tags;
  const r = facts.recommendations;
  const name = (hits: { tag: string }[], i = 0) => hits[i]?.tag ?? "";
  const ex = (tag: string) => TAG_EXPLAIN[tag] ?? "";
  const loveMain = name(t.love);
  const careerMain = name(t.career) || name(t.energy);
  const socialMain = name(t.social);
  const phaseTone = facts.seasonStamps.phase.tone;
  const seasonAdvice = phaseTone === "boost"
    ? "这是你的进取窗口：该开口的开口，该启动的启动，把想了很久的事排上日程。"
    : phaseTone === "drain"
      ? "优先守成、蓄力与做减法：把专业做深、把身体睡好、把钱存下，不在这一段里赌爆发。"
      : "顺手的事多做、费劲的事缓行，让具体事情替你定节奏，不必强求统一姿势。";
  // 性情章兜底(确定性):由主/副轴主题 + 依恋 + 关键分阈值拼出,零数字零黑话
  const k = facts.keyScores;
  const natureBits: string[] = [];
  if (k.autonomy >= 60) natureBits.push("自留地要够大");
  if (k.dependency >= 60) natureBits.push("在乎回应的温度");
  if (k.novelty >= 60) natureBits.push("对新鲜事来者不拒");
  if (k.resilience >= 60) natureBits.push("压力之下反而站得稳");
  if (k.vigilance >= 60) natureBits.push("信任要一层层给");
  if (!natureBits.length) natureBits.push("节奏平顺，不走极端");
  const attach = facts.attachment.replace("偏", "");
  const matchMap: Record<string, string> = {
    安全型: "大多数人都接得住你；和同样稳定的人在一起，升温最省力，也最不费心。",
    焦虑型: "回应稳定、说到做到的人最能接住你——若即若离只会放大你的内耗。",
    回避型: "不追问、肯给空间的人和你最合拍——查岗式的热情只会把你越推越远。",
  };
  return {
    headline: `${careerMain} · ${loveMain}`,
    pages: {
      nature: {
        essay: `你的底色，主轴落在${facts.dominantAxis.theme}，副轴${facts.secondaryAxis.theme}在不同场景轮换出面——两股劲交替上台，构成你处理关系与做事时最本能的那一面。往细里说：${natureBits.slice(0, 3).join("，")}；亲近别人的方式偏${attach}。这不是贴上去的标签，是你出厂时就装好的操作系统，顺着它用，比逆着它较劲省力得多，也自在得多。`,
        advice: matchMap[attach] ?? matchMap["安全型"],
      },
      love: {
        essay: `你在感情里是${t.love.map((h) => h.tag).join("、")}。${ex(loveMain)}——你的信任需要时间验证，可一旦给出，就是长期饭票级的稳定。你不习惯把情绪摊开来讲，更习惯用行动把在乎落到实处：稳定出现、记得细节、把答应的事办成。最消耗你的，是节奏被强行加速、边界被反复试探的关系；而能等你慢慢打开的人，会得到一个几乎不需要担心的伴侣。`,
        advice: "把你的节奏提前说明白：慢，不是不喜欢，是在认真核对。能等的人，才配进下一关。",
      },
      career: {
        essay: `你是${t.career.map((h) => h.tag).join("、")}的选手。${ex(careerMain)}——你的主轴是${facts.dominantAxis.theme}，顺着它选工作，比硬凹人设省力得多。你未必是台前最亮的那个，但你是把事情兜住的那个：规则、节奏、风险都在你脑子里跑。要留意的只有一件事：能扛不等于该扛，你也需要给自己留出口。`,
        advice: `方向优先看：${r.vocations.slice(0, 3).map((v) => v.name).join("、")}；行业顺手的是${r.industries.slice(0, 2).map((v) => v.name).join("、")}。`,
      },
      social: {
        essay: `${t.social.map((h) => h.tag).join("、")}，是你的人际底色。${ex(socialMain)}——你的圈子不靠数量撑场面，靠的是淘汰率低：进得慢，但留得住。对圈外人你客气而有分寸，对圈内人你是那个深夜会接电话的人。分歧出现时你倾向先消化再回应，这不是回避，是你的处理顺序。`,
        advice: "冷静之前留一句预告：「我需要想想，明天回你」——这一句话，能省掉一半误会。",
      },
      season: {
        essay: `${r.currentPhase}${ex(facts.seasonStamps.environment.tag)}——环境对你不是背景板，是补给线的一部分。把居住和工作的地方选对，等于给自己常年开着一台回血机。`,
        advice: seasonAdvice,
      },
    },
  };
}

// ── 个人事实清单：AI 叙述层的唯一输入 ────────────────────────────

export type PersonalFacts = ReturnType<typeof buildPersonalFacts>;

export function buildPersonalFacts(p: UserProfile) {
  const dm = p.energy.dayMaster;
  const attachmentCN = { secure: "偏安全型", anxious: "偏焦虑型", avoidant: "偏回避型" } as const;
  // 时运章印：当下大运的补耗身份 + 环境身份（确定性，含解释）
  const current = p.luckCycles.periods.find((x) => x.isCurrent);
  const phaseName = current?.verdict
    ? ({ 补给: "补给期", 消耗: "消耗期", 互见: "互见期", 平段: "平稳期", 偏强期: "偏强期", 偏弱期: "偏弱期", 潮平: "潮平期" } as Record<string, string>)[current.verdict.label] ?? "平稳期"
    : "未起运";
  const envName = dm.favorable.length === 0
    ? "随运而居"
    : ({ water: "临水而居", wood: "绿意栖居", fire: "向阳而生", earth: "安处即家", metal: "利落之地" } as Record<string, string>)[dm.favorable[0]] ?? "随运而居";
  const seasonStamps = {
    phase: { tag: phaseName, note: TAG_EXPLAIN[phaseName] ?? "", tone: current?.verdict?.tone ?? "neutral", range: current ? `${current.startAge}—${current.endAge} 岁` : "" },
    environment: { tag: envName, note: TAG_EXPLAIN[envName] ?? "" },
  };
  const luckLine = p.luckCycles.periods.slice(0, 5).map((period) => ({
    range: `${period.startAge}—${period.endAge} 岁`,
    label: period.verdict?.label ?? "—",
    tone: period.verdict?.tone ?? "neutral",
    current: period.isCurrent,
  }));
  return {
    seasonStamps,
    luckLine,
    dayPillar: p.bazi.dayPillar,
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
      rule: "只许转述与组织清单中的事实，不得新增任何判断或预测；正文与建议禁用命理术语，且不得出现任何指标数字（数据由图表呈现，season 章可提年龄段）；标签与推荐必须从清单给定项中选取，不得自创。",
      output: "成册四章：封面一句话人设 + love/career/social/season 各一章（评述 + 建议一条），品牌口径为「报告内容基于 FATE 模型 2.0 得出」。",
    },
  };
}
