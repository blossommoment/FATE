// 双人深度解读 · 数据层（B1）—— 设计依据见 docs/REQ_DUO_REPORT.md
// 职责：双人标签（五域，组合规则触发）+ 对比数据打包，全部确定性，供成册报告与 AI 叙述层使用。
// 正文契约同个人版：标签零命理黑话；总分永不外显（拍板#3）。

import type { Elements, RelationshipAnalysis, UserProfile } from "./types";
import { analyzeDuoRhythm, type DuoYearOutlook } from "./fate";

export type DuoMetric = { label: string; a: number; b?: number };
export type DuoTagHit = { tag: string; metrics: DuoMetric[] };
export type DuoDomain = "origin" | "daily" | "friction" | "longrun" | "season";
export type DuoTags = Record<DuoDomain, DuoTagHit[]>;

const ELEMENT_CN: Record<keyof Elements, string> = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };

const deep = (p: UserProfile, key: string) => p.deepAnalysis.find((i) => i.key === key)?.score ?? 50;
const trait = (p: UserProfile, key: string) => p.traitAnalysis.find((i) => i.key === key)?.score ?? 50;
const commScore = (p: UserProfile) => ({ low: 35, medium: 55, high: 75 })[p.socialProfile.communication_need];

type GodGroup = "authority" | "resource" | "wealth" | "peer" | "output";
const godGroup = (god: string): GodGroup =>
  ["正官", "七杀"].includes(god) ? "authority"
    : ["正印", "偏印"].includes(god) ? "resource"
      : ["正财", "偏财"].includes(god) ? "wealth"
        : ["食神", "伤官"].includes(god) ? "output" : "peer";

// 五行喜忌互补（与 buildRelationshipSpine 同口径，独立计算避免依赖 analysis）
function synergyTone(a: UserProfile, b: UserProfile): "mutual" | "oneway" | "costly" | "neutral" {
  const top = (p: UserProfile) => (Object.entries(p.energy.elementPower) as [keyof Elements, number][]).sort((x, y) => y[1] - x[1])[0][0];
  const side = (self: UserProfile, other: UserProfile) => {
    const dm = self.energy.dayMaster;
    if (dm.level === "中和") return "neutral";
    if (dm.favorable.includes(top(other))) return "boost";
    if (dm.unfavorable.includes(top(other))) return "drain";
    return "neutral";
  };
  const sa = side(a, b);
  const sb = side(b, a);
  if (sa === "boost" && sb === "boost") return "mutual";
  if (sa === "boost" || sb === "boost") return "oneway";
  if (sa === "drain" || sb === "drain") return "costly";
  return "neutral";
}


