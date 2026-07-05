import Link from "next/link";
import type { CSSProperties } from "react";
import { analyzeAnnualFlow, analyzeBirth, analyzeDuoRhythm, analyzeRelationship, matchProfiles, monthGanZhi, validateBirth } from "@/lib/fate";
import type { BirthInput, PairMetric } from "@/lib/types";
import ChatAssistant from "@/components/ChatAssistant";
import InviteShare from "@/components/InviteShare";
import ShareCard from "@/components/ShareCard";
import HistoryRecorder from "@/components/HistoryRecorder";
import PillarLinks from "@/components/PillarLinks";
import PlotPanel, { PlotTrigger } from "@/components/PlotPanel";

import { askDeepSeek } from "@/lib/deepseek";

const labels = { extroversion: "外向表达", stability: "情绪稳定", control: "边界控制", emotion: "情感感知" };
// 六维分数构成说明：与 compatibilityBreakdown 的合成要素一一对应，回答「这个分数哪来的」
const DIM_FORMULA: Record<string, string> = {
  attraction: "五行互补 × 外向表达差 × 合会增益",
  emotional: "情绪浓度接近度 × 稳定托底 × 印星支持",
  expression: "表达强度差 × 双方食伤结构 × 情绪差",
  power: "边界控制差 × 空间需求差 × 冲克压力",
  daily: "推进节奏差 × 新鲜感差 × 日支结构",
  repair: "压力韧性 × 冲突表达差 × 合冲结构",
};
// 双人对比条：正文只写定性结论，数字一律走图形（对应 PairMetric；b 缺省时渲染单条）
const clampBar = (value: number) => Math.min(100, Math.max(4, value));
function PairBars({ metrics, aName, bName }: { metrics: PairMetric[]; aName: string; bName: string }) {
  if (!metrics.length) return null;
  const hasPair = metrics.some((metric) => metric.b !== undefined);
  return <div className="pair-bars">
    {hasPair && <div className="pair-bars-legend"><span className="legend-a">{aName}</span><span className="legend-b">{bName}</span></div>}
    {metrics.map((metric) => <div className="pair-bar-row" key={metric.label}>
      <span>{metric.label}</span>
      <div className="pair-lines">
        <div className="pair-line"><i className="pair-track"><b className={metric.b !== undefined ? "pair-fill-a" : "pair-fill-solo"} style={{ width: `${clampBar(metric.a)}%` }} /></i><em>{metric.a}</em></div>
        {metric.b !== undefined && <div className="pair-line"><i className="pair-track"><b className="pair-fill-b" style={{ width: `${clampBar(metric.b)}%` }} /></i><em>{metric.b}</em></div>}
      </div>
    </div>)}
  </div>;
}
const elementLabels = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
const socialLabels: Record<string, string> = {
  low: "低", medium: "中等", high: "高", slow: "慢热", fast: "快速",
  secure: "安全型", anxious: "焦虑型", avoidant: "回避型",
};
const candidates = [
  { name: "林知遥", role: "安静的观察者", birth: { year: 1997, month: 11, day: 8, hour: 22 } },
  { name: "陈弥", role: "好奇的连接者", birth: { year: 1999, month: 6, day: 17, hour: 10 } },
  { name: "周屿", role: "稳定的建设者", birth: { year: 1995, month: 4, day: 28, hour: 16 } },
  { name: "许禾", role: "温柔的行动派", birth: { year: 2000, month: 2, day: 11, hour: 9 } },
  { name: "沈砚", role: "有边界的倾听者", birth: { year: 1996, month: 9, day: 3, hour: 20 } },
  { name: "苏遥", role: "松弛的分享者", birth: { year: 2002, month: 5, day: 21, hour: 13 } },
  { name: "顾川", role: "慢热的探索者", birth: { year: 1998, month: 12, day: 6, hour: 7 } },
  { name: "程安", role: "可靠的同路人", birth: { year: 2001, month: 3, day: 15, hour: 18 } },
];