export const DUO_TAG_EXPLAIN: Record<string, string> = {
  双向奔赴: "两个人都愿意先走一步", 一追一逃: "一个在靠近，一个在校准距离",
  被吸住的观察员: "一个直球点火，一个慢慢沦陷", 互为补给: "待在一起本身就是回血",
  单向充电宝: "一方给电，一方蓄电——记得轮换", 相处费电组: "不是不合，是要留独处间隔",
  同类相认: "同一种底层操作系统", 镜像互补: "你的短板恰好是TA的主场",
  一眼定档: "都热得快，开局像老友重逢", 文火慢炖: "都慢热，感情靠时间熬出来",
  反差吸引: "一动一静，互相看不腻", 强强相遇: "两个掌舵人，得商量谁先让舵",
  顺其自然的开场: "没有强磁场，但也没有排斥力",
  同频对讲机: "说话强度相当，翻译成本低", 一个广播一个收音: "一方负责说，一方负责懂",
  静音电台: "都不多话，默契或闷雷二选一", 时差恋人: "一个已经到站，一个还在路上",
  黏度不对等: "一方要糖，一方要空气", 各自有房间: "亲密但不同住一个精神房间",
  有人掌舵有人划桨: "分工天成，别读成谁更爱谁", 汇报型日常: "早安晚安一条不落",
  各忙各的挺好: "低频联系，高质量见面", 一个务实一个浪漫: "一个管烟火，一个管星光",
  双仪式感大户: "纪念日是你们的主场", 谁做计划谁惊喜: "一个排日程，一个拆盲盒",
  弹性日常: "节奏中庸，跟着生活走",
  冷战二人组: "都不先开口，沉默会自己发酵", 点火就着秒和好: "吵得快，和得更快",
  一个爆一个熄: "一方的火遇到一方的水", 谁都不低头: "和解需要一个台阶，最好提前修",
  醋坛子与大心脏: "一个在推理，一个没察觉", 确认与空间之争: "一个要回应，一个要喘息",
  情绪时差: "一个还在气头，一个已经翻篇", 讲道理大赛: "都想赢辩论，容易输感情",
  边界踩线预警: "一方的关心是另一方的越界", 双敏感雷达: "都容易多想，脑补要对答案",
  迟到的爆发: "平时都忍，算账一起算", 小事不过夜型: "摩擦低配，问题不隔夜",
  保鲜靠计划: "手里常留一个进行中的共同计划", 仪式感地基: "固定的小重复是你们的地基",
  老夫老妻预定: "稳定就是你们的浪漫", 越处越顺型: "磨合成本低，越久越合脚",
  慢热但绑定深: "进场慢，退场更慢", 双强并行线: "两条事业线，日程是第三者",
  互为军师: "聊得深想得多，行动要互相推", 搭伙创作组: "一起做点东西是最好的黏合剂",
  需要共同项目: "感情靠共同目标供氧", 细水长流候选: "没有烈火，有长明灯",
  推进窗口在望: "五年里有顺手的年份，大事往那儿放", 变动期穿行: "位置与安排会动，预案先行",
  高压段在途: "有的年份外部变量偏多，少排大决定", 外缘活跃段: "曝光上升的年份，透明是解法",
  蓄力区间: "有电量偏低的年份，按省电模式过", 平流五年: "无强信号，日子怎么过关系就怎么长",
  各有各的节奏: "周期不同步，理解比同步更重要", 慢慢对焦中: "吸引在细节里，不在第一眼",
  搭伙过日子型: "不腻歪，但缺谁都不行", 摩擦耐受良好: "冲突不是你们的常客",
  时间站你们这边: "没有硬伤，耐心是最大的资产", 按自己的表走: "两套时钟，对表就好",
};

// ── 五域双人标签（规则表映射，确定性）────────────────────────────

export function buildDuoTags(a: UserProfile, b: UserProfile, rhythm?: DuoYearOutlook[]): DuoTags {
  const M = (label: string, va: number, vb: number): DuoMetric => ({ label, a: Math.round(va), b: Math.round(vb) });
  const d = (x: number, y: number) => Math.abs(x - y);
  const pick = (rules: { tag: string; hit: boolean; margin: number; m: DuoMetric[] }[], fallback: DuoTagHit[]): DuoTagHit[] => {
    const hits = rules.filter((r) => r.hit).sort((x, y) => y.margin - x.margin).slice(0, 3).map((r) => ({ tag: r.tag, metrics: r.m }));
    for (const fb of fallback) {
      if (hits.length >= 2) break;
      if (!hits.some((h) => h.tag === fb.tag)) hits.push(fb);
    }
    return hits;
  };

  const initA = trait(a, "initiative"), initB = trait(b, "initiative");
  const trustA = deep(a, "trust_speed"), trustB = deep(b, "trust_speed");
  const vigA = deep(a, "vigilance"), vigB = deep(b, "vigilance");
  const exprA = trait(a, "expressiveness"), exprB = trait(b, "expressiveness");
  const confA = deep(a, "conflict_expression"), confB = deep(b, "conflict_expression");
  const depA = deep(a, "dependency"), depB = deep(b, "dependency");
  const autoA = deep(a, "autonomy"), autoB = deep(b, "autonomy");
  const novA = deep(a, "novelty"), novB = deep(b, "novelty");
  const romA = deep(a, "romance"), romB = deep(b, "romance");
  const resA = deep(a, "resilience"), resB = deep(b, "resilience");
  const adaA = trait(a, "adaptability"), adaB = trait(b, "adaptability");
  const empA = trait(a, "empathy"), empB = trait(b, "empathy");
  const groupA = godGroup(a.dominantPersona.god), groupB = godGroup(b.dominantPersona.god);
  const axisA = { authority: 0, resource: 1, wealth: 2, peer: 3, output: 4 }[groupA];
  const axisB = { authority: 0, resource: 1, wealth: 2, peer: 3, output: 4 }[groupB];
  const attA = a.socialProfile.attachment_style, attB = b.socialProfile.attachment_style;
  const tone = synergyTone(a, b);
  const topPct = (p: UserProfile) => Math.max(...Object.values(p.energy.elementPower));
  const MIRROR = new Set(["resource|output", "output|resource", "output|wealth", "wealth|output", "wealth|authority", "authority|wealth", "authority|resource", "resource|authority"]);

  const origin = pick([
    { tag: "双向奔赴", hit: initA >= 55 && initB >= 55, margin: initA + initB - 110, m: [M("关系主动性", initA, initB)] },
    { tag: "一追一逃", hit: d(initA, initB) >= 25 && (attA === "avoidant" || attB === "avoidant"), margin: d(initA, initB) - 25, m: [M("关系主动性", initA, initB)] },
    { tag: "被吸住的观察员", hit: (trustA <= 45 && vigA >= 55 && exprB >= 58) || (trustB <= 45 && vigB >= 55 && exprA >= 58), margin: d(exprA, exprB), m: [M("信任建立速度", trustA, trustB), M("表达意愿", exprA, exprB)] },
    { tag: "互为补给", hit: tone === "mutual", margin: 30, m: [M("最旺五行占比", topPct(a), topPct(b))] },
    { tag: "单向充电宝", hit: tone === "oneway", margin: 20, m: [M("最旺五行占比", topPct(a), topPct(b))] },
    { tag: "相处费电组", hit: tone === "costly", margin: 20, m: [M("最旺五行占比", topPct(a), topPct(b))] },
    { tag: "同类相认", hit: groupA === groupB, margin: 15, m: [M("主轴强度", a.tenGodAnalysis[axisA].score, b.tenGodAnalysis[axisB].score)] },
    { tag: "镜像互补", hit: MIRROR.has(`${groupA}|${groupB}`), margin: 12, m: [M("主轴强度", a.tenGodAnalysis[axisA].score, b.tenGodAnalysis[axisB].score)] },
    { tag: "一眼定档", hit: trustA >= 60 && trustB >= 60, margin: trustA + trustB - 120, m: [M("信任建立速度", trustA, trustB)] },
    { tag: "文火慢炖", hit: trustA <= 45 && trustB <= 45, margin: 90 - trustA - trustB, m: [M("信任建立速度", trustA, trustB)] },
    { tag: "反差吸引", hit: d(a.personality.extroversion, b.personality.extroversion) >= 30, margin: d(a.personality.extroversion, b.personality.extroversion) - 30, m: [M("外向表达", a.personality.extroversion, b.personality.extroversion)] },
    { tag: "强强相遇", hit: a.personality.control >= 60 && b.personality.control >= 60 && initA >= 55 && initB >= 55, margin: a.personality.control + b.personality.control - 120, m: [M("边界控制", a.personality.control, b.personality.control)] },
  ], [{ tag: "顺其自然的开场", metrics: [M("关系主动性", initA, initB)] }, { tag: "慢慢对焦中", metrics: [M("信任建立速度", trustA, trustB)] }]);

  const daily = pick([
    { tag: "同频对讲机", hit: exprA >= 55 && exprB >= 55 && d(exprA, exprB) <= 15, margin: exprA + exprB - 110, m: [M("表达意愿", exprA, exprB)] },
    { tag: "一个广播一个收音", hit: d(exprA, exprB) >= 25, margin: d(exprA, exprB) - 25, m: [M("表达意愿", exprA, exprB)] },
    { tag: "静音电台", hit: exprA <= 45 && exprB <= 45, margin: 90 - exprA - exprB, m: [M("表达意愿", exprA, exprB)] },
    { tag: "时差恋人", hit: d(trustA, trustB) >= 25, margin: d(trustA, trustB) - 25, m: [M("信任建立速度", trustA, trustB)] },
    { tag: "黏度不对等", hit: d(depA, depB) >= 25, margin: d(depA, depB) - 25, m: [M("情感依赖", depA, depB)] },
    { tag: "各自有房间", hit: autoA >= 58 && autoB >= 58, margin: autoA + autoB - 116, m: [M("自主空间", autoA, autoB)] },
    { tag: "有人掌舵有人划桨", hit: d(initA, initB) >= 15 && d(initA, initB) < 25 && d(a.personality.control, b.personality.control) >= 15, margin: 10, m: [M("关系主动性", initA, initB), M("边界控制", a.personality.control, b.personality.control)] },
    { tag: "汇报型日常", hit: a.socialProfile.communication_need === "high" && b.socialProfile.communication_need === "high", margin: 14, m: [M("沟通需求", commScore(a), commScore(b))] },
    { tag: "各忙各的挺好", hit: a.socialProfile.communication_need === "low" && b.socialProfile.communication_need === "low", margin: 14, m: [M("沟通需求", commScore(a), commScore(b))] },
    { tag: "一个务实一个浪漫", hit: d(romA, romB) >= 25, margin: d(romA, romB) - 25, m: [M("浪漫倾向", romA, romB)] },
    { tag: "双仪式感大户", hit: romA >= 58 && romB >= 58, margin: romA + romB - 116, m: [M("浪漫倾向", romA, romB)] },
    { tag: "谁做计划谁惊喜", hit: d(a.personality.control, b.personality.control) >= 20 && d(novA, novB) >= 20, margin: 10, m: [M("边界控制", a.personality.control, b.personality.control), M("新鲜感需求", novA, novB)] },
  ], [{ tag: "弹性日常", metrics: [M("沟通需求", commScore(a), commScore(b))] }, { tag: "搭伙过日子型", metrics: [M("情感依赖", depA, depB)] }]);

  const friction = pick([
    { tag: "冷战二人组", hit: confA <= 45 && confB <= 45, margin: 90 - confA - confB, m: [M("冲突表达", confA, confB)] },
    { tag: "点火就着秒和好", hit: confA >= 58 && confB >= 58 && a.personality.stability >= 55 && b.personality.stability >= 55, margin: confA + confB - 116, m: [M("冲突表达", confA, confB), M("情绪稳定", a.personality.stability, b.personality.stability)] },
    { tag: "一个爆一个熄", hit: d(confA, confB) >= 25, margin: d(confA, confB) - 25, m: [M("冲突表达", confA, confB)] },
    { tag: "谁都不低头", hit: a.personality.control >= 60 && b.personality.control >= 60, margin: a.personality.control + b.personality.control - 120, m: [M("边界控制", a.personality.control, b.personality.control)] },
    { tag: "醋坛子与大心脏", hit: d(vigA, vigB) >= 25, margin: d(vigA, vigB) - 25, m: [M("关系警觉", vigA, vigB)] },
    { tag: "确认与空间之争", hit: (attA === "anxious" && attB === "avoidant") || (attA === "avoidant" && attB === "anxious"), margin: 25, m: [M("情感依赖", depA, depB), M("自主空间", autoA, autoB)] },
    { tag: "情绪时差", hit: d(a.personality.emotion, b.personality.emotion) >= 25, margin: d(a.personality.emotion, b.personality.emotion) - 25, m: [M("情感感知", a.personality.emotion, b.personality.emotion)] },
    { tag: "讲道理大赛", hit: a.personality.control >= 58 && b.personality.control >= 58 && empA <= 52 && empB <= 52, margin: 12, m: [M("边界控制", a.personality.control, b.personality.control), M("共情能力", empA, empB)] },
    { tag: "边界踩线预警", hit: (autoA >= 62 && depB >= 58) || (autoB >= 62 && depA >= 58), margin: 18, m: [M("自主空间", autoA, autoB), M("情感依赖", depA, depB)] },
    { tag: "双敏感雷达", hit: vigA >= 58 && vigB >= 58, margin: vigA + vigB - 116, m: [M("关系警觉", vigA, vigB)] },
    { tag: "迟到的爆发", hit: confA <= 45 && confB <= 45 && (vigA >= 58 || vigB >= 58), margin: 16, m: [M("冲突表达", confA, confB), M("关系警觉", vigA, vigB)] },
  ], [{ tag: "小事不过夜型", metrics: [M("冲突表达", confA, confB)] }, { tag: "摩擦耐受良好", metrics: [M("情绪稳定", a.personality.stability, b.personality.stability)] }]);

  const longrun = pick([
    { tag: "保鲜靠计划", hit: novA >= 55 && novB >= 55, margin: novA + novB - 110, m: [M("新鲜感需求", novA, novB)] },
    { tag: "仪式感地基", hit: novA <= 42 || novB <= 42, margin: 42 - Math.min(novA, novB), m: [M("新鲜感需求", novA, novB)] },
    { tag: "老夫老妻预定", hit: novA <= 45 && novB <= 45 && a.personality.stability >= 58 && b.personality.stability >= 58, margin: 20, m: [M("新鲜感需求", novA, novB), M("情绪稳定", a.personality.stability, b.personality.stability)] },
    { tag: "越处越顺型", hit: adaA >= 58 && adaB >= 58, margin: adaA + adaB - 116, m: [M("关系适应力", adaA, adaB)] },
    { tag: "慢热但绑定深", hit: trustA <= 45 && trustB <= 45 && depA >= 50 && depB >= 50, margin: 14, m: [M("信任建立速度", trustA, trustB), M("情感依赖", depA, depB)] },
    { tag: "双强并行线", hit: ["authority", "wealth"].includes(groupA) && ["authority", "wealth"].includes(groupB), margin: 12, m: [M("主轴强度", a.tenGodAnalysis[axisA].score, b.tenGodAnalysis[axisB].score)] },
    { tag: "互为军师", hit: groupA === "resource" && groupB === "resource", margin: 12, m: [M("主轴强度", a.tenGodAnalysis[axisA].score, b.tenGodAnalysis[axisB].score)] },
    { tag: "搭伙创作组", hit: groupA === "output" && groupB === "output", margin: 12, m: [M("主轴强度", a.tenGodAnalysis[axisA].score, b.tenGodAnalysis[axisB].score)] },
    { tag: "需要共同项目", hit: novA >= 50 && novB >= 50 && d(a.personality.control, b.personality.control) <= 15, margin: 8, m: [M("新鲜感需求", novA, novB)] },
  ], [{ tag: "细水长流候选", metrics: [M("情绪稳定", a.personality.stability, b.personality.stability)] }, { tag: "时间站你们这边", metrics: [M("关系适应力", adaA, adaB)] }]);

  // 时运标签：由未来五年流年倾向峰值导出（大运不再参与时运）
  const season: DuoTagHit[] = rhythm && rhythm.length
    ? (() => {
      const kindTag: Record<string, string> = { advance: "推进窗口在望", change: "变动期穿行", turbulence: "高压段在途", attraction: "外缘活跃段", drain: "蓄力区间" };
      const peaks = new Map<string, { value: number; year: number; label: string }>();
      for (const y of rhythm) for (const t of y.tendencies) {
        const prev = peaks.get(t.key);
        if (!prev || t.value > prev.value) peaks.set(t.key, { value: t.value, year: y.year, label: t.label });
      }
      const ranked = [...peaks.entries()].sort((x, y) => y[1].value - x[1].value).slice(0, 2);
      if (!ranked.length) return [{ tag: "平流五年", metrics: [] }];
      return ranked.map(([kind, peak]) => ({ tag: kindTag[kind] ?? "平流五年", metrics: [{ label: `${peak.year}年${peak.label}倾向峰值`, a: peak.value }] }));
    })()
    : [{ tag: "各有各的节奏", metrics: [] }, { tag: "按自己的表走", metrics: [] }];

  return { origin, daily, friction, longrun, season };
}