export async function ResultContent({
  birth, embedded = false, view = "overview", partnerBirth, relationType = "恋爱", detail, assistantQuestion, flowYear = new Date().getFullYear(), moduleKey = "",
}: {
  birth: BirthInput;
  embedded?: boolean;
  view?: "overview" | "deep" | "match" | "square";
  partnerBirth?: BirthInput;
  relationType?: string;
  detail?: string;
  assistantQuestion?: string;
  flowYear?: number;
  moduleKey?: string;
}) {
  const error = validateBirth(birth);
  if (error) return (
    <main className="result-page"><nav><Link className="brand" href="/">FATE<span>°</span></Link></nav>
      <section className="invalid"><div className="section-number">输入有误</div><h1>这个时间点<br />似乎不存在。</h1><p>{error}</p><Link className="back-link" href="/">← 返回重新填写</Link></section>
    </main>
  );

  const profile = analyzeBirth(birth);
  // 推荐候选盘只在广场视图计算：8 张完整排盘是页面最贵的计算，其他视图不需要
  const squareEnabled = false; // 广场未开发完，先锁
  const recommendations = squareEnabled && view === "square" ? candidates
    .map((candidate) => {
      const candidateProfile = analyzeBirth(candidate.birth);
      return { ...candidate, candidateProfile, result: matchProfiles(profile, candidateProfile) };
    })
    .sort((a, b) => b.result.score - a.result.score) : [];
  const partnerProfile = partnerBirth && !validateBirth(partnerBirth) ? analyzeBirth(partnerBirth) : null;
  const relationship = partnerProfile ? analyzeRelationship(profile, partnerProfile, relationType) : null;
  const baseQuery = `year=${birth.year}&month=${birth.month}&day=${birth.day}&hour=${birth.hour}&minute=${birth.minute ?? 0}&gender=${birth.gender ?? "female"}&name=${encodeURIComponent(birth.name ?? "我")}&calendarType=${birth.calendarType ?? "solar"}&isLeapMonth=${birth.isLeapMonth ? "true" : "false"}`;
  const partnerQuery = partnerBirth ? `&partnerYear=${partnerBirth.year}&partnerMonth=${partnerBirth.month}&partnerDay=${partnerBirth.day}&partnerHour=${partnerBirth.hour}&partnerMinute=${partnerBirth.minute ?? 0}&partnerGender=${partnerBirth.gender ?? "male"}&partnerName=${encodeURIComponent(partnerBirth.name ?? "TA")}&partnerCalendarType=${partnerBirth.calendarType ?? "solar"}&partnerIsLeapMonth=${partnerBirth.isLeapMonth ? "true" : "false"}&relationType=${encodeURIComponent(relationType)}` : "";
  const selectedDeep = view === "deep" ? profile.deepAnalysis.find((item) => item.key === detail) : null;
  const selectedInteraction = view === "match" ? relationship?.cards.find((item) => item.key === detail) : null;
  const assistantContext = selectedDeep ? {
    title: selectedDeep.label, summary: selectedDeep.summary, evidence: [...selectedDeep.evidence, `命盘量化分数 ${selectedDeep.score}`],
    suggestions: ["为什么这个分数高？", "反向信号是什么？", "能举个生活例子吗？"],
  } : selectedInteraction ? {
    title: selectedInteraction.label, summary: selectedInteraction.summary,
    evidence: [selectedInteraction.summary, ...selectedInteraction.metrics.map((metric) => metric.b !== undefined ? `${metric.label} ${metric.a}:${metric.b}` : `${metric.label} ${metric.a}`), selectedInteraction.advice],
    suggestions: ["为什么会这样互动？", "冲突时具体怎么做？", "双方谁更需要安全感？"],
  } : view === "match" && relationship && partnerProfile ? {
    title: `${birth.name ?? "我"}与${partnerBirth?.name ?? "TA"}的${relationship.relationType}合盘`,
    summary: `总分 ${relationship.score}：${relationship.headline}。${relationship.guide.philosophy}`,
    evidence: [
      ...relationship.scoreBreakdown.map((item) => `${item.label} ${item.score} 分（权重 ${item.weight}%）`),
      `依恋倾向：偏${socialLabels[profile.socialProfile.attachment_style]} × 偏${socialLabels[partnerProfile.socialProfile.attachment_style]}`,
      `主轴十神：${profile.dominantPersona.god} × ${partnerProfile.dominantPersona.god}`,
      ...(relationship.branchDynamics[0] ? [`最强跨盘结构：${relationship.branchDynamics[0].title}（${relationship.branchDynamics[0].scoreImpact > 0 ? "+" : ""}${relationship.branchDynamics[0].scoreImpact} 分）`] : []),
      `建议先主动的一方：${relationship.guide.initiator.name}`,
      ...analyzeDuoRhythm(profile, partnerProfile, relationship.relationType, new Date().getFullYear(), 5)
        .map((yearItem) => `流年 ${yearItem.year} ${yearItem.ganZhi}：${yearItem.tendencies.map((t) => `${t.label}倾向 ${t.value}（${t.causes.map((c) => `${c.who}${c.label}`).join("、")}）`).join("；") || "无强倾向"}`),
    ],
    suggestions: ["综合点评我们这段关系", "我们最大的雷区是什么？", "第一次吵架该怎么处理？"],
  } : {
    title: view === "square" ? "同频广场" : view === "match" ? "双人匹配" : view === "deep" ? "十神深度分析" : "八字概览",
    summary: profile.summary,
    evidence: [`日主 ${profile.bazi.dayPillar[0]}`, `主导身份 ${profile.archetype}`, `十神主导 ${profile.tenGodAnalysis.slice().sort((a, b) => b.count - a.count)[0].members}`],
    suggestions: ["七杀是什么？", "为什么我的进取心高？", "为什么我容易没有新鲜感？"],
  };
  const assistantAnswer = assistantQuestion ? await askDeepSeek(assistantQuestion, assistantContext.title, assistantContext.summary, assistantContext.evidence, view === "match" && !!relationship && !selectedInteraction) : undefined;
  const moduleQuery = moduleKey ? `&module=${moduleKey}` : "";
  const assistantHref = `/?${baseQuery}&view=${view}${partnerQuery}${moduleQuery}${detail ? `&detail=${detail}` : ""}`;
  const returnAnchor = selectedDeep ? `deep-card-${selectedDeep.key}` : selectedInteraction ? `match-card-${selectedInteraction.key}` : `view-${view}`;
  const assistantFields: Record<string, string> = {
    year: String(birth.year), month: String(birth.month), day: String(birth.day), hour: String(birth.hour),
    minute: String(birth.minute ?? 0), name: birth.name ?? "我",
    gender: birth.gender ?? "female", calendarType: birth.calendarType ?? "solar",
    isLeapMonth: birth.isLeapMonth ? "true" : "false", view, ...(detail ? { detail } : {}), ...(moduleKey ? { module: moduleKey } : {}),
    ...(partnerBirth ? {
      partnerYear: String(partnerBirth.year), partnerMonth: String(partnerBirth.month),
      partnerDay: String(partnerBirth.day), partnerHour: String(partnerBirth.hour),
      partnerMinute: String(partnerBirth.minute ?? 0), partnerName: partnerBirth.name ?? "TA",
      partnerGender: partnerBirth.gender ?? "male", partnerCalendarType: partnerBirth.calendarType ?? "solar",
      partnerIsLeapMonth: partnerBirth.isLeapMonth ? "true" : "false", relationType,
    } : {}),
    ...(assistantQuestion ? { ask: assistantQuestion } : {}),
  };
  const polygonPoint = (index: number, count: number, radius: number, center = 160) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
  };
  const deepGrid = (radius: number) => profile.deepAnalysis.map((_, index) => polygonPoint(index, 12, radius)).join(" ");
  const deepValues = profile.deepAnalysis.map((item, index) => polygonPoint(index, 12, 112 * item.score / 100)).join(" ");
  const scoreBands = [
    { max: 27, label: "弱", detail: "该倾向通常不主动出现" },
    { max: 44, label: "偏低", detail: "只在特定关系或压力下出现" },
    { max: 64, label: "中段", detail: "会根据对象与情境切换" },
    { max: 81, label: "偏高", detail: "多数关系中都能被观察到" },
    { max: 100, label: "强", detail: "容易成为稳定且鲜明的行为模式" },
  ];
  const bandFor = (score: number) => scoreBands.find((band) => score <= band.max) ?? scoreBands[4];
  const deepFactorMap: Record<string, { gods: string[]; elements: (keyof typeof elementLabels)[] }> = {
    ambition: { gods: ["七杀", "偏财", "伤官"], elements: ["fire"] },
    vigilance: { gods: ["偏印", "七杀", "食神"], elements: ["water"] },
    autonomy: { gods: ["比肩", "劫财", "偏印"], elements: ["metal"] },
    social_openness: { gods: ["偏财", "食神", "伤官"], elements: ["fire"] },
    trust_speed: { gods: ["正印", "偏印", "七杀"], elements: ["earth"] },
    dependency: { gods: ["正印", "正财", "比肩"], elements: ["water"] },
    responsibility: { gods: ["正官", "正财", "正印"], elements: ["earth"] },
    romance: { gods: ["偏财", "食神", "伤官"], elements: ["fire"] },
    empathy_deep: { gods: ["正印", "食神", "七杀"], elements: ["water"] },
    resilience: { gods: ["七杀", "偏印", "比肩"], elements: ["metal"] },
    conflict_expression: { gods: ["伤官", "劫财", "正官"], elements: ["fire"] },
    novelty: { gods: ["偏财", "伤官", "食神"], elements: ["wood", "fire"] },
  };
  const totalGodWeight = Object.values(profile.tenGodCounts).reduce((sum, value) => sum + value, 0) || 1;
  const factorTagsFor = (key: string) => {
    const factors = deepFactorMap[key] ?? { gods: [], elements: [] };
    const godTags = factors.gods
      .map((god) => ({ label: `${god}占比`, value: Math.round((profile.tenGodCounts[god] ?? 0) / totalGodWeight * 100), tone: "god" }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 2);
    const elementTags = factors.elements.map((element) => ({
      label: `${elementLabels[element]}元素`, value: Math.round(profile.bazi.elementStrength[element]), tone: element,
    }));
    return [...godTags, ...elementTags];
  };
  const deepCategories = (["亲密与安全", "沟通与连接", "边界与冲突", "成长与行动"] as const).map((category) => ({
    category,
    subtitle: {
      "亲密与安全": "信任、依恋、猜疑与交付",
      "沟通与连接": "共情、示好、社交入口",
      "边界与冲突": "空间、分歧与关系更新",
      "成长与行动": "目标、责任与压力反应",
    }[category],
    items: profile.deepAnalysis.filter((item) => item.category === category),
  }));
  // 深度分析章节目录：四类维度 + 专项观察
  const deepModules = [
    { key: "intimacy", no: "壹", category: "亲密与安全" as const },
    { key: "connect", no: "贰", category: "沟通与连接" as const },
    { key: "boundary", no: "叁", category: "边界与冲突" as const },
    { key: "growth", no: "肆", category: "成长与行动" as const },
    { key: "special", no: "伍", category: null },
    { key: "social", no: "陆", category: null },
  ].map((item) => {
    const group = item.category ? deepCategories.find((candidate) => candidate.category === item.category) : null;
    const topCard = group?.items.slice().sort((x, y) => y.score - x.score)[0];
    const topSpecial = profile.specialtyAnalysis.slice().sort((x, y) => y.score - x.score)[0];
    if (item.key === "social") return {
      ...item,
      title: "社交模式",
      subtitle: "连接如何建立与维持",
      teaser: `${socialLabels[profile.socialProfile.communication_need]}沟通需求 · 偏${socialLabels[profile.socialProfile.attachment_style]}依恋`,
    };
    return {
      ...item,
      title: item.category ?? "专项观察",
      subtitle: group?.subtitle ?? "神煞与十神的延伸维度",
      teaser: item.category ? `${topCard?.label} ${topCard?.score} 分 · ${topCard?.descriptor}` : `${topSpecial.label} ${topSpecial.score} 分 · ${topSpecial.descriptor}`,
    };
  });
  const deepActive = view === "deep" ? deepModules.find((item) => item.key === moduleKey) ?? null : null;
  const deepActiveIndex = deepActive ? deepModules.findIndex((item) => item.key === deepActive.key) : -1;
  const duoDimensions = partnerProfile ? [
    ["表达", profile.traitAnalysis[0].score, partnerProfile.traitAnalysis[0].score],
    ["稳定", profile.traitAnalysis[1].score, partnerProfile.traitAnalysis[1].score],
    ["边界", profile.traitAnalysis[2].score, partnerProfile.traitAnalysis[2].score],
    ["情感", profile.traitAnalysis[3].score, partnerProfile.traitAnalysis[3].score],
    ["主动", profile.traitAnalysis[6].score, partnerProfile.traitAnalysis[6].score],
    ["适应", profile.traitAnalysis[7].score, partnerProfile.traitAnalysis[7].score],
  ] as [string, number, number][] : [];
  const duoGrid = (radius: number) => duoDimensions.map((_, index) => polygonPoint(index, 6, radius)).join(" ");
  // 雷达按本图数据动态定标：最大值落在约九成半径处，避免中低分盘挤成小团（标签仍显示原始分）
  const duoScale = Math.max(55, ...duoDimensions.map((item) => Math.max(item[1], item[2]))) / 0.9;
  const duoRadius = (score: number) => 112 * Math.min(1, score / duoScale);
  const duoMine = duoDimensions.map((item, index) => polygonPoint(index, 6, duoRadius(item[1]))).join(" ");
  const duoTheirs = duoDimensions.map((item, index) => polygonPoint(index, 6, duoRadius(item[2]))).join(" ");
  const elementColors = { wood: "#58a878", fire: "#e66e5e", earth: "#d6a64f", metal: "#86a3ad", water: "#5b83bd" };
  // 十二维四域配色(紫微星海制式,与落地页雷达一致)
  const dimCatColor: Record<string, string> = { "成长与行动": "#d9b26c", "亲密与安全": "#d98a97", "边界与冲突": "#a98fd6", "沟通与连接": "#7fa9d9" };
  const elementRadar = (Object.entries(profile.bazi.elementStrength) as [keyof typeof elementLabels, number][]).map(([key, value]) => ({
    key, label: elementLabels[key], value, color: elementColors[key],
  }));
  const elementGrid = (radius: number) => elementRadar.map((_, index) => polygonPoint(index, 5, radius)).join(" ");
  const elementRadius = (value: number) => 24 + 88 * Math.min(value / 45, 1);
  const elementValues = elementRadar.map((item, index) => polygonPoint(index, 5, elementRadius(item.value))).join(" ");
  const elementRadarPanel = <section className="element-card element-radar-card overview-element-radar">
    <div className="element-radar-copy"><small>五行能量图谱</small><h3>随月令旺衰的能量推演</h3><p>以月令定五行旺衰，再计通根透干与合冲刑害对每个字的增减。图形展示这套推演后的真实占比，不把八个字等量计数。</p><div className="element-weight-note"><span>月令旺衰</span><span>通根透干</span><span>合会成局</span><span>冲刑折损</span></div></div>
    <div className="element-radar">
      <svg viewBox="0 0 320 320" role="img" aria-label="五行能量雷达图，不显示具体数字">
        <defs><linearGradient id="elementRadarFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#58a878" /><stop offset=".28" stopColor="#e66e5e" /><stop offset=".52" stopColor="#d6a64f" /><stop offset=".76" stopColor="#86a3ad" /><stop offset="1" stopColor="#5b83bd" /></linearGradient></defs>
        {[112, 84, 56, 28].map((radius) => <polygon key={radius} points={elementGrid(radius)} className="element-grid" />)}
        {elementRadar.map((item, index) => { const [x, y] = polygonPoint(index, 5, 112).split(","); return <line key={item.key} x1="160" y1="160" x2={x} y2={y} style={{ stroke: item.color }} />; })}
        <polygon points={elementValues} className="element-value" />
        {elementRadar.map((item, index) => { const [x, y] = polygonPoint(index, 5, elementRadius(item.value)).split(","); return <circle key={item.key} cx={x} cy={y} r="5" style={{ fill: item.color }} />; })}
      </svg>
      {elementRadar.map((item, index) => {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
        return <span key={item.key} style={{ left: `${50 + Math.cos(angle) * 41}%`, top: `${50 + Math.sin(angle) * 41}%`, color: item.color }}><i style={{ background: item.color }} />{item.label}</span>;
      })}
    </div>
  </section>;
  const socialModelItems = [
    {
      key: "communication", symbol: "言", label: "沟通频率",
      value: socialLabels[profile.socialProfile.communication_need],
      options: ["低频深聊", "适度往来", "高频回应"],
      active: ({ low: 0, medium: 1, high: 2 } as const)[profile.socialProfile.communication_need],
      description: profile.socialProfile.communication_need === "high"
        ? "需要持续而明确的回应来维持连接感，长时间失联容易被理解为关系降温。"
        : profile.socialProfile.communication_need === "low"
          ? "不依赖高频互动确认关系，更重视谈话质量，也需要保留独处和内部整理的时间。"
          : "既需要稳定联系，也能接受各自生活；比起消息数量，更在意回应是否连贯。",
    },
    {
      key: "conflict", symbol: "衡", label: "分歧处理",
      value: socialLabels[profile.socialProfile.conflict_tolerance],
      options: ["谨慎避让", "整理后谈", "直接处理"],
      active: profile.socialProfile.conflict_tolerance === "high" ? 2 : 0,
      description: profile.socialProfile.conflict_tolerance === "high"
        ? "面对分歧时较能承受正面讨论，但仍需区分解决问题与争夺正确。"
        : "更倾向先降低冲突强度，再决定是否表达；若长期延后，真实不满可能被忽略。",
    },
    {
      key: "pace", symbol: "序", label: "关系推进",
      value: socialLabels[profile.socialProfile.relationship_speed],
      options: ["慢热确认", "自然推进", "快速靠近"],
      active: ({ slow: 0, medium: 1, fast: 2 } as const)[profile.socialProfile.relationship_speed],
      description: profile.socialProfile.relationship_speed === "fast"
        ? "容易在感受到回应后迅速增加投入，适合用清晰边界避免热度先于了解。"
        : profile.socialProfile.relationship_speed === "slow"
          ? "需要通过连续、可靠的互动确认安全感；关系越被催促，越可能退回观察状态。"
          : "通常随着熟悉度自然增加投入，不追求突然升温，也不喜欢长期停滞。",
    },
    {
      key: "attachment", symbol: "安", label: "安全感来源",
      value: socialLabels[profile.socialProfile.attachment_style],
      options: ["空间", "稳定回应", "明确承诺"],
      active: profile.socialProfile.attachment_style === "avoidant" ? 0 : profile.socialProfile.attachment_style === "secure" ? 1 : 2,
      description: profile.socialProfile.attachment_style === "secure"
        ? "安全感主要来自稳定、可预期且不过度控制的互动，能够同时容纳亲密与个人空间。"
        : profile.socialProfile.attachment_style === "anxious"
          ? "更需要清晰回应与关系确认；模糊、忽冷忽热比直接分歧更容易引发不安。"
          : "安全感首先来自自主空间与边界被尊重；过快追问可能被体验为压力。",
    },
  ];
  const dayTheme = ({
    甲: "jia", 乙: "yi", 丙: "bing", 丁: "ding", 戊: "wu",
    己: "ji", 庚: "geng", 辛: "xin", 壬: "ren", 癸: "gui",
  } as Record<string, string>)[profile.bazi.dayPillar[0]] ?? "jia";
  const annualGanZhi = (year: number) => {
    const index = ((year - 1984) % 60 + 60) % 60;
    return `${"甲乙丙丁戊己庚辛壬癸"[index % 10]}${"子丑寅卯辰巳午未申酉戌亥"[index % 12]}`;
  };
  const annualTone = (glyph: string) => ({
    甲: "wood", 乙: "wood", 寅: "wood", 卯: "wood",
    丙: "fire", 丁: "fire", 巳: "fire", 午: "fire",
    戊: "earth", 己: "earth", 辰: "earth", 戌: "earth", 丑: "earth", 未: "earth",
    庚: "metal", 辛: "metal", 申: "metal", 酉: "metal",
    壬: "water", 癸: "water", 子: "water", 亥: "water",
  } as Record<string, string>)[glyph] ?? "earth";
  const currentLuckPeriod = profile.luckCycles.periods.find((period) => period.isCurrent);
  const annualStart = currentLuckPeriod?.startYear ?? profile.luckCycles.currentYear - 2;
  const annualYears = Array.from({ length: 10 }, (_, index) => annualStart + index);
  const safeFlowYear = Number.isInteger(flowYear) && flowYear >= annualStart && flowYear < annualStart + 10
    ? flowYear
    : profile.luckCycles.currentYear;
  const selectedAnnual = annualGanZhi(safeFlowYear);
  const annualElementNames = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
  const annualFlow = analyzeAnnualFlow(profile, selectedAnnual);
  return (
    <main id={`view-${view}`} className={`result-page view-${view} day-theme-${dayTheme}`}>
      <HistoryRecorder entry={{
        name: birth.name ?? "我",
        birthLabel: `${birth.calendarType === "lunar" ? "农历" : "公历"} ${birth.year}.${birth.month}.${birth.day} ${String(birth.hour).padStart(2, "0")}:${String(birth.minute ?? 0).padStart(2, "0")}`,
        ...(partnerBirth ? { partnerName: partnerBirth.name ?? "TA" } : {}),
        url: `/?${baseQuery}&view=${view}${partnerQuery}`,
      }} />
      {!embedded && <nav>
        <Link className="brand" href="/"><i>缘</i>FATE<span>°</span></Link>
        <div className="nav-links"><span>关系档案 · 已生成</span><PlotTrigger variant="link" /></div>
      </nav>}
      <nav className="profile-tabs" aria-label="分析栏目">
        <Link className={view === "overview" ? "active" : ""} href={`/?${baseQuery}&view=overview`}><span>01</span>首页排盘</Link>
        <Link className={view === "deep" ? "active" : ""} href={`/?${baseQuery}&view=deep`}><span>02</span>深度分析</Link>
        <Link className={view === "match" ? "active" : ""} href={`/?${baseQuery}&view=match`}><span>03</span>关系剧本</Link>
        <Link className={view === "square" ? "active" : ""} href={`/?${baseQuery}&view=square`}><span>04</span>同频广场</Link>
      </nav>

      <header className="result-hero">
        <div className="identity-card">
          <div className="identity-orb"><span>{profile.bazi.dayPillar[0]}</span><small>日主</small></div>
          <div><div className="section-number">你的关系身份卡 · {profile.bazi.dayPillar[0]}日主</div><h1>{profile.archetype.slice(0, 2)}<br /><em>{profile.archetype.slice(2)}</em></h1>
            <p>{birth.name ?? "我"} · {birth.calendarType === "lunar" ? "农历" : "公历"} {birth.year} 年 {birth.month} 月 {birth.day} 日 · {String(birth.hour).padStart(2, "0")}:{String(birth.minute ?? 0).padStart(2, "0")} · {birth.gender === "male" ? "男" : "女"}</p>
            <small className="calendar-conversion">公历 {profile.bazi.solarDate.slice(0, 16)} · {profile.bazi.lunarDate}</small>
          </div>
          <div className="identity-tags">{profile.identityTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </div>
        <div className="chart-heading">
          <div><div className="section-number">四柱命盘 · 按节气交接</div><h2>你的底层能量结构</h2></div>
          <div className="term-context"><span>生于 {profile.bazi.previousSolarTerm.name} 后</span><small>{profile.bazi.previousSolarTerm.at}</small><i /><span>下一个节气 · {profile.bazi.nextSolarTerm.name}</span><small>{profile.bazi.nextSolarTerm.at}</small></div>
        </div>
        <div className={`bazi-chart day-stem-${dayTheme}`}>
          {profile.bazi.pillars.map((pillar, index) => {
            const elementClass = ({ 木: "wood", 火: "fire", 土: "earth", 金: "metal", 水: "water" } as Record<string, string>)[pillar.wuXing[0]] ?? "earth";
            return <article className={`${index === 2 ? "day-master " : ""}element-${elementClass}`} key={pillar.label}>
            <header><span>{pillar.label}</span><small>{pillar.tenGod}</small></header>
            <div className="pillar-glyph"><strong>{pillar.gan}</strong><strong>{pillar.zhi}</strong></div>
            <div className="pillar-meta">
              <span className="hidden-stems"><small>藏干</small><b>{pillar.hiddenStems.map((stem) => <i key={stem}>{stem}</i>)}</b></span>
              <span><small>纳音</small>{pillar.naYin}</span>
              <span><small>十二运</small>{pillar.stage}</span>
            </div>
          </article>})}
        </div>
        <div className="overview-insights">
          <article><i>日</i><div><span>日主气质</span><h3>{profile.bazi.dayPillar[0]}日主 · {profile.archetype}</h3><p>{profile.spine.thesis}。{profile.spine.coreTension}。</p></div></article>
          <article><i>令</i><div><span>月令主轴</span><h3>{profile.bazi.pillars[1].zhi}月 · {profile.bazi.pillars[1].hiddenTenGods[0]}</h3><p>{profile.spine.monthAxis}</p></div></article>
          <article><i>缘</i><div><span>关系底色</span><h3>{profile.identityTags.join(" · ")}</h3><p>{profile.summary}</p></div></article>
        </div>
        {elementRadarPanel}
        <section className="luck-cycles">
          <header>
            <div><span>基础大运 · 按节令起运</span><h2>大运排布</h2></div>
            <div className="luck-start"><strong>{profile.luckCycles.direction}</strong><span>{profile.luckCycles.startAgeText}起运</span><small>{profile.luckCycles.startDate}</small></div>
          </header>
          <div className="luck-current">
            <i>{profile.luckCycles.currentYear}</i>
            <div><span>当前大运</span><strong>{profile.luckCycles.currentGanZhi}</strong></div>
          </div>
          <div className="luck-track" aria-label="八步大运时间轴">
            {profile.luckCycles.periods.map((period) => {
              const tone = ({ 甲: "wood", 乙: "wood", 丙: "fire", 丁: "fire", 戊: "earth", 己: "earth", 庚: "metal", 辛: "metal", 壬: "water", 癸: "water" } as Record<string, string>)[period.ganZhi[0]];
              return <article className={`${period.isCurrent ? "current " : ""}luck-${tone}`} key={`${period.ganZhi}-${period.startYear}`}>
                <div className="luck-node"><i /><span>{period.isCurrent ? "当下" : `第 0${period.index} 运`}</span></div>
                <div className="luck-glyph"><strong>{period.ganZhi[0]}</strong><strong>{period.ganZhi[1]}</strong></div>
                <div className="luck-years">{period.startYear}<i />{period.endYear}</div>
                <div className="luck-age">{period.startAge}—{period.endAge} 岁{period.verdict ? ` · ${period.verdict.label}` : ""}</div>
              </article>;
            })}
          </div>
          <section className="annual-flow" id="annual-flow">
            <header><div><span>流年索引</span><h3>选择年份，查看当年五行样式</h3></div><small>以喜忌为标尺标注补给与消耗，不作具体事件断言</small></header>
            <div className="annual-year-strip">
              {annualYears.map((year) => {
                const ganZhi = annualGanZhi(year);
                const yearSpecials = analyzeAnnualFlow(profile, ganZhi).specials;
                return <Link className={`${year === safeFlowYear ? "active " : ""}annual-${annualTone(ganZhi[0])}`} href={`/?${baseQuery}&view=overview&flowYear=${year}#annual-flow`} key={year} title={yearSpecials.map((item) => item.name).join("、")}>{yearSpecials.length > 0 && <i className="annual-flag">{yearSpecials[0].name.slice(0, 2)}</i>}<small>{year}</small><strong>{ganZhi}</strong></Link>;
              })}
            </div>
            <article className={`annual-detail annual-${annualTone(selectedAnnual[0])}`}>
              <div className="annual-seal"><small>{safeFlowYear}</small><strong>{selectedAnnual[0]}<b>{selectedAnnual[1]}</b></strong></div>
              <div><span>当年元素标记</span><h3>{selectedAnnual}流年</h3><p>流年天干{selectedAnnual[0]}为{annualFlow.stemElement}，对你的{profile.bazi.dayPillar[0]}日主属于{annualFlow.stemRole}——这一年{annualFlow.stemTheme}相关的主题更容易走到台前。{annualFlow.verdict.text}</p></div>
              <div className="annual-element-pills"><span className={`tone-${annualTone(selectedAnnual[0])}`}>天干 · {annualElementNames[annualTone(selectedAnnual[0]) as keyof typeof annualElementNames]}</span><span className={`tone-${annualTone(selectedAnnual[1])}`}>地支 · {annualElementNames[annualTone(selectedAnnual[1]) as keyof typeof annualElementNames]}</span></div>
            </article>
            {annualFlow.specials.length > 0 && <div className="annual-specials">
              {annualFlow.specials.map((item) => <article key={item.name}><b>{item.name}</b><p>{item.summary}</p></article>)}
            </div>}
            {annualFlow.interactions.length > 0 ? <div className="annual-relations">
              {annualFlow.interactions.map((item, index) => <article className={`annual-rel-${item.type}`} key={`${item.title}-${index}`}>
                <span>{item.type}</span>
                <div><h4>{item.title}</h4><p>{item.summary}</p></div>
              </article>)}
              <small>以上只标注流年与原局的结构触发点，不构成吉凶判断。</small>
            </div> : <p className="annual-relations-empty">{selectedAnnual}流年与你的四柱没有形成明显的冲、六合或半合，这一年的节奏更多由大运与现实安排决定。</p>}
          </section>
          <footer>年龄按传统排盘虚岁显示；起运时刻精确到分钟。</footer>
        </section>
        <section className="special-points">
          <header><div><span>命盘特殊点</span><h2>合、会、冲落到十神之后</h2></div><small>只提示结构张力，不单独判断吉凶</small></header>
          {profile.specialPoints.length > 0 ? <div className="special-point-list">
            {profile.specialPoints.map((point, index) => <article className={`special-${point.type}`} key={`${point.title}-${index}`}>
              <div className="special-symbol"><span>{point.type}</span><strong>{point.branches.join(" · ")}</strong></div>
              <div className="special-content"><div><small>结构强度</small><i><b style={{ width: `${point.strength}%` }} /></i></div><h3>{point.title}</h3><p>{point.summary}</p><aside>{point.relationshipImpact}</aside></div>
              <div className="special-gods">{point.tenGods.map((god, godIndex) => <span key={`${god}-${godIndex}`}>{god}</span>)}</div>
            </article>)}
          </div> : <div className="special-empty">这张命盘没有形成明显的三合、三会或六冲结构，关系倾向更多由单柱十神承担。</div>}
        </section>
      </header>

      <section className="report result-report" id="deep-report">
        {!deepActive && <>
        <div className="report-head">
          <div><h2>东方人格底层建模</h2></div>
          <div className="signature"><small>日主</small><strong>{profile.bazi.dayPillar}</strong><span>{profile.spine.strength.level === "中和" ? "中和之局 · 岁运定潮汐" : `${profile.spine.strength.level}之局 · 喜${profile.spine.favorable.join("、") || "随岁运"}`}</span></div>
        </div>

        <section className="dominant-persona">
          <div className="persona-god"><span>主轴 · {profile.dominantPersona.weight}分 · {profile.dominantBasis}</span><strong>{profile.dominantPersona.god}</strong><small>{profile.dominantPersona.name}</small></div>
          <div className={`persona-god secondary${profile.tertiaryPersona ? " dual" : ""}`}><span>{profile.tertiaryPersona ? "双副轴" : "副轴"}</span><strong>{profile.secondaryPersona.god}{profile.tertiaryPersona ? `·${profile.tertiaryPersona.god}` : ""}</strong><small>{profile.secondaryPersona.name}{profile.tertiaryPersona ? ` × ${profile.tertiaryPersona.name}` : ""}</small></div>
          <div className="persona-combined"><span>组合人格</span><h3>{profile.combinedPersona.name}</h3><p>{profile.combinedPersona.summary}</p></div>
          <div><span>行为特征</span><p>{profile.dominantPersona.behavior}；同时带有{profile.secondaryPersona.behavior}的副轴倾向。</p></div>
          <div><span>关系表现</span><p>{profile.dominantPersona.relationship}；副轴表现为{profile.secondaryPersona.relationship}。</p></div>
        </section>
        <section className="deep-radar-overview">
          <div>
            <span>十二维人格图谱</span><h3>一张图，看见你的关系轮廓</h3><p>分数越靠近外圈，代表该倾向在关系中越容易被观察到。</p>
            {/* 2026-07-05:雷达穿紫微星海制式(圆环细金格+四域彩点),与落地页同语言 */}
            <div className="deep-radar-legend">
              {Object.entries(dimCatColor).map(([cat, color]) => <span key={cat}><i style={{ background: color }} />{cat}</span>)}
            </div>
          </div>
          {/* 2026-07-05 终稿:恢复圆形雷达(折线/星盘均毙),原结构+星海配色 */}
          <div className="deep-radar-chart">
            <svg viewBox="0 0 320 320" role="img" aria-label="十二维人格图谱">
              <defs>
                <linearGradient id="zwxRadarFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e8ce9a" /><stop offset=".5" stopColor="#a98fd6" /><stop offset="1" stopColor="#7fa9d9" /></linearGradient>
                <filter id="zwxRadarGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              {[112, 84, 56, 28].map((radius) => <polygon key={radius} points={deepGrid(radius)} className="radar-grid-line" />)}
              {profile.deepAnalysis.map((_, index) => { const [x, y] = polygonPoint(index, 12, 112).split(","); return <line key={index} x1="160" y1="160" x2={x} y2={y} />; })}
              <polygon points={deepValues} className="radar-value" />
              {profile.deepAnalysis.map((item, index) => { const [x, y] = polygonPoint(index, 12, 112 * item.score / 100).split(","); return <circle key={item.key} cx={x} cy={y} r="3.6" style={{ fill: dimCatColor[item.category] ?? "#e8ce9a" }} />; })}
            </svg>
            {profile.deepAnalysis.map((item, index) => {
              const angle = -Math.PI / 2 + index * Math.PI * 2 / 12;
              return <span key={item.key} style={{ left: `${50 + Math.cos(angle) * 40}%`, top: `${50 + Math.sin(angle) * 40}%` }}>{item.label}<b>{item.score}</b></span>;
            })}
          </div>
        </section>
        <section className="fate-book fate-book-intro">
          <span className="fb-mono">FATE° · 深度解读报告</span>
          <h3>四章，读懂你自己。</h3>
          <div className="fb-toc-preview">
            <span className="fb-c-love"><b>壹</b>感情</span>
            <span className="fb-c-career"><b>贰</b>事业</span>
            <span className="fb-c-social"><b>叁</b>人际</span>
            <span className="fb-c-season"><b>肆</b>时运</span>
          </div>
          <p>感情、事业、人际、时运各一章——你的标签、数据表征、与一段只属于你的评述与建议。生成一次，永久可看，可分享。</p>
          <Link className="fb-cta" href={`/report?${baseQuery}`}>打开我的深度解读 ↗</Link>
          <div className="fb-note">报告内容基于 FATE 模型 2.0 得出。</div>
        </section>
        <div className="module-directory">
          <header><div><span>DEEP CHAPTERS</span><h3>深度目录 · {["零","一","二","三","四","五","六","七","八","九"][deepModules.length]}章</h3></div><small>四类关系维度 + 专项观察 · 逐章展开</small></header>
          <div className="module-grid">
            {deepModules.map((item, index) => <Link key={item.key} href={`/?${baseQuery}&view=deep&module=${item.key}#deep-report`}>
              <i>{item.no}</i>
              <div><span>0{index + 1} · {item.subtitle}</span><h4>{item.title}</h4><p>{item.teaser}</p></div>
              <b>→</b>
            </Link>)}
          </div>
        </div>
        </>}
        {deepActive && <div className="module-frame">
          <div className="module-topbar">
            <Link href={`/?${baseQuery}&view=deep#deep-report`}>← 返回深度目录</Link>
            <span>{profile.archetype} · {profile.combinedPersona.name}</span>
          </div>
          <header className="module-header">
            <i>{deepActive.no}</i>
            <div><span>第 {deepActiveIndex + 1} 章 / 共 {deepModules.length} 章</span><h2>{deepActive.title}</h2><p>{deepActive.subtitle}</p></div>
          </header>
        {deepActive.key !== "special" && <div className="deep-profile">
          <div className="deep-category-stack">
            {deepCategories.filter((group) => group.category === deepActive.category).map((group) => { const categoryIndex = deepCategories.findIndex((candidate) => candidate.category === group.category); return <section className="deep-category" key={group.category}>
              <header><div><span>0{categoryIndex + 1}</span><h3>{group.category}</h3></div><p>{group.subtitle}</p></header>
              <div className="deep-card-grid">
                {group.items.map((item) => {
                  const index = profile.deepAnalysis.findIndex((candidate) => candidate.key === item.key);
                  const band = bandFor(item.score);
                  return <article id={`deep-card-${item.key}`} className={`deep-card deep-tone-${categoryIndex}`} key={item.key}>
                    <header>
                      <div><small>{String(index + 1).padStart(2, "0")} · {item.category}</small><h4>{item.label}</h4><b className="deep-descriptor">{item.descriptor}</b></div>
                      <div className="deep-score"><strong>{item.score}</strong><span>{item.level}</span></div>
                    </header>
                    <div className="deep-keywords">{item.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
                    <div className="deep-factor-tags">{factorTagsFor(item.key).map((factor) => <span className={`factor-${factor.tone}`} key={`${factor.label}-${factor.tone}`}><i style={{ "--factor": `${factor.value}%` } as CSSProperties} /><b>{factor.label}</b><small>{factor.value}%</small></span>)}</div>
                    <p className="deep-summary">{item.summary}</p>
                    <div className="tendency-axis" aria-label={`${item.label}分段数轴，命主位于${item.score}分`}>
                      <div className="axis-labels"><span>弱 0—27</span><span>偏低 28—44</span><span>中段 45—64</span><span>偏高 65—81</span><span>强 82—100</span></div>
                      <div className="axis-track"><i style={{ left: `${item.score}%` }} /></div>
                      <p><strong>{band.label}</strong>{band.detail}</p>
                    </div>
                    <div className="deep-scene-preview">
                      {item.sceneInsights.slice(0, 2).map((scene) => <div key={scene.scene}><b>{scene.scene}</b><span>{scene.title}</span></div>)}
                    </div>
                    <p className="deep-note">{item.note}</p>
                    <Link className="logic-link" href={`/?${baseQuery}&view=deep${moduleQuery}&detail=${item.key}#deep-card-${item.key}`}>查看量化依据与三类场景 <span>→</span></Link>
                  </article>;
                })}
              </div>
            </section>; })}
          </div>
        </div>}
        {deepActive.key === "special" && <section className="specialty-analysis">
          <header>
            <div><span>命盘专项观察</span><h3>神煞与十神的延伸维度</h3></div>
            <p>在核心人格维度之外，结合偏印、华盖、十灵日、桃花支及关系结构，观察直觉感知、情感经营、吸引表达与创作倾向。各项仅作为综合权重，不以单一结构作结论。</p>
          </header>
          <div className="specialty-grid">
            {profile.specialtyAnalysis.map((item, index) => {
              const band = bandFor(item.score);
              return <article className={`specialty-card specialty-tone-${index}`} key={item.key}>
                <header><div><small>0{index + 1} / SPECIAL TEST</small><h4>{item.label}</h4><b>{item.descriptor}</b></div><strong>{item.score}<span>{item.level}</span></strong></header>
                <p>{item.summary}</p>
                <div className="tendency-axis" aria-label={`${item.label}分段数轴，命主位于${item.score}分`}>
                  <div className="axis-labels"><span>弱 0—27</span><span>偏低 28—44</span><span>中段 45—64</span><span>偏高 65—81</span><span>强 82—100</span></div>
                  <div className="axis-track"><i style={{ left: `${item.score}%` }} /></div>
                  <p><strong>{band.label}</strong>{band.detail}</p>
                </div>
                <div className="specialty-evidence">{item.evidence.map((evidence) => <span key={evidence}>{evidence}</span>)}</div>
                <small className="specialty-caution">{item.caution}</small>
              </article>;
            })}
          </div>
        </section>}
        {deepActive.key === "social" && <section className="specialty-analysis">
          <header>
            <div><span>社交行为模式</span><h3>你通常如何建立并维持连接</h3></div>
            <p>由人格分布与关系倾向综合推导：四个维度分别对应联系频率、分歧处理、关系推进与安全感来源，描述的是更常出现的互动方式而非固定人设。</p>
          </header>
          <div className="social-model-grid social-chapter-grid">
            {socialModelItems.map((item) => {
              const socialBasis = {
                communication: `判定依据：食伤权重 ${profile.tenGodAnalysis[4].count}（表达输出）· 外向表达 ${profile.personality.extroversion} · 情感依赖 ${profile.deepAnalysis.find((d) => d.key === "dependency")?.score}`,
                conflict: `判定依据：情绪稳定 ${profile.personality.stability} · 压力韧性 ${profile.deepAnalysis.find((d) => d.key === "resilience")?.score} · 官杀权重 ${profile.tenGodAnalysis[0].count}`,
                pace: `判定依据：信任建立速度 ${profile.deepAnalysis.find((d) => d.key === "trust_speed")?.score} · 社交开放度 ${profile.deepAnalysis.find((d) => d.key === "social_openness")?.score} · 关系警觉 ${profile.deepAnalysis.find((d) => d.key === "vigilance")?.score}`,
                attachment: `判定依据：情感依赖 ${profile.deepAnalysis.find((d) => d.key === "dependency")?.score} · 自主空间 ${profile.deepAnalysis.find((d) => d.key === "autonomy")?.score} · 情感强度 ${profile.personality.emotion}`,
              }[item.key];
              return <article key={item.key}>
                <header><i>{item.symbol}</i><div><span>{item.label}</span><strong>{item.value}</strong></div></header>
                <div className="social-spectrum">{item.options.map((option, optionIndex) => <span className={optionIndex === item.active ? "active" : ""} key={option}>{option}</span>)}</div>
                <p>{item.description}</p>
                <small className="social-basis">{socialBasis}</small>
              </article>;
            })}
          </div>
          <blockquote className="social-chapter-quote">“{profile.summary}”</blockquote>
        </section>}
        <nav className="module-pager">
          {deepActiveIndex > 0
            ? <Link href={`/?${baseQuery}&view=deep&module=${deepModules[deepActiveIndex - 1].key}#deep-report`}>← {deepModules[deepActiveIndex - 1].no} · {deepModules[deepActiveIndex - 1].title}</Link>
            : <Link href={`/?${baseQuery}&view=deep#deep-report`}>← 深度目录</Link>}
          <Link className="pager-home" href={`/?${baseQuery}&view=deep#deep-report`}>目录</Link>
          {deepActiveIndex < deepModules.length - 1
            ? <Link href={`/?${baseQuery}&view=deep&module=${deepModules[deepActiveIndex + 1].key}#deep-report`}>{deepModules[deepActiveIndex + 1].no} · {deepModules[deepActiveIndex + 1].title} →</Link>
            : <Link href={`/?${baseQuery}&view=deep#deep-report`}>返回目录 →</Link>}
        </nav>
        </div>}
        {!deepActive && <div className="persona-signature">
          <div className="signature-keywords">
            {profile.deepAnalysis.slice().sort((x, y) => y.score - x.score).slice(0, 6).map((item) => <span key={item.key}><b>{item.keywords[0]}</b><small>{item.label} {item.score}</small></span>)}
          </div>
        </div>}
      </section>

      {view === "square" && !squareEnabled && <section className="feature-locked">
        <i>◌</i>
        <div className="section-number">COMING SOON</div>
        <h2>同频广场，<br />还在打磨。</h2>
        <p>该功能还未开放。广场将汇聚同频人的动态与话题——开放之前，先看看你的命盘与合盘。</p>
        <Link href={`/?${baseQuery}&view=overview`}>← 返回排盘</Link>
      </section>}
      {squareEnabled && <section className="social-square">
        <div className="square-main">
          <header className="square-header">
            <div><span>FATE SQUARE</span><h2>同频广场</h2><p>分享此刻，也遇见生活节奏相近的人。</p></div>
            <button aria-label="发布动态">＋</button>
          </header>
          <div className="story-row">
            {[
              ["＋", "发布此刻", "story-me"], ["林", "林知遥", "story-wood"],
              ["弥", "陈弥", "story-fire"], ["屿", "周屿", "story-water"], ["安", "安禾", "story-earth"],
            ].map(([avatar, name, tone]) => <div className="story" key={name}><i className={tone}>{avatar}</i><span>{name}</span></div>)}
          </div>
          <div className="topic-scroll"><span className="active">为你推荐</span><span># 今日生活切片</span><span># 城市散步</span><span># 最近在读</span></div>

          <div className="feed">
            <article className="post-card">
              <header><div className="post-avatar avatar-lin">林</div><div><strong>林知遥</strong><span>木系慢热连接者 · 12分钟前</span></div><button>关注</button></header>
              <p>天气刚好，和认识很多年的朋友坐到天黑。长大以后，能安静待在一起的人反而最珍贵。</p>
              <img src="/images/square-lakeside.png" alt="两位朋友在城市湖边看日落" />
              <div className="post-tags"><span># 城市散步</span><span># 朋友是选择的家人</span></div>
              <footer><button>♡ <span>128</span></button><button>◯ <span>23</span></button><button>↗</button><small>与你的生活同频度 86%</small></footer>
            </article>
            <article className="post-card text-post">
              <header><div className="post-avatar avatar-mi">弥</div><div><strong>陈弥</strong><span>火系真诚表达者 · 38分钟前</span></div><button>关注</button></header>
              <div className="quote-life"><small>今日生活切片</small><strong>“真正舒服的关系，<br />应该允许两个人偶尔没有话说。”</strong></div>
              <p>以前总觉得热闹才算亲近，现在更喜欢不需要证明什么的陪伴。</p>
              <footer><button>♡ <span>76</span></button><button>◯ <span>11</span></button><button>↗</button><small>食神表达与你同频</small></footer>
            </article>
            <article className="post-card mini-post">
              <header><div className="post-avatar avatar-yu">屿</div><div><strong>周屿</strong><span>水系深度理解者 · 1小时前</span></div><button>关注</button></header>
              <p>最近循环的一首歌，适合夜晚一个人走很长的路。你们最近在听什么？</p>
              <div className="music-card"><i>♫</i><div><strong>晚风经过</strong><span>城市夜行歌单 · 03:42</span></div><b>▶</b></div>
              <footer><button>♡ <span>52</span></button><button>◯ <span>19</span></button><button>↗</button><small>来自同城 · 3.2km</small></footer>
            </article>
          </div>
        </div>
        <aside className="square-aside">
          <div className="daily-card"><span>今日关系气象</span><strong>适合主动<br />发出邀请</strong><p>你的表达能量比过去一周更松弛。</p></div>
          <div className="hot-topics"><h3>正在发生</h3><div><b>01</b><span># 朋友是选择的家人<small>1.8k 人参与</small></span></div><div><b>02</b><span># 城市散步地图<small>936 人参与</small></span></div><div><b>03</b><span># 独处充电时刻<small>728 人参与</small></span></div></div>
        </aside>
      </section>}

      <section className="match-workspace">
        <div className="match-intro">
          <div><span>RELATIONSHIP SCRIPT</span><h2>关系剧本<br />看你们会怎么发展。</h2></div>
          <p>输入对方出生时间，并选择真实关系场景。系统会同时读取双方十神、五行、情绪稳定与依恋节奏。</p>
        </div>
        <InviteShare query={`inviteYear=${birth.year}&inviteMonth=${birth.month}&inviteDay=${birth.day}&inviteHour=${birth.hour}&inviteMinute=${birth.minute ?? 0}&inviteName=${encodeURIComponent(birth.name ?? "我")}&inviteGender=${birth.gender ?? "female"}&inviteCalendarType=${birth.calendarType ?? "solar"}&inviteIsLeapMonth=${birth.isLeapMonth ? "true" : "false"}&relationType=${encodeURIComponent(relationType)}`} />
        <form className="partner-form" action="/" method="get">
          <input type="hidden" name="year" value={birth.year} />
          <input type="hidden" name="month" value={birth.month} />
          <input type="hidden" name="day" value={birth.day} />
          <input type="hidden" name="hour" value={birth.hour} />
          <input type="hidden" name="minute" value={birth.minute ?? 0} />
          <input type="hidden" name="name" value={birth.name ?? "我"} />
          <input type="hidden" name="gender" value={birth.gender ?? "female"} />
          <input type="hidden" name="calendarType" value={birth.calendarType ?? "solar"} />
          <input type="hidden" name="isLeapMonth" value={birth.isLeapMonth ? "true" : "false"} />
          <input type="hidden" name="view" value="match" />
          <label><span>对方昵称</span><input name="partnerName" type="text" defaultValue={partnerBirth?.name ?? "TA"} required /></label>
          <label><span>对方出生年份</span><input name="partnerYear" type="number" min="1900" max="2100" defaultValue={partnerBirth?.year ?? 2001} required /></label>
          <label><span>月份</span><input name="partnerMonth" type="number" min="1" max="12" defaultValue={partnerBirth?.month ?? 6} required /></label>
          <label><span>日期</span><input name="partnerDay" type="number" min="1" max="31" defaultValue={partnerBirth?.day ?? 18} required /></label>
          <label><span>时辰</span><input name="partnerHour" type="number" min="0" max="23" defaultValue={partnerBirth?.hour ?? 10} required /></label>
          <label><span>分钟</span><input name="partnerMinute" type="number" min="0" max="59" defaultValue={partnerBirth?.minute ?? 0} required /></label>
          <label className="relation-select"><span>日期类型</span><select name="partnerCalendarType" defaultValue={partnerBirth?.calendarType ?? "solar"}><option value="solar">公历</option><option value="lunar">农历</option></select></label>
          <label className="relation-select"><span>对方性别</span><select name="partnerGender" defaultValue={partnerBirth?.gender ?? "male"}><option value="female">女</option><option value="male">男</option></select></label>
          <label className="leap-check"><span>农历闰月</span><span><input type="checkbox" name="partnerIsLeapMonth" value="true" defaultChecked={partnerBirth?.isLeapMonth ?? false} />仅农历闰月时勾选</span></label>
          <label className="relation-select"><span>你们的关系</span><select name="relationType" defaultValue={relationType}><option>恋爱</option><option>朋友</option><option>同事</option><option>家人</option></select></label>
          <button type="submit">生成双人互动分析 <span>→</span></button>
        </form>

        {relationship && partnerProfile && (() => {
          const userNameSafe = birth.name ?? "我";
          const partnerNameSafe = partnerBirth?.name ?? "TA";
          const moduleBase = `/?${baseQuery}&view=match${partnerQuery}`;
          const dscore = (target: typeof profile, key: string) => target.deepAnalysis.find((item) => item.key === key)?.score ?? 50;
          const bestDim = relationship.scoreBreakdown.slice().sort((x, y) => y.score - x.score)[0];
          const duoRhythm = analyzeDuoRhythm(profile, partnerProfile, relationType, new Date().getFullYear(), 5);
          const moduleMeta = [
            { key: "dimensions", no: "壹", title: "关系总览", subtitle: "总分、六维与剧本", teaser: relationship.spine.thesis },
            { key: "nature", no: "贰", title: "两人底色", subtitle: "使用说明书与最不一样的三处", teaser: `${userNameSafe}与${partnerNameSafe}，各一份说明书` },
            { key: "structure", no: "叁", title: "八字化学反应", subtitle: "两张命盘如何咬合", teaser: relationship.branchDynamics[0]?.title ?? "无强合冲，互动由行为层主导" },
            { key: "manner", no: "肆", title: "相处样态", subtitle: "日常里的你们：谁主动、谁吃醋", teaser: relationship.guide.behaviors[1]?.conclusion ?? relationship.guide.behaviors[0].conclusion },
            { key: "reef", no: "伍", title: "摩擦与化解", subtitle: "最容易起分歧的具体情景", teaser: relationship.guide.hotspots[0].scene },
            { key: "rhythm", no: "陆", title: "未来五年", subtitle: "逐年倾向、结构信号与排期", teaser: `${duoRhythm[0].year} ${duoRhythm[0].ganZhi} · ${duoRhythm[0].tendencies[0] ? `${duoRhythm[0].tendencies[0].label}倾向` : "无强倾向"}` },
            { key: "summary", no: "柒", title: "总结与要点", subtitle: "判词回顾与全景收束", teaser: `判词：${relationship.guide.verdict.title}` },
          ];
          const activeIndex = moduleMeta.findIndex((item) => item.key === moduleKey);
          const active = activeIndex >= 0 ? moduleMeta[activeIndex] : null;
          const attachLabel = (target: typeof profile) => ({ secure: "偏安全型", anxious: "偏焦虑型", avoidant: "偏回避型" } as const)[target.socialProfile.attachment_style];
          const personalityRows = [["外向表达", "extroversion"], ["情绪稳定", "stability"], ["边界控制", "control"], ["情感感知", "emotion"]] as const;
          const contrastRows: [string, number, number][] = [
            ["关系主动", profile.traitAnalysis[6].score, partnerProfile.traitAnalysis[6].score],
            ["关系警觉", dscore(profile, "vigilance"), dscore(partnerProfile, "vigilance")],
            ["情感依赖", dscore(profile, "dependency"), dscore(partnerProfile, "dependency")],
            ["空间需求", dscore(profile, "autonomy"), dscore(partnerProfile, "autonomy")],
            ["冲突表达", dscore(profile, "conflict_expression"), dscore(partnerProfile, "conflict_expression")],
            ["情绪稳定", profile.personality.stability, partnerProfile.personality.stability],
          ];
          const seedOf = (text: string) => { let hash = 0; for (let index = 0; index < text.length; index++) hash = (hash * 31 + text.charCodeAt(index)) | 0; return Math.abs(hash); };
          const today = new Date();
          const monthTag = `${today.getFullYear()}年${today.getMonth() + 1}月`;
          const flowMonth = monthGanZhi(today.getFullYear(), today.getMonth() + 1, today.getDate());
          const monthElement = annualTone(flowMonth[0]) as keyof typeof elementLabels;
          const weakestElement = (Object.keys(elementLabels) as (keyof typeof elementLabels)[])
            .reduce((weakest, key) => (profile.bazi.elements[key] + partnerProfile.bazi.elements[key]) < (profile.bazi.elements[weakest] + partnerProfile.bazi.elements[weakest]) ? key : weakest, "wood" as keyof typeof elementLabels);
          const ideaPool: { title: string; note: string; element: keyof typeof elementLabels }[] = [
            { element: "earth", title: "老地方，新菜单", note: "回到你们最熟的馆子，只点没吃过的菜——在稳定里放一点新意，两种结构都舒服。" },
            { element: "wood", title: "交换歌单散步", note: "各备十首歌，边走边轮流放。低成本的共享体验，比问一百句「在干嘛」更能同频。" },
            { element: "wood", title: "二手书店寻宝", note: "给对方挑一本「你觉得TA会喜欢的书」。挑中与否都是话题，这是一次公开的共情测验。" },
            { element: "fire", title: "随机终点站", note: "坐一条没坐过的公交或地铁到终点再回来。把探索欲放进一个有边界的容器里。" },
            { element: "fire", title: "厨房协作局", note: "一人主厨一人副手，下次互换。主导权协商的低风险演练场，锅铲比言语诚实。" },
            { element: "water", title: "沉默观影会", note: "看完先不讨论，各写三行观后感再交换。表达译码的专项训练，慢表达者的主场。" },
            { element: "metal", title: "三张「我眼里的你」", note: "各给对方拍三张照片。被看见，是所有依恋结构共同的底层需求。" },
            { element: "earth", title: "五十元早市挑战", note: "赶一次早市，预算五十，各买三样。现实协作里藏着最真实的分工默契。" },
            { element: "water", title: "不带手机的一小时", note: "天台、湖边，或任何安静的地方，只是坐着。检验你们的沉默是舒适还是尴尬。" },
            { element: "metal", title: "三个月后拆的信", note: "各写一封给三个月后对方的短信封存。承诺与期待，都需要一个具体的容器。" },
            { element: "wood", title: "互授小技能", note: "各教对方一件自己擅长的小事。比劫结构最吃这一套：平等交换，而非单方给予。" },
            { element: "water", title: "旧照片故事会", note: "各带五张老照片讲背后的事。信任建立的加速器，慢热结构也乐意开口。" },
          ];
          const topicPool = [
            "你小时候最得意的一件事是什么",
            "如果明天不用上班，你的一天怎么过",
            "你觉得我们最像的一点和最不像的一点",
            "最近一次觉得被理解，是什么时候",
            "理想中的假期，是躺着的还是跑着的",
            "有什么一直想试、但没人陪的事",
          ];
          const inspireSeed = seedOf(`${profile.id}|${partnerProfile.id}|${flowMonth}|${monthTag}`);
          // 三签分工：当令签顺流月之气，补益签补两盘之弱，机缘签由印记抽出——避免同属性扎堆
          const pickIdea = (element: keyof typeof elementLabels, offset: number, exclude: string[]) => {
            const pool = ideaPool.filter((idea) => idea.element === element && !exclude.includes(idea.title));
            const fallback = ideaPool.filter((idea) => !exclude.includes(idea.title));
            const source = pool.length ? pool : fallback;
            return source[(inspireSeed + offset) % source.length];
          };
          const seasonSign = pickIdea(monthElement, 1, []);
          const remedySign = pickIdea(weakestElement, 3, [seasonSign.title]);
          const wildcardPool = ideaPool.filter((idea) => ![seasonSign.title, remedySign.title].includes(idea.title));
          const wildcardSign = wildcardPool[(inspireSeed + 5) % wildcardPool.length];
          const inspirations = [
            { ...seasonSign, role: "当令签", why: `流月${flowMonth}天干属${elementLabels[monthElement]}，取${elementLabels[seasonSign.element]}性之事顺势` },
            { ...remedySign, role: "补益签", why: `两盘合计最弱为${elementLabels[weakestElement]}，取${elementLabels[remedySign.element]}性之事补气` },
            { ...wildcardSign, role: "机缘签", why: `由两盘印记与当月月份共同抽出` },
          ];
          const inspireTopics = Array.from({ length: 2 }, (_, index) => topicPool[(inspireSeed + index * 5) % topicPool.length]);
          return (
          <div className="relationship-result" id="match-report">
          {!active && <>
          <div className="match-hero">
            <div className="match-hero-score">
              <div className="duo-avatars"><i>{profile.bazi.dayPillar[0]}</i><i>{partnerProfile.bazi.dayPillar[0]}</i></div>
              <span>双人关系报告</span>
              <strong>{relationship.relationType}</strong>
            </div>
            <div className="match-hero-verdict">
              <small>关系判词</small>
              <h3>{relationship.guide.verdict.title}</h3>
              <p className="verdict-quip">{relationship.guide.verdict.quip}</p>
              <p>{relationship.guide.verdict.tagline}</p>
              <small className="hero-basis">判据：{relationship.guide.verdict.basis}</small>
              <PairBars metrics={relationship.guide.verdict.metrics} aName={userNameSafe} bName={partnerNameSafe} />
            </div>
          </div>
          <div className="match-keypoints">
            <article><i>合</i><div><span>最合的地方</span><h4>{bestDim.label} · {bestDim.score} 分</h4><p>{bestDim.summary}</p></div></article>
            <article><i>磨</i><div><span>最要留意</span><h4>{relationship.guide.hotspots[0].scene}</h4><p>{relationship.guide.hotspots[0].playbook}</p></div></article>
            <article><i>先</i><div><span>破局之人</span><h4>先动的人：{relationship.guide.initiator.name}</h4><p>{relationship.guide.initiator.firstMove}</p></div></article>
          </div>
          <section className="fate-book fate-book-intro">
            <span className="fb-mono">FATE° · 双人深度解读报告</span>
            <h3>五章，读懂你们。</h3>
            <div className="fb-toc-preview">
              <span className="fb-c-origin"><b>壹</b>缘起</span>
              <span className="fb-c-daily"><b>贰</b>相处</span>
              <span className="fb-c-friction"><b>叁</b>摩擦</span>
              <span className="fb-c-longrun"><b>肆</b>长线</span>
              <span className="fb-c-season"><b>伍</b>时运</span>
            </div>
            <p>缘起、相处、摩擦、长线、时运各一章——你们的双人标签、对比图表、与只属于你们的评述与建议。生成一次，永久可看，可分享。</p>
            <Link className="fb-cta" href={`/report/duo?${baseQuery}${partnerQuery}`}>打开你们的深度解读 ↗</Link>
            <div className="fb-note">报告内容基于 FATE 模型 2.0 得出。</div>
          </section>
          <div className="module-directory">
            <header><div><span>REPORT CHAPTERS</span><h3>报告目录 · {["零","一","二","三","四","五","六","七","八","九"][moduleMeta.length]}章</h3></div><small>逐章展开，每一章都可单独转发</small></header>
            <div className="module-grid">
              {moduleMeta.map((item, index) => <Link key={item.key} href={`${moduleBase}&module=${item.key}#match-report`}>
                <i>{item.no}</i>
                <div><span>0{index + 1} · {item.subtitle}</span><h4>{item.title}</h4><p>{item.teaser}</p></div>
                <b>→</b>
              </Link>)}
            </div>
          </div>
          <section className="match-inspire">
            <header><div><span>流月 {flowMonth} · {elementLabels[monthElement]}气当令</span><h3>缘分签 · 本月相处灵感</h3></div><small>{monthTag} · 随流月更换</small></header>
            <p className="inspire-logic">选签逻辑：每件小事按气质归入五行——交换与学习属木、外出与热闹属火、务实与日常属土、承诺与定格属金、安静与沉浸属水。三签分工：当令签顺流月{flowMonth}之{elementLabels[monthElement]}气，补益签补你们两盘合计最弱的{elementLabels[weakestElement]}气，机缘签由两盘印记抽出——三签属性不重复。</p>
            <div className="inspire-grid">
              {inspirations.map((idea) => <article key={idea.title}><i>{idea.role.slice(0, 1)}</i><div><h4>{idea.title}<em className={`inspire-el el-${idea.element}`}>{elementLabels[idea.element]}性</em></h4><p>{idea.note}</p><small className="inspire-why">{idea.role} · {idea.why}</small></div></article>)}
            </div>
            <div className="inspire-topics"><b>开场话题</b>{inspireTopics.map((topic) => <span key={topic}>{topic}</span>)}</div>
          </section>
          <ShareCard
            userName={userNameSafe}
            partnerName={partnerNameSafe}
            userPillar={profile.bazi.dayPillar}
            partnerPillar={partnerProfile.bazi.dayPillar}
            score={relationship.score}
            headline={relationship.headline}
            relationType={relationship.relationType}
            verdictTitle={relationship.guide.verdict.title}
            verdictQuip={relationship.guide.verdict.quip}
            chapters={moduleMeta.map((item) => `${item.no}·${item.title}`)}
            highlights={relationship.scoreBreakdown.slice().sort((x, y) => y.score - x.score).slice(0, 3).map((item) => ({ label: item.label, score: item.score }))}
          />
          </>}
          {active && <div className="module-frame">
            <div className="module-topbar">
              <Link href={`${moduleBase}#match-report`}>← 返回报告目录</Link>
              <span>{relationship.guide.verdict.title} · 总分 {relationship.score} · {relationship.relationType}</span>
            </div>
            <header className="module-header">
              <i>{active.no}</i>
              <div><span>第 {activeIndex + 1} 章 / 共 {moduleMeta.length} 章</span><h2>{active.title}</h2><p>{active.subtitle}</p></div>
            </header>
            {active.key === "dimensions" && <>
            <section className="duo-radar-panel">
              <header><div><span>双人六维关系图</span><h3>你们在哪些地方相似，哪里互补</h3></div><div className="duo-legend"><i />你 <b />对方</div></header>
              <div className="duo-radar-chart">
                <svg viewBox="0 0 320 320" role="img" aria-label="双方六维重叠关系图">
                  <defs>
                    <linearGradient id="duoMineFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#62e0b4" /><stop offset="1" stopColor="#6da6df" /></linearGradient>
                    <linearGradient id="duoTheirsFill" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4a0b5" /><stop offset="1" stopColor="#d98abf" /></linearGradient>
                  </defs>
                  {[112, 84, 56, 28].map((radius) => <polygon key={radius} points={duoGrid(radius)} className="radar-grid-line" />)}
                  {duoDimensions.map((_, index) => { const [x, y] = polygonPoint(index, 6, 112).split(","); return <line key={index} x1="160" y1="160" x2={x} y2={y} />; })}
                  <polygon points={duoMine} className="duo-mine" />
                  <polygon points={duoTheirs} className="duo-theirs" />
                  {duoDimensions.flatMap((item, index) => {
                    const [mineX, mineY] = polygonPoint(index, 6, duoRadius(item[1])).split(",");
                    const [theirX, theirY] = polygonPoint(index, 6, duoRadius(item[2])).split(",");
                    return [<circle key={`${item[0]}-mine`} className="duo-dot-mine" cx={mineX} cy={mineY} r="4" />, <circle key={`${item[0]}-theirs`} className="duo-dot-theirs" cx={theirX} cy={theirY} r="4" />];
                  })}
                </svg>
                {duoDimensions.map(([label, mine, theirs], index) => {
                  const angle = -Math.PI / 2 + index * Math.PI * 2 / 6;
                  return <span key={label} style={{ left: `${50 + Math.cos(angle) * 39}%`, top: `${50 + Math.sin(angle) * 39}%` }}>{label}<b>{mine} · {theirs}</b></span>;
                })}
              </div>
            </section>
            <section className="match-score-method">
              <header><div><span>和谐分 × 关系剧本</span><h3>六个维度：分数、剧本与建议</h3></div><small>六项场景加权 · 合冲克进入对应分项</small></header>
              <p className="score-method-intro">{relationship.scoreSummary}</p>
              <div className="dimension-grid">
                {([
                  ["expression", "communication"], ["attraction", "pace"], ["emotional", "attachment"],
                  ["power", "conflict"], ["daily", "initiative"], ["repair", "repair"],
                ] as const).map(([scoreKey, cardKey], index) => {
                  const scoreItem = relationship.scoreBreakdown.find((item) => item.key === scoreKey);
                  const cardItem = relationship.cards.find((item) => item.key === cardKey);
                  if (!scoreItem || !cardItem) return null;
                  return <article id={`match-card-${cardItem.key}`} key={cardItem.key}>
                    <div className="dimension-head">
                      <div><small>0{index + 1} · {scoreItem.label}</small><h4>{cardItem.label}</h4></div>
                      <strong>{scoreItem.score}</strong>
                    </div>
                    <i className="dimension-bar"><b style={{ width: `${scoreItem.score}%` }} /></i>
                    <p>{scoreItem.summary}</p>
                    <small className="dim-formula">构成：{DIM_FORMULA[scoreItem.key] ?? ""}</small>
                    <Link className="logic-link" href={`${moduleBase}&module=dimensions&detail=${cardItem.key}#match-card-${cardItem.key}`}>查看双方推理 <span>→</span></Link>
                  </article>;
                })}
              </div>
            </section>
            </>}
            {active.key === "structure" && <>
            <section className="duo-bazi-comparison">
              <header>
                <div><span>双人四柱命盘</span><h3>先看清两个人，再谈这段关系</h3></div>
                <small>双方均按节气交接排盘 · 合盘不展示大运</small>
              </header>
              <div className="duo-bazi-grid">
                {[
                  { person: profile, name: userNameSafe, tone: "mine" },
                  { person: partnerProfile, name: partnerNameSafe, tone: "theirs" },
                ].map(({ person, name, tone }) => <article className={`compact-chart ${tone}`} key={tone}>
                  <div className="compact-person"><i>{person.bazi.dayPillar[0]}</i><div><strong>{name}</strong><span>{person.bazi.dayPillar}日柱 · {person.dominantPersona.god}主轴</span></div></div>
                  <div className="compact-pillars">
                    {person.bazi.pillars.map((pillar, pillarIndex) => <div className={pillarIndex === 2 ? "compact-day" : ""} key={pillar.label}>
                      <span>{pillar.label}<small>{pillar.tenGod}</small></span>
                      <strong>{pillar.gan}<b>{pillar.zhi}</b></strong>
                      <p><small>藏干</small>{pillar.hiddenStems.join(" · ")}</p>
                      <p><small>支神</small>{pillar.hiddenTenGods.join(" · ")}</p>
                    </div>)}
                  </div>
                </article>)}
              </div>
            </section>
            <section className="match-score-method">
              <header><div><span>结构连线</span><h3>合、冲、相制，各落在哪一柱</h3></div><small>冲＝红 · 六合＝绿 · 三合三会＝蓝 · 相制＝金（虚线）</small></header>
              <PillarLinks user={profile} partner={partnerProfile} userName={userNameSafe} partnerName={partnerNameSafe} dynamics={relationship.branchDynamics} />
            </section>
            <section className="duo-branch-script">
              <header><div><span>合盘特殊结构</span><h3>两张命盘放在一起，新发生了什么</h3></div><small>六合 · 六冲 · 三合 · 三会 · 天干相制</small></header>
              {relationship.branchDynamics.length ? <div>
                {relationship.branchDynamics.map((dynamic, index) => <article key={`${dynamic.title}-${index}`} className={`duo-dynamic-${dynamic.type}`}>
                  <div className="dynamic-mark"><span>{dynamic.type}</span><strong>{dynamic.branches.join(" · ")}</strong></div>
                  <div className="dynamic-body">
                    <h4>{dynamic.title}</h4>
                    <div className="dynamic-roles"><span>{userNameSafe} · {dynamic.userRole}</span><i>×</i><span>{partnerNameSafe} · {dynamic.partnerRole}</span></div>
                    <div className="dynamic-source"><span>{userNameSafe}：{dynamic.userPillars.join("、")}</span><span>{partnerNameSafe}：{dynamic.partnerPillars.join("、")}</span><b className={dynamic.scoreImpact > 0 ? "impact-pos" : "impact-neg"}>{dynamic.scoreImpact > 0 ? "增益结构" : "压力结构"}</b></div>
                    <div className="dynamic-strength"><small>结构强度 {dynamic.strength}</small><i><b style={{ width: `${dynamic.strength}%` }} /></i></div>
                    <p>{dynamic.summary}</p><p className="dynamic-scene">{dynamic.scenarioImpact}</p>
                    <aside><b>怎么相处</b>{dynamic.advice}</aside>
                  </div>
                </article>)}
              </div> : <p className="duo-dynamic-empty">两张命盘之间没有形成明显的六合、六冲、三合、三会或天干相克，互动重点更多落在双方十神与行为维度。</p>}
            </section>
            </>}
            {active.key === "manner" && <>
            <section className="match-score-method">
              <header><div><span>行为指标对照</span><h3>六项指标，左右对镜</h3></div><small>左为{userNameSafe} · 右为{partnerNameSafe} · 满格 100</small></header>
              <div className="contrast-chart">
                <div className="contrast-head"><b>{userNameSafe}</b><span>指标</span><b>{partnerNameSafe}</b></div>
                {contrastRows.map(([label, mine, theirs]) => <div className="contrast-row" key={label}>
                  <div className="contrast-cell left"><i style={{ width: `${mine}%` }} /><b>{mine}</b></div>
                  <span>{label}</span>
                  <div className="contrast-cell right"><i style={{ width: `${theirs}%` }} /><b>{theirs}</b></div>
                </div>)}
              </div>
            </section>
            <section className="duo-guide">
              <div className="guide-behaviors">
                <h4>关系样态判读<small>五项行为断语 · 均附命盘依据</small></h4>
                {relationship.guide.behaviors.map((item) => <article key={item.label}>
                  <span>{item.label}</span>
                  <div><strong>{item.conclusion}</strong><p>{item.basis}</p><PairBars metrics={item.metrics} aName={userNameSafe} bName={partnerNameSafe} /></div>
                </article>)}
              </div>
            </section>
            </>}
            {active.key === "nature" && <section className="duo-guide">
              <div className="nature-persons">
                {[{ target: profile, name: userNameSafe, tone: "mine" }, { target: partnerProfile, name: partnerNameSafe, tone: "theirs" }].map(({ target, name, tone }) => <article className={`nature-card ${tone}`} key={tone}>
                  <header><i>{target.bazi.dayPillar[0]}</i><div><strong>{name}</strong><span>{target.bazi.dayPillar}日柱 · {target.combinedPersona.name}</span></div><b>{attachLabel(target)}依恋</b></header>
                  <div className="nature-stats">
                    {personalityRows.map(([label, key]) => <div key={key}><strong>{target.personality[key]}</strong><span>{label}</span></div>)}
                  </div>
                  <p className="nature-basis">主轴{target.dominantPersona.god}（{target.dominantBasis}）· {target.dominantPersona.drive.replaceAll(" / ", "、")}驱动</p>
                  <div className="nature-tags">{target.identityTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                </article>)}
              </div>
              <div className="nature-diffs">
                <h4>你们最不一样的三处<small>取自双方深度报告 · 结构差值最大的维度</small></h4>
                {profile.deepAnalysis
                  .map((item) => { const other = partnerProfile.deepAnalysis.find((entry) => entry.key === item.key); return other ? { key: item.key, label: item.label, mine: item, theirs: other, gap: Math.abs(item.score - other.score) } : null; })
                  .filter((pair): pair is NonNullable<typeof pair> => pair !== null)
                  .sort((x, y) => y.gap - x.gap).slice(0, 3)
                  .map((pair) => <article key={pair.key}>
                    <PairBars metrics={[{ label: pair.label, a: pair.mine.score, b: pair.theirs.score }]} aName={userNameSafe} bName={partnerNameSafe} />
                    <div className="diff-cols">
                      <div><b>{userNameSafe} · {pair.mine.descriptor}</b><p>{pair.mine.summary}</p></div>
                      <div><b>{partnerNameSafe} · {pair.theirs.descriptor}</b><p>{pair.theirs.summary}</p></div>
                    </div>
                  </article>)}
              </div>
              <div className="nature-manuals">
                {relationship.guide.manuals.map((manual) => <article key={manual.person}>
                  <h4>{manual.person} 使用说明书<small>怎么对TA，比懂TA更实用</small></h4>
                  <div className="manual-cols">
                    <div><span className="manual-tag manual-do">可以多做</span><ul>{manual.dos.map((entry) => <li key={entry}>{entry}</li>)}</ul></div>
                    <div><span className="manual-tag manual-dont">尽量别做</span><ul>{manual.donts.map((entry) => <li key={entry}>{entry}</li>)}</ul></div>
                  </div>
                </article>)}
              </div>
            </section>}
            {active.key === "reef" && (() => {
              const riskCandidates = duoRhythm.map((yearItem) => {
                const worst = yearItem.tendencies.filter((t) => t.key === "turbulence" || t.key === "change" || t.key === "drain").sort((x, y) => y.value - x.value)[0];
                return worst ? { year: yearItem.year, label: worst.label, value: worst.value } : null;
              }).filter((item): item is { year: number; label: string; value: number } => item !== null).sort((x, y) => y.value - x.value);
              const riskYear = riskCandidates[0];
              return <section className="duo-guide">
              <p className="guide-philosophy">{relationship.guide.philosophy}</p>
              <div className="guide-hotspots">
                <h4>易生摩擦的三种情境<small>按双方结构差值降序 · 每条标注结构来源，倾向非断言</small></h4>
                {relationship.guide.hotspots.map((item, index) => <article key={item.scene}>
                  <span>0{index + 1}</span>
                  <div>
                    <h5>{item.scene}</h5>
                    <small className="hotspot-source">{item.source}</small>
                    <PairBars metrics={item.metrics} aName={userNameSafe} bName={partnerNameSafe} />
                    <p>{item.risk}</p>
                    <aside><b>拆法</b>{item.playbook}</aside>
                  </div>
                </article>)}
                {riskYear && <p className="hotspot-window">未来五年中，{riskYear.year} 年的{riskYear.label}倾向偏高——本章雷区在那样的年份更容易被放大，逐年信号见 陆 · 未来五年。</p>}
              </div>
            </section>;
            })()}
            {active.key === "rhythm" && <section className="duo-guide rhythm-years">
              <p className="rhythm-note">逐年只列倾向：每条倾向给出倾向值与触发它的结构信号（原因标签，悬停可看解释）——供两个人安排节奏参考，不作吉凶断言。</p>
              {duoRhythm.map((item) => <article key={item.year} className={`rhythm-year tone-${item.tone}`}>
                <header className="rhythm-head">
                  <i>{item.ganZhi}</i>
                  <div><span>{item.year} 年</span><h4>{item.tendencies.length ? `${item.tendencies[0].label}倾向为主` : "无强倾向"}</h4></div>
                </header>
                {item.tendencies.length > 0 && <div className="pair-bars rhythm-bars">
                  {item.tendencies.map((tendency) => <div className="tendency-block" key={tendency.key}>
                    <div className="pair-bar-row">
                      <span>{tendency.label}倾向</span>
                      <div className="pair-lines"><div className="pair-line"><i className="pair-track"><b className={`tend-${tendency.key}`} style={{ width: `${tendency.value}%` }} /></i><em>{tendency.value}</em></div></div>
                    </div>
                    <div className="rhythm-signals">{tendency.causes.map((cause, causeIndex) => <span key={causeIndex} title={cause.detail}>{cause.who} · {cause.label}</span>)}</div>
                  </div>)}
                </div>}
                <p>{item.reading}</p>
                <aside className="rhythm-advice"><b>这一年怎么过</b>{item.advice}</aside>
              </article>)}
            </section>}
            {active.key === "summary" && <section className="duo-guide">
              <article className="guide-verdict">
                <div className="verdict-seal"><small>关系判词</small><strong>{relationship.guide.verdict.title}</strong></div>
                <div>
                  <small>判据：{relationship.guide.verdict.basis}</small>
                  <p>判词全文在报告首屏——这一章只留印章与全景，不再复述。</p>
                </div>
              </article>
              <div className="summary-dims">
                <h4>六维一览<small>全篇唯一的全景一屏</small></h4>
                {relationship.scoreBreakdown.map((item) => <div className="summary-dim-row" key={item.key}><span>{item.label}</span><i><b style={{ width: `${item.score}%` }} /></i><small>{item.score}</small></div>)}
              </div>
              <div className="guide-behaviors">
                <h4>要点回顾<small>最高维度 · 最需留意 · 未来五年</small></h4>
                <article><span>最高维度</span><div><strong>{bestDim.label}</strong><p>{bestDim.summary}</p></div></article>
                <article><span>最需留意</span><div><strong>{relationship.guide.hotspots[0].scene}</strong><p><Link href={`${moduleBase}&module=reef#match-report`}>拆法见 伍 · 摩擦与化解 →</Link></p></div></article>
                <article><span>未来五年</span><div><strong>{duoRhythm[0].tendencies[0] ? `开局${duoRhythm[0].tendencies[0].label}倾向` : "开局平稳"}</strong><p><Link href={`${moduleBase}&module=rhythm#match-report`}>逐年倾向与信号见 陆 · 未来五年 →</Link></p></div></article>
              </div>
              <Link className="guide-ai" href={`${moduleBase}&module=summary&ask=${encodeURIComponent("综合所有维度点评我们这段关系，并给出三条最重要的相处建议")}#match-report`}>
                让 AI 结合全部信号，写一份你们的关系点评 <span>→</span>
              </Link>
            </section>}
            {(() => {
              // 每章的 AI 总结入口：与柒章 guide-ai 同机制，提问按章定制（柒章自有入口，不重复）
              const chapterAsk: Record<string, string> = {
                dimensions: "结合六个维度的分数与构成，用人话总结我们的关系底盘：最强的一维、最弱的一维，以及最值得花力气的地方",
                nature: "结合两人最不一样的三处和各自的使用说明书，总结我们俩最核心的不同，以及各自最该记住对方的一条",
                structure: "解读我们两张命盘之间的合冲结构，说说它们在日常相处里通常以什么样子出现",
                manner: "结合五条相处断语，描绘我们日常相处最典型的三个画面",
                reef: "结合三个摩擦情境和它们的结构来源，点评我们最需要防的一个雷区和最实用的一个拆法",
                rhythm: "结合未来五年的逐年倾向与结构信号，给我们每一年的相处重点各提一句建议",
              };
              const question = chapterAsk[active.key];
              return question ? <Link className="guide-ai" href={`${moduleBase}&module=${active.key}&ask=${encodeURIComponent(question)}#match-report`}>
                让 AI 结合本章信号，写一段你们的专属总结 <span>→</span>
              </Link> : null;
            })()}
            <nav className="module-pager">
              {activeIndex > 0
                ? <Link href={`${moduleBase}&module=${moduleMeta[activeIndex - 1].key}#match-report`}>← {moduleMeta[activeIndex - 1].no} · {moduleMeta[activeIndex - 1].title}</Link>
                : <Link href={`${moduleBase}#match-report`}>← 报告目录</Link>}
              <Link className="pager-home" href={`${moduleBase}#match-report`}>目录</Link>
              {activeIndex < moduleMeta.length - 1
                ? <Link href={`${moduleBase}&module=${moduleMeta[activeIndex + 1].key}#match-report`}>{moduleMeta[activeIndex + 1].no} · {moduleMeta[activeIndex + 1].title} →</Link>
                : <Link href={`${moduleBase}#match-report`}>返回目录 →</Link>}
            </nav>
          </div>}
          </div>
          );
        })()}
      </section>

      {view === "square" && recommendations.length > 0 && <section className="recommendation-results">
        <div className="section-number">02 — 为你推荐 · 可能认识的人</div>
        <h2>与你更有可能<br /><em>形成互补的人。</em></h2>
        <div className="recommendation-grid">
          {recommendations.map(({ name, role, result }, index) => (
            <article className={index === 0 ? "top-match" : ""} key={name}>
              <div className={`match-avatar avatar-${index % 3}`}><span>{name[0]}</span></div>
              <div className="rec-main">
                <div className="recommendation-top"><span>{index === 0 ? "最佳推荐" : `同频推荐 0${index + 1}`}</span></div>
                <h3>{name}</h3><p className="role">{role} · 同城 {3 + index * .7}km</p>
                <div className="simple-match-reasons">
                  {result.reasons.slice(0, 2).map((reason) => <p key={reason}><i>✓</i>{reason}</p>)}
                </div>
              </div>
              <div className="rec-score"><strong>{result.score}</strong><small>匹配度</small><button>打招呼</button></div>
            </article>
          ))}
        </div>
        <div className="feed-loader"><i /><span>继续发现更多同频的人</span><i /></div>
      </section>}

      <footer><div className="brand">FATE<span>°</span></div><p>FATE — 东方人格建模系统 · Eastern Persona Modeling.</p><small>不是算命，而是一种理解关系的新语言。</small></footer>
      {(selectedDeep || selectedInteraction) && <div className="logic-overlay">
        <Link className="logic-backdrop" href={`/?${baseQuery}&view=${view}${view === "match" ? partnerQuery : ""}${moduleQuery}#${returnAnchor}`} aria-label="关闭推理详情" />
        <section className="logic-sheet">
          <header><div><span>FATE / 推理详情</span><h2>{selectedDeep?.label ?? selectedInteraction?.label}</h2></div><Link href={`/?${baseQuery}&view=${view}${view === "match" ? partnerQuery : ""}${moduleQuery}#${returnAnchor}`}>×</Link></header>
          {selectedDeep && <>
            <div className="logic-result"><strong>{selectedDeep.score}</strong><div><span>{selectedDeep.category} · {selectedDeep.level}</span><h3>{selectedDeep.descriptor}</h3><p>{selectedDeep.summary}</p></div></div>
            <div className="logic-keywords">{selectedDeep.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
            <div className="logic-factor-panel"><h3>01 · 结构信号</h3><div className="deep-factor-tags">{factorTagsFor(selectedDeep.key).map((factor) => <span className={`factor-${factor.tone}`} key={`${factor.label}-${factor.tone}`}><i style={{ "--factor": `${factor.value}%` } as CSSProperties} /><b>{factor.label}</b><small>{factor.value}%</small></span>)}</div><p>标签展示该维度调用的主要十神与五行占比；位置权重已在底层统一折算，不在阅读层重复堆叠算式。</p></div>
            <div className="logic-block"><span>02 · 倾向如何形成</span><p>{selectedDeep.logic.premise}</p></div>
            <div className="logic-block counter"><span>03 · 什么时候不会这样</span><p>{selectedDeep.logic.counterSignal}</p></div>
                        <div className="detail-duo">
              <div><i>✦</i><span>这项倾向的优势</span><p>{selectedDeep.logic.strength}</p></div>
              <div><i>!</i><span>容易忽略的盲点</span><p>{selectedDeep.logic.blindSpot}</p></div>
            </div>
            <div className="scene-analysis"><h3>05 · 三类真实场景</h3>{selectedDeep.sceneInsights.map((scene, index) => <article key={scene.scene}><i>{index + 1}</i><div><span>{scene.scene} · {scene.title}</span><p>{scene.text}</p></div></article>)}</div>
                        <p className="logic-disclaimer">{selectedDeep.note}</p>
          </>}
          {selectedInteraction && <>
            <div className="logic-result"><strong>{relationship?.score}</strong><div><span>双人关系</span><p>{selectedInteraction.summary}</p></div></div>
            <div className="logic-steps"><h3>双方推导步骤</h3>{selectedInteraction.logic.map((step) => <div key={step}>{step}</div>)}</div>
            <div className="logic-block"><span>量化证据</span><PairBars metrics={selectedInteraction.metrics} aName={birth.name ?? "我"} bName={partnerBirth?.name ?? "TA"} /></div>
            <div className="logic-block counter"><span>关系原因</span><p>{selectedInteraction.why}</p></div>
                      </>}
        </section>
      </div>}
      <nav className="mobile-bottom-nav" aria-label="移动端主导航">
        <Link className={view === "overview" ? "active" : ""} href={`/?${baseQuery}&view=overview`}><i>⌂</i><span>首页</span></Link>
        <Link className={view === "deep" ? "active" : ""} href={`/?${baseQuery}&view=deep`}><i>≋</i><span>深度</span></Link>
        <PlotTrigger />
        <Link className={view === "match" ? "active" : ""} href={`/?${baseQuery}&view=match`}><i>◇</i><span>剧本</span></Link>
        <Link className={view === "square" ? "active" : ""} href={`/?${baseQuery}&view=square`}><i>◉</i><span>广场</span></Link>
      </nav>
      <PlotPanel defaults={birth} />
      <ChatAssistant contextTitle={assistantContext.title} contextSummary={assistantContext.summary} evidence={assistantContext.evidence} suggestions={assistantContext.suggestions} answer={assistantAnswer} baseHref={assistantHref} returnAnchor={returnAnchor} hiddenFields={assistantFields} />
    </main>
  );
}

export default async function ResultPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const birth: BirthInput = {
    year: Number(query.year), month: Number(query.month),
    day: Number(query.day), hour: Number(query.hour),
    minute: Number(query.minute ?? 0), name: String(query.name ?? "我"),
    gender: query.gender === "male" ? "male" : "female",
    calendarType: query.calendarType === "lunar" ? "lunar" : "solar",
    isLeapMonth: query.isLeapMonth === "true",
  };
  const partnerBirth: BirthInput | undefined = query.partnerYear ? {
    year: Number(query.partnerYear), month: Number(query.partnerMonth),
    day: Number(query.partnerDay), hour: Number(query.partnerHour),
    minute: Number(query.partnerMinute ?? 0), name: String(query.partnerName ?? "TA"),
    gender: query.partnerGender === "female" ? "female" : "male",
    calendarType: query.partnerCalendarType === "lunar" ? "lunar" : "solar",
    isLeapMonth: query.partnerIsLeapMonth === "true",
  } : undefined;
  const view = query.view === "deep" || query.view === "match" || query.view === "square" ? query.view : "overview";
  return <ResultContent birth={birth} view={view} partnerBirth={partnerBirth} relationType={String(query.relationType ?? "恋爱")} detail={String(query.detail ?? "")} assistantQuestion={String(query.ask ?? "")} flowYear={Number(query.flowYear ?? new Date().getFullYear())} moduleKey={typeof query.module === "string" ? query.module : ""} />;
}