// ── 对比数据表征 ─────────────────────────────────────────────────

export type DuoComparison = { label: string; a: number; b: number; gap: number; level: "同步" | "有差" | "显著" };

function comparison(label: string, a: number, b: number): DuoComparison {
  const gap = Math.abs(Math.round(a) - Math.round(b));
  return { label, a: Math.round(a), b: Math.round(b), gap, level: gap >= 25 ? "显著" : gap >= 12 ? "有差" : "同步" };
}

export function buildDuoComparisons(a: UserProfile, b: UserProfile) {
  return {
    origin: [
      comparison("浪漫倾向", deep(a, "romance"), deep(b, "romance")),
      comparison("新鲜感需求", deep(a, "novelty"), deep(b, "novelty")),
      comparison("信任建立速度", deep(a, "trust_speed"), deep(b, "trust_speed")),
    ],
    daily: [
      comparison("表达意愿", trait(a, "expressiveness"), trait(b, "expressiveness")),
      comparison("情感依赖", deep(a, "dependency"), deep(b, "dependency")),
      comparison("沟通需求", commScore(a), commScore(b)),
    ],
    friction: [
      comparison("冲突表达", deep(a, "conflict_expression"), deep(b, "conflict_expression")),
      comparison("关系警觉", deep(a, "vigilance"), deep(b, "vigilance")),
      comparison("边界控制", a.personality.control, b.personality.control),
    ],
    longrun: [
      comparison("情绪稳定", a.personality.stability, b.personality.stability),
      comparison("自主空间", deep(a, "autonomy"), deep(b, "autonomy")),
      comparison("关系适应力", trait(a, "adaptability"), trait(b, "adaptability")),
    ],
  };
}

// ── 双人事实清单：成册报告与 AI 叙述层的唯一输入 ─────────────────

export type DuoFacts = ReturnType<typeof buildDuoFacts>;

export function buildDuoFacts(a: UserProfile, b: UserProfile, analysis: RelationshipAnalysis) {
  const rhythm = analyzeDuoRhythm(a, b, analysis.relationType, new Date().getFullYear(), 5);
  const person = (p: UserProfile) => ({
    name: p.birth.name ?? "TA",
    dayPillar: p.bazi.dayPillar,
    strength: p.energy.dayMaster.level,
    favorable: p.energy.dayMaster.favorable.map((e) => ELEMENT_CN[e]),
    attachment: ({ secure: "偏安全型", anxious: "偏焦虑型", avoidant: "偏回避型" } as const)[p.socialProfile.attachment_style],
  });
  return {
    relationType: analysis.relationType,
    persons: [person(a), person(b)],
    verdict: analysis.guide.verdict,       // 判词承载结论；总分永不外显（拍板#3）
    spine: analysis.spine,
    duoTags: buildDuoTags(a, b, rhythm),
    comparisons: buildDuoComparisons(a, b),
    rhythm: rhythm.map((y) => ({ year: y.year, ganZhi: y.ganZhi, tendencies: y.tendencies.map((t) => ({ key: t.key, label: t.label, value: t.value, causes: t.causes.map((c) => `${c.who}·${c.label}`) })), advice: y.advice })),
    behaviors: analysis.guide.behaviors,
    frictions: analysis.guide.hotspots.map(({ scene, risk, playbook }) => ({ scene, risk, playbook })),
    initiator: { name: analysis.guide.initiator.name, firstMove: analysis.guide.initiator.firstMove },
    contract: {
      rule: "只许转述与组织清单中的事实；正文与建议禁数字禁命理术语（时运章可提年龄段与年份）；以两人名字互称，写「你们」的具体场景，禁止拼贴两份个人报告；建议必须是两个人一起能做的一件事；总分与任何评分数字不得出现。",
      output: "成册五章：封面判词 + origin/daily/friction/longrun/season 各一章（评述+建议），品牌口径「报告内容基于 FATE 模型 2.0 得出」。",
    },
  };
}

// ── 叙述层：五章 prompt、校验器、确定性兜底（机制与个人版同构）────

export type DuoPageText = { essay: string; advice: string };
export type DuoDigestPayload = {
  headline: string; // 关系一句话判词，≤15字
  pages: { origin: DuoPageText; daily: DuoPageText; friction: DuoPageText; longrun: DuoPageText; season: DuoPageText };
};

const DUO_STYLE_ORIGIN = "（范文中的名字请替换为清单里两人的名字）阿明的靠近是有流程的：先观察几周、核对每条信号，才允许自己上心；小夏不一样，第二次见面就把阿明排进了周末计划。开场看起来不同步，其实是分工——小夏负责推进度，阿明负责验真伪。等到阿明开始主动提前十分钟到场，小夏开始学会不催，这段关系就算正式立项了。";
const DUO_STYLE_FRICTION = "冷战的时候，两个人做的是完全相反的动作：小夏会追进房间把话说完，消息一条接一条地发；阿明会先把手机调成静音，出门走一圈，等心跳降下来再回。追的人把沉默读成冷漠，退的人把追问读成逼迫——其实两个人都在给关系降温，只是小夏靠说完降温，阿明靠走开降温。谁先迈半步不重要，重要的是认出对方的动作不是针对自己。";

export function buildDuoPrompt(facts: DuoFacts): { system: string; user: string } {
  return {
    system: [
      "你是 FATE 双人深度解读报告的撰稿人。输入是 FATE 模型 2.0 已算好的双人事实清单（JSON），你负责写成五章报告正文。",
      "输出严格为 JSON（不要 markdown 代码块）：",
      `{"headline":"关系一句话判词，15字以内","pages":{"origin":{"essay":"缘起章：你们为什么互相吸引，180~240字","advice":"两个人一起能做的一件事，40~70字"},"daily":{"essay":"相处章：日常样态，180~240字","advice":"同上"},"friction":{"essay":"摩擦章：最容易在哪起冲突、怎么拆，180~240字","advice":"同上"},"longrun":{"essay":"长线章：这段关系怎么经营，160~220字","advice":"同上"},"season":{"essay":"时运章：未来五年的流年节律——哪一年什么倾向、大事怎么排，160~220字，可提年份","advice":"同上"}}}`,
      "铁律：",
      "1. 事实只能来自清单；每章围绕 duoTags 对应域的标签展开，并回扣 spine 主线。",
      "2. 正文与建议【禁止出现任何数字与指标名】（数据已由图表呈现；仅 season 章可写年龄段与年份）。",
      "3. 禁止命理术语与吉凶断言；禁止「注定/命中」；禁止绝对化断言与现实断言（必然/一定/十有八九/大概率/肯定会），推演一律用「往往/更容易/倾向于」，涉及读者现实的说法用「可以对照观察」句式。",
      `4. 以名字称呼两人（${facts.persons[0].name}、${facts.persons[1].name}），写「你们」的具体场景（谁先发消息、饭桌氛围、冷战谁破冰）；禁止各写一段拼成两份个人报告。`,
      "5. 每章 advice 必须是两个人一起能做的一件具体的事。",
      "6. essay 直接以正文开场：禁止出现「缘起章」「相处章」等章节名，禁止复述章节说明，禁止以设问开头——第一句就进入两人的具体画面。",
      "写作要求（付费报告，读者要的是被看穿的感觉）：",
      "a. 每章至少一个具体生活场景。句子的主语用两人的名字（某某会怎么做，某某则会怎么做），谓语落在【可观察的行为动作】上：回复变慢、先离开现场、把周末计划提前排好、消息一条接一条地发、追问频率上升。严禁编造台词（不写两人说了什么），也不要停在抽象状态形容（如在校准距离、在试探边界这类悬空修辞）。少用一个如何另一个如何的无主语句式。",
      "b. 清单里的 behaviors、frictions（含 playbook）、initiator.firstMove 是现成素材库：改写成行为模式描写（其中的数字一律丢弃，禁止照抄进正文）。advice 栏例外：可以给一句让两人照着说的话。",
      "c. 每章要有一句值得截图转发的精辟短句。",
      "d. headline 参考 verdict.quip 的幽默感【另写一句】：不得照抄 verdict.title，也不得摘抄 quip 中的任何原句（读者在结果页已经看过判词，付费封面必须是新的一句话）。",
      `风格样例一（缘起章）：${DUO_STYLE_ORIGIN}`,
      `风格样例二（摩擦章）：${DUO_STYLE_FRICTION}`,
    ].join("\n"),
    user: `双人事实清单：\n${JSON.stringify(facts, null, 0)}`,
  };
}

const DUO_DIGIT_RE = /[0-9０-９]/;
const DUO_JARGON_RE = /食神|伤官|比肩|劫财|正印|偏印|正官|七杀|正财|偏财|日主|喜用|忌神|身弱|身强|从弱|从强|禄|刃|藏干|十神|用神/;

export function validateDuoPayload(raw: unknown, verdict?: { title: string; quip: string }): DuoDigestPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<DuoDigestPayload>;
  if (typeof d.headline !== "string" || d.headline.length === 0 || d.headline.length > 24) return null;
  if (verdict) {
    // 封面判词不得与结果页判词撞文：等于 title，或与 quip 存在 ≥8 字连续重合（滑窗，防少字漏字的近抄）
    const strip = (text: string) => text.replace(/[，。！？；：、“”「」\s—–-]/g, "");
    const bare = strip(d.headline);
    const quipBare = strip(verdict.quip);
    if (bare.length === 0 || bare === strip(verdict.title)) return null;
    for (let start = 0; start + 8 <= bare.length; start++) {
      if (quipBare.includes(bare.slice(start, start + 8))) return null;
    }
  }
  const pages = d.pages;
  if (!pages) return null;
  const keys = ["origin", "daily", "friction", "longrun", "season"] as const;
  for (const key of keys) {
    const page = pages[key];
    if (!page || typeof page.essay !== "string" || typeof page.advice !== "string") return null;
    if (page.essay.length < 90 || page.advice.length < 15) return null;
    if (/^[^。！？]{0,6}章[:：]/.test(page.essay)) return null; // 拦章节名开头（模型爱复述 schema 说明）
    if (key !== "season" && DUO_DIGIT_RE.test(page.essay + page.advice)) return null;
    // 评述禁虚构台词：只拦「对话动词+引号」的剧本模式，放行概念/标签引用（模拟话术红线）。
    // 注意：来/发/回 是中文最高频字，做触发词会误杀『回到「老地方」』类概念引用——真台词由 一句/那句 分支兜住。
    if (/(?:说|问|答|喊|甩出|憋出|冒出)[^。“”「」]{0,6}[“「]|(?:一句|那句)[^。“”「」]{0,3}[“「]/.test(page.essay)) return null;
  }
  const everything = [d.headline, ...keys.flatMap((k) => [pages[k]!.essay, pages[k]!.advice])].join("");
  if (DUO_JARGON_RE.test(everything)) return null;
  return d as DuoDigestPayload;
}

// 确定性兜底：五章完整成品（正文零数字零黑话；时运章允许年龄段）
export function buildDuoFallback(facts: DuoFacts): DuoDigestPayload {
  const [pa, pb] = facts.persons;
  const t = facts.duoTags;
  const ex = (tag: string) => DUO_TAG_EXPLAIN[tag] ?? "";
  const names = (domain: DuoDomain) => t[domain].map((h) => h.tag).join("、");
  const first = (domain: DuoDomain) => t[domain][0]?.tag ?? "";
  const rhythmLine = facts.rhythm.map((y) => `${y.year} 年偏${y.tendencies[0]?.label ?? "平稳"}`).join("、");
  const pushYear = facts.rhythm.find((y) => y.tendencies[0]?.key === "advance");
  const calmYear = facts.rhythm.find((y) => !y.tendencies.length);
  const heavyYear = facts.rhythm.find((y) => ["turbulence", "change", "drain"].includes(y.tendencies[0]?.key ?? ""));
  return {
    headline: `${facts.spine.primaryResource.label}为帆，${facts.spine.primaryTension.label}为锚`, // 封面判词不与结果页判词撞文：兜底由 spine 两轴合成

    pages: {
      origin: {
        essay: `${pa.name}和${pb.name}的开场写着「${names("origin")}」。${ex(first("origin"))}——吸引不是错觉，是两种结构刚好互相踩中了开关。${facts.spine.thesis}，这条主线从你们第一次说话就埋下了：一方提供的，恰好是另一方缺的那种确定感或推进力。后面所有的故事，都是这个开关被反复按下的回声。`,
        advice: "复盘一次「你们怎么开始的」：各自说出最初被吸引的一个瞬间——答案往往和现在闹别扭的原因是同一件事。",
      },
      daily: {
        essay: `日常里的你们是「${names("daily")}」。${ex(first("daily"))}。谁先发消息、谁定周末、谁记得纪念日，这些小事在你们这里有天然的分工——分工本身不是问题，把分工读成「谁更爱谁」才是问题。把彼此的默认设置当成出厂配置而不是态度，日子会顺很多。`,
        advice: "各自写下三件「希望对方主动做」的小事交换——把猜谜游戏变成使用说明。",
      },
      friction: {
        essay: `你们的摩擦画像是「${names("friction")}」。${ex(first("friction"))}。分歧真正的成本从来不在吵，而在两个人处理分歧的时钟不同步：一个需要当场说清，一个需要先退一步；一个在等回应，一个在等冷静。先把各自的时钟摆到桌面上，比争谁对谁错省得多。`,
        advice: "约一个「暂停暗号」：任何一方说出它，战斗冻结、第二天早饭后再谈——冻结不是逃避，是给时钟对表的时间。",
      },
      longrun: {
        essay: `往长了看，你们是「${names("longrun")}」。${ex(first("longrun"))}。长线的关键不是保鲜激情，是把已经顺手的相处方式变成制度：固定的仪式、共同的项目、说好的边界。感情的复利来自重复，而你们已经有了值得重复的东西。`,
        advice: "每季度安排一件只属于你们俩的「第一次」，提前写进两个人的日历。",
      },
      season: {
        essay: `把未来五年摊开看：${rhythmLine}。节律不是命令，是天气预报——${heavyYear ? `${heavyYear.year} 年前后外部变量偏多，重大决定放慢、低成本的陪伴加密；` : ""}${pushYear ? `想推进的大事，优先排在 ${pushYear.year} 年这类顺手的年份；` : calmYear ? `${calmYear.year} 年这类平稳年份，适合把平时绕着走的小分歧谈透；` : ""}其余时间把日子过小。起伏看得见，就不值得慌——${pa.name}和${pb.name}要做的，只是别在同一年里互相要求满格。`,
        advice: facts.rhythm.find((y) => y.tendencies[0])?.advice ?? "把两个人的节奏摊开对表：谁该冲、谁该稳，说清楚就不拧巴。",
      },
    },
  };
}
