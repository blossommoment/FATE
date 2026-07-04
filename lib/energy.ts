// 五行能量引擎 v2 —— 设计依据见 docs/REQ_ENERGY_REPORT_V2.md
// 管线：基础分 → 合冲刑害预处理（可用系数）→ 月令旺相休囚死 → 通根透干 → 生克传导定强弱
// 自带藏干表，只依赖干支字面，可用合成盘做确定性测试。

import type { Elements } from "./types";

export type ElementKey = keyof Elements;

export interface PillarGZ { gan: string; zhi: string }

export interface StructureRecord {
  type: "三会" | "三合" | "半合" | "半会" | "六合化" | "六合绊" | "六冲" | "三刑" | "自刑" | "相害" | "干合化" | "干合绊" | "日主干合";
  detail: string;
  positions: number[];
  effect: string;
}

export interface TraceRecord { source: string; element: ElementKey; points: number; note?: string }

export interface DayMasterStrength {
  stem: string;
  element: ElementKey;
  score: number;             // 同党占比 0-100
  level: "从强" | "身强" | "中和" | "身弱" | "从弱";
  confidence: "high" | "medium" | "low";
  gotSeason: boolean;        // 得令（日主五行处旺/相位）
  rooted: boolean;           // 是否有根（含长生/墓库根）
  favorable: ElementKey[];   // 喜
  unfavorable: ElementKey[]; // 忌
  reasons: string[];
}

export interface EnergyResult {
  raw: Elements;             // 绝对能量
  elementPower: Elements;    // 归一化百分比（保留 1 位小数）
  dayMaster: DayMasterStrength;
  structures: StructureRecord[];
  trace: TraceRecord[];
}

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const STEM_ELEMENT: Record<string, ElementKey> = {
  甲: "wood", 乙: "wood", 丙: "fire", 丁: "fire", 戊: "earth",
  己: "earth", 庚: "metal", 辛: "metal", 壬: "water", 癸: "water",
};
const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);

// 藏干表（本气 / 中气 / 余气）
export const BRANCH_HIDDEN: Record<string, string[]> = {
  子: ["癸"], 丑: ["己", "癸", "辛"], 寅: ["甲", "丙", "戊"], 卯: ["乙"],
  辰: ["戊", "乙", "癸"], 巳: ["丙", "庚", "戊"], 午: ["丁", "己"], 未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"], 酉: ["辛"], 戌: ["戊", "辛", "丁"], 亥: ["壬", "甲"],
};

// 月支当令五行
const COMMAND_ELEMENT: Record<string, ElementKey> = {
  寅: "wood", 卯: "wood", 巳: "fire", 午: "fire",
  申: "metal", 酉: "metal", 亥: "water", 子: "water",
  辰: "earth", 戌: "earth", 丑: "earth", 未: "earth",
};

const GENERATES: Record<ElementKey, ElementKey> = { wood: "fire", fire: "earth", earth: "metal", metal: "water", water: "wood" };
const OVERCOMES: Record<ElementKey, ElementKey> = { wood: "earth", earth: "water", water: "fire", fire: "metal", metal: "wood" };

const ELEMENT_NAME: Record<ElementKey, string> = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };

// 旺相休囚死系数
export function seasonCoefficient(command: ElementKey, el: ElementKey): number {
  if (el === command) return 1.5;                 // 旺
  if (GENERATES[command] === el) return 1.2;      // 相
  if (GENERATES[el] === command) return 0.9;      // 休
  if (OVERCOMES[el] === command) return 0.7;      // 囚
  return 0.6;                                     // 死
}

export function seasonPhase(command: ElementKey, el: ElementKey): "旺" | "相" | "休" | "囚" | "死" {
  if (el === command) return "旺";
  if (GENERATES[command] === el) return "相";
  if (GENERATES[el] === command) return "休";
  if (OVERCOMES[el] === command) return "囚";
  return "死";
}

// 阳干长生地
const CHANG_SHENG: Record<string, string> = { 甲: "亥", 丙: "寅", 戊: "寅", 庚: "巳", 壬: "申" };
// 五行墓库
const TOMB: Partial<Record<ElementKey, string>> = { wood: "未", fire: "戌", metal: "丑", water: "辰" };

const SIX_HE: [string, string, ElementKey][] = [
  ["子", "丑", "earth"], ["寅", "亥", "wood"], ["卯", "戌", "fire"],
  ["辰", "酉", "metal"], ["巳", "申", "water"], ["午", "未", "fire"], // 午未合火（已拍板）
];
const SIX_CHONG: [string, string][] = [["子", "午"], ["丑", "未"], ["寅", "申"], ["卯", "酉"], ["辰", "戌"], ["巳", "亥"]];
const TRIOS: { type: "三合" | "三会"; branches: [string, string, string]; element: ElementKey; peak: string }[] = [
  { type: "三会", branches: ["亥", "子", "丑"], element: "water", peak: "子" },
  { type: "三会", branches: ["寅", "卯", "辰"], element: "wood", peak: "卯" },
  { type: "三会", branches: ["巳", "午", "未"], element: "fire", peak: "午" },
  { type: "三会", branches: ["申", "酉", "戌"], element: "metal", peak: "酉" },
  { type: "三合", branches: ["申", "子", "辰"], element: "water", peak: "子" },
  { type: "三合", branches: ["亥", "卯", "未"], element: "wood", peak: "卯" },
  { type: "三合", branches: ["寅", "午", "戌"], element: "fire", peak: "午" },
  { type: "三合", branches: ["巳", "酉", "丑"], element: "metal", peak: "酉" },
];
const XING_GROUPS: [string, string][] = [["寅", "巳"], ["巳", "申"], ["寅", "申"], ["丑", "戌"], ["戌", "未"], ["丑", "未"], ["子", "卯"]];
const SELF_XING = new Set(["辰", "午", "酉", "亥"]);
const HAI: [string, string][] = [["子", "未"], ["丑", "午"], ["寅", "巳"], ["卯", "辰"], ["申", "亥"], ["酉", "戌"]];
const STEM_HE: [string, string, ElementKey][] = [
  ["甲", "己", "earth"], ["乙", "庚", "metal"], ["丙", "辛", "water"], ["丁", "壬", "wood"], ["戊", "癸", "fire"],
];

const PILLAR_LABEL = ["年", "月", "日", "时"];
const HIDDEN_BASE = [100, 50, 30];
const HIDDEN_LAYER = ["本气", "中气", "余气"];
const STEM_BASE = 50;

// 距离衰减：紧贴 1.0，隔一柱 0.5，隔两柱 0.25
function distFactor(i: number, j: number): number {
  const d = Math.abs(i - j);
  return d <= 1 ? 1 : d === 2 ? 0.5 : 0.25;
}

interface BranchState {
  zhi: string;
  availability: number;
  conversions: { to: ElementKey; ratio: number }[];
  inFullTrio: boolean;
  inAnyCombo: boolean;
}

interface StemState { gan: string; availability: number; conversion: { to: ElementKey; ratio: number } | null }

// ② 合冲刑害预处理：产出每支/每干的可用系数与转化记录（导出以便单测）
export function preprocessInteractions(pillars: PillarGZ[], command: ElementKey): {
  branches: BranchState[];
  stems: StemState[];
  structures: StructureRecord[];
} {
  const branches: BranchState[] = pillars.map((p) => ({
    zhi: p.zhi, availability: 1, conversions: [], inFullTrio: false, inAnyCombo: false,
  }));
  const stems: StemState[] = pillars.map((p) => ({ gan: p.gan, availability: 1, conversion: null }));
  const structures: StructureRecord[] = [];
  const zhis = pillars.map((p) => p.zhi);
  const stemChars = pillars.map((p) => p.gan);

  // 三会 / 三合（全局）：三支齐，成员支部分转化为局五行
  for (const trio of TRIOS) {
    const present = trio.branches.filter((b) => zhis.includes(b));
    if (present.length === 3) {
      const positions = branches.flatMap((b, i) => (trio.branches.includes(b.zhi) && !b.inFullTrio ? [i] : []));
      if (positions.length < 3) continue;
      const monthInvolved = positions.includes(1);
      const ratio = monthInvolved ? 0.7 : 0.5;
      positions.forEach((i) => {
        branches[i].conversions.push({ to: trio.element, ratio });
        branches[i].inFullTrio = true;
        branches[i].inAnyCombo = true;
      });
      structures.push({
        type: trio.type, detail: `${trio.branches.join("")}${trio.type}${ELEMENT_NAME[trio.element]}局`,
        positions, effect: `成员支 ${Math.round(ratio * 100)}% 能量转化为${ELEMENT_NAME[trio.element]}`,
      });
    } else if (present.length === 2 && present.includes(trio.peak)) {
      // 半合/半会：须含旺支；若两支本身构成六合（子丑、午未），首论六合，不作半会
      const [b1, b2] = present;
      if (SIX_HE.some(([x, y]) => (b1 === x && b2 === y) || (b1 === y && b2 === x))) continue;
      const p1 = branches.findIndex((b) => b.zhi === b1 && !b.inFullTrio);
      const p2 = branches.findIndex((b, i) => b.zhi === b2 && !b.inFullTrio && i !== p1);
      if (p1 < 0 || p2 < 0) continue;
      const ratio = 0.25 * distFactor(p1, p2);
      [p1, p2].forEach((i) => {
        branches[i].conversions.push({ to: trio.element, ratio });
        branches[i].inAnyCombo = true;
      });
      structures.push({
        type: trio.type === "三合" ? "半合" : "半会", detail: `${b1}${b2}${trio.type === "三合" ? "半合" : "半会"}${ELEMENT_NAME[trio.element]}`,
        positions: [p1, p2], effect: `两支 ${Math.round(ratio * 100)}% 能量转向${ELEMENT_NAME[trio.element]}`,
      });
    }
  }

  // 六合：化神得月令或透干则化，否则合绊
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (branches[i].inFullTrio || branches[j].inFullTrio) continue;
      const pair = SIX_HE.find(([a, b]) => (zhis[i] === a && zhis[j] === b) || (zhis[i] === b && zhis[j] === a));
      if (!pair) continue;
      const hua = pair[2];
      const factor = distFactor(i, j);
      const canHua = hua === command || stemChars.some((g) => STEM_ELEMENT[g] === hua);
      if (canHua) {
        const ratio = 0.6 * factor;
        [i, j].forEach((k) => { branches[k].conversions.push({ to: hua, ratio }); branches[k].inAnyCombo = true; });
        structures.push({ type: "六合化", detail: `${zhis[i]}${zhis[j]}六合化${ELEMENT_NAME[hua]}`, positions: [i, j], effect: `两支 ${Math.round(ratio * 100)}% 能量转为${ELEMENT_NAME[hua]}` });
      } else {
        const loss = 0.25 * factor;
        [i, j].forEach((k) => { branches[k].availability *= 1 - loss; branches[k].inAnyCombo = true; });
        structures.push({ type: "六合绊", detail: `${zhis[i]}${zhis[j]}六合（合而不化）`, positions: [i, j], effect: `两支互相牵制，可用性 ×${(1 - loss).toFixed(2)}` });
      }
    }
  }

  // 六冲：旺者轻伤、衰者重伤；有合会在身则冲力减半（贪合忘冲）；
  // 众冲全额叠加（已拍板）：多支夹冲伤势累乘，可将根冲拔（见 findBestRoot 的活根阈值）
  const chongedPairs = new Set<string>();
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const hit = SIX_CHONG.find(([a, b]) => (zhis[i] === a && zhis[j] === b) || (zhis[i] === b && zhis[j] === a));
      if (!hit) continue;
      // 土库朋冲（辰戌、丑未）：土逢冲愈旺，库门冲开不损反旺（2026-07-03 用户拍板）
      if (COMMAND_ELEMENT[zhis[i]] === "earth" && COMMAND_ELEMENT[zhis[j]] === "earth") {
        branches[i].availability *= 1.1;
        branches[j].availability *= 1.1;
        chongedPairs.add(`${i}-${j}`);
        structures.push({
          type: "六冲", detail: `${zhis[i]}${zhis[j]}土库朋冲`, positions: [i, j],
          effect: "土逢冲愈旺：库门冲开，两支土气 ×1.10，不作折损",
        });
        continue;
      }
      const factor = distFactor(i, j);
      const coefI = seasonCoefficient(command, COMMAND_ELEMENT[zhis[i]]);
      const coefJ = seasonCoefficient(command, COMMAND_ELEMENT[zhis[j]]);
      const mult = (pos: number, own: number, other: number) => {
        const base = own > other ? 0.85 : own < other ? 0.6 : 0.75;
        const comboSoften = branches[pos].inAnyCombo ? 0.5 : 1;
        return 1 - (1 - base) * factor * comboSoften;
      };
      branches[i].availability *= mult(i, coefI, coefJ);
      branches[j].availability *= mult(j, coefJ, coefI);
      chongedPairs.add(`${i}-${j}`);
      structures.push({
        type: "六冲", detail: `${zhis[i]}${zhis[j]}${PILLAR_LABEL[i]}${PILLAR_LABEL[j]}相冲`, positions: [i, j],
        effect: `${coefI === coefJ ? "两败俱伤" : coefI > coefJ ? `${zhis[i]}旺${zhis[j]}衰，${zhis[j]}伤重` : `${zhis[j]}旺${zhis[i]}衰，${zhis[i]}伤重`}${factor < 1 ? "（隔位，冲力衰减）" : ""}${branches[i].inAnyCombo || branches[j].inAnyCombo ? "（有合在身，冲力减半）" : ""}`,
      });
    }
  }

  // 刑 / 害：轻折损，主要作叙事标签；冲刑同对不叠罚（寅申、丑未既冲且刑，首论冲）
  const applyMinor = (type: "三刑" | "自刑" | "相害", i: number, j: number, name: string) => {
    if (chongedPairs.has(`${i}-${j}`)) {
      structures.push({ type, detail: name, positions: [i, j], effect: "与冲同对，不另折损（仅作叙事标签）" });
      return;
    }
    // 土库相刑（丑戌未之间）：刑开库气，不作折损（土越刑越旺，同朋冲逻辑）
    if (type === "三刑" && COMMAND_ELEMENT[zhis[i]] === "earth" && COMMAND_ELEMENT[zhis[j]] === "earth") {
      structures.push({ type, detail: name, positions: [i, j], effect: "土库相刑，刑开库气，不作折损" });
      return;
    }
    const loss = 0.1 * distFactor(i, j);
    branches[i].availability *= 1 - loss;
    branches[j].availability *= 1 - loss;
    structures.push({ type, detail: name, positions: [i, j], effect: `两支可用性 ×${(1 - loss).toFixed(2)}` });
  };
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (XING_GROUPS.some(([a, b]) => (zhis[i] === a && zhis[j] === b) || (zhis[i] === b && zhis[j] === a))) {
        applyMinor("三刑", i, j, `${zhis[i]}${zhis[j]}相刑`);
      } else if (zhis[i] === zhis[j] && SELF_XING.has(zhis[i])) {
        applyMinor("自刑", i, j, `${zhis[i]}${zhis[j]}自刑`);
      }
      if (HAI.some(([a, b]) => (zhis[i] === a && zhis[j] === b) || (zhis[i] === b && zhis[j] === a))) {
        applyMinor("相害", i, j, `${zhis[i]}${zhis[j]}相害`);
      }
    }
  }

  // 天干五合（只论紧贴）：化从严；涉及日主则日主不化不绊，仅对方轻减
  for (let i = 0; i < 3; i++) {
    const j = i + 1;
    const pair = STEM_HE.find(([a, b]) => (stemChars[i] === a && stemChars[j] === b) || (stemChars[i] === b && stemChars[j] === a));
    if (!pair) continue;
    const hua = pair[2];
    if (i === 2 || j === 2) {
      const other = i === 2 ? j : i;
      stems[other].availability *= 0.9;
      structures.push({ type: "日主干合", detail: `日主${stemChars[2]}与${PILLAR_LABEL[other]}干${stemChars[other]}相合`, positions: [i, j], effect: `日主不化不绊，${stemChars[other]}可用性 ×0.90` });
      continue;
    }
    const strongRoot = pillars.some((p) => STEM_ELEMENT[BRANCH_HIDDEN[p.zhi][0]] === hua);
    if (hua === command || strongRoot) {
      [i, j].forEach((k) => { stems[k].conversion = { to: hua, ratio: 0.6 }; });
      structures.push({ type: "干合化", detail: `${stemChars[i]}${stemChars[j]}合化${ELEMENT_NAME[hua]}`, positions: [i, j], effect: `两干 60% 能量转为${ELEMENT_NAME[hua]}` });
    } else {
      [i, j].forEach((k) => { stems[k].availability *= 0.8; });
      structures.push({ type: "干合绊", detail: `${stemChars[i]}${stemChars[j]}相合（合而不化）`, positions: [i, j], effect: `两干互相牵绊，可用性 ×0.80` });
    }
  }

  branches.forEach((b) => { b.availability = Math.max(b.availability, 0.3); });
  return { branches, stems, structures };
}

// 活根阈值：根支被冲绊至此可用性以下即视为「根拔」——残余能量照算，
// 但不再阻挡从格判定、不再满足「身强须有根」（众冲可拔根，冲致从格成立）
export const ROOT_ALIVE_THRESHOLD = 0.45;

// ④ 通根：返回天干在全盘的最佳根（导出以便单测）
// 会入局折根（2026-07-04 拍板·方案A 线性折减）：根所在支若处于三会/三合成局、且日主五行正被
// 转出为局五行，则该根的有效可用性按转化率线性折减——庚金 70% 会入火局，其根有效可用性 ×0.3，
// 跌破活根线即拔根。这样巳午未三会火局中「巳藏庚」不再撑起辛金的从格否决。
export function findBestRoot(
  gan: string,
  branchStates: { zhi: string; availability: number; conversions?: { to: ElementKey; ratio: number }[]; inFullTrio?: boolean }[],
): {
  tier: "禄刃" | "长生" | "中余气" | "墓库" | null;
  multiplier: number;
  branch: string | null;
  alive: boolean;
} {
  const el = STEM_ELEMENT[gan];
  let best: { tier: "禄刃" | "长生" | "中余气" | "墓库"; mult: number; branch: string } | null = null;
  let anyAlive = false;
  // 根的有效可用性：该支成局且把日主五行转走时，按转化率折减（方案A 线性）
  const effAvail = (b: { availability: number; conversions?: { to: ElementKey; ratio: number }[]; inFullTrio?: boolean }) => {
    const trioEl = b.inFullTrio ? b.conversions?.[0]?.to : undefined;
    if (trioEl && trioEl !== el && b.conversions?.length) {
      const convAway = Math.min(b.conversions.reduce((sum, c) => sum + c.ratio, 0), 0.8);
      return b.availability * (1 - convAway);
    }
    return b.availability;
  };
  // 按「打折后的有效乘数」取最佳根（被拔的禄刃可能不如完好的余气）；活根看全部根
  const consider = (tier: "禄刃" | "长生" | "中余气" | "墓库", base: number, branch: string, avail: number) => {
    const mult = 1 + (base - 1) * avail;
    if (!best || mult > best.mult) best = { tier, mult, branch };
    if (avail >= ROOT_ALIVE_THRESHOLD) anyAlive = true;
  };
  for (const b of branchStates) {
    const hidden = BRANCH_HIDDEN[b.zhi];
    const av = effAvail(b);
    if (STEM_ELEMENT[hidden[0]] === el) consider("禄刃", 1.3, b.zhi, av);
    if (YANG_STEMS.has(gan) && CHANG_SHENG[gan] === b.zhi) consider("长生", 1.15, b.zhi, av);
    if (hidden.slice(1).some((h) => STEM_ELEMENT[h] === el)) consider("中余气", 1.1, b.zhi, av);
    if (TOMB[el] === b.zhi) consider("墓库", 1.05, b.zhi, av);
  }
  if (!best) return { tier: null, multiplier: 0.3, branch: null, alive: false };
  const found = best as { tier: "禄刃" | "长生" | "中余气" | "墓库"; mult: number; branch: string };
  return { tier: found.tier, multiplier: found.mult, branch: found.branch, alive: anyAlive };
}

export function computeEnergy(pillars: PillarGZ[]): EnergyResult {
  if (pillars.length !== 4) throw new Error("computeEnergy 需要完整四柱");
  const command = COMMAND_ELEMENT[pillars[1].zhi];
  const { branches, stems, structures } = preprocessInteractions(pillars, command);
  const raw: Elements = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const trace: TraceRecord[] = [];
  const stemChars = pillars.map((p) => p.gan);

  // 天干能量：基础 × 可用性 × 通根 × 季节
  stems.forEach((s, i) => {
    const el = STEM_ELEMENT[s.gan];
    const root = findBestRoot(s.gan, branches);
    const noteRoot = root.tier ? `${root.tier}根于${root.branch}` : "虚浮无根";
    const convRatio = s.conversion ? s.conversion.ratio : 0;
    const ownPoints = STEM_BASE * s.availability * root.multiplier * seasonCoefficient(command, el) * (1 - convRatio);
    raw[el] += ownPoints;
    trace.push({ source: `${PILLAR_LABEL[i]}干${s.gan}`, element: el, points: Math.round(ownPoints * 10) / 10, note: `${noteRoot}，${seasonPhase(command, el)}位` });
    if (s.conversion) {
      const convPoints = STEM_BASE * s.availability * seasonCoefficient(command, s.conversion.to) * convRatio;
      raw[s.conversion.to] += convPoints;
      trace.push({ source: `${PILLAR_LABEL[i]}干${s.gan}`, element: s.conversion.to, points: Math.round(convPoints * 10) / 10, note: `合化转出` });
    }
  });

  // 地支藏干能量：基础 × 可用性 × 季节；本气透干 ×1.2；成局部分转化
  branches.forEach((b, i) => {
    const hidden = BRANCH_HIDDEN[b.zhi];
    const totalConv = Math.min(b.conversions.reduce((s, c) => s + c.ratio, 0), 0.8);
    hidden.forEach((h, k) => {
      const el = STEM_ELEMENT[h];
      const touGan = k === 0 && stemChars.includes(h) ? 1.2 : 1;
      const base = HIDDEN_BASE[k] * b.availability * touGan;
      const ownPoints = base * (1 - totalConv) * seasonCoefficient(command, el);
      raw[el] += ownPoints;
      trace.push({ source: `${PILLAR_LABEL[i]}支${b.zhi}·${HIDDEN_LAYER[k]}${h}`, element: el, points: Math.round(ownPoints * 10) / 10, note: `${seasonPhase(command, el)}位${touGan > 1 ? "，透干" : ""}${b.availability < 1 ? `，可用性 ${b.availability.toFixed(2)}` : ""}` });
      b.conversions.forEach((c) => {
        const share = totalConv > 0 ? c.ratio / b.conversions.reduce((s, x) => s + x.ratio, 0) : 0;
        const convPoints = base * totalConv * share * seasonCoefficient(command, c.to);
        if (convPoints > 0) {
          raw[c.to] += convPoints;
          trace.push({ source: `${PILLAR_LABEL[i]}支${b.zhi}·${HIDDEN_LAYER[k]}${h}`, element: c.to, points: Math.round(convPoints * 10) / 10, note: "合会局转化" });
        }
      });
    });
  });

  // ⑤ 生克传导与日主强弱
  const dayStem = pillars[2].gan;
  const dayEl = STEM_ELEMENT[dayStem];
  const yinEl = (Object.keys(GENERATES) as ElementKey[]).find((k) => GENERATES[k] === dayEl)!;
  const bijie = raw[dayEl];
  const yin = raw[yinEl];
  // 母旺子衰上限：印超过比劫党 2 倍的部分传导率降为 30%
  const yinCap = 2 * bijie;
  const effectiveYin = 0.6 * Math.min(yin, yinCap) + 0.3 * Math.max(0, yin - yinCap);
  const allies = bijie + effectiveYin;
  const total = (Object.keys(raw) as ElementKey[]).reduce((s, k) => s + raw[k], 0);
  // 异党 = 食伤+财+官杀；印未传导的部分既不助身也不算敌
  const opponents = total - bijie - yin;
  const ratio = allies / (allies + opponents);
  const gotSeason = seasonCoefficient(command, dayEl) >= 1.2;
  const dayRoot = findBestRoot(dayStem, branches);
  // 有根且根未被冲拔才算「有根」——众冲拔根后不再阻挡从格（冲致从格）
  const rooted = dayRoot.tier !== null && dayRoot.alive;

  // 从格否决条件：从格容不得异物——地支本气是最硬的「异物」；被冲拔的支不算。
  // 三合/三会成局的成员支随局论（2026-07-03 拍板）：格局身份以局五行计，
  // 不以本气计（能量仍按转化率照常计入），如巳午未局中的未不作土论
  const aliveBranches = branches.filter((b) => b.availability >= ROOT_ALIVE_THRESHOLD);
  const branchMainEls = aliveBranches.map((b) =>
    b.inFullTrio && b.conversions[0] ? b.conversions[0].to : STEM_ELEMENT[BRANCH_HIDDEN[b.zhi][0]],
  );
  const allyEls = new Set<ElementKey>([dayEl, yinEl]);
  const alliesHaveMainRoot = branchMainEls.some((el) => allyEls.has(el));
  const opponentsHaveMainRoot = branchMainEls.some((el) => !allyEls.has(el));
  // 印比透干且有活根亦不从（2026-07-03 用户依「庚午 辛巳 壬寅 壬寅」裁定）：
  // 印透通根则日主有救——与「杀印相生不从」同理；只查地支本气会漏掉透干的同党
  const allyStemAlive = pillars.some((pl, i) =>
    i !== 2 && allyEls.has(STEM_ELEMENT[pl.gan]) && findBestRoot(pl.gan, branches).alive,
  );

  let level: DayMasterStrength["level"];
  if (!rooted && ratio <= 0.2 && !alliesHaveMainRoot && !allyStemAlive) level = "从弱";
  // 从强线 90%（2026-07-03 三次拍板定稿：配合「会局成员随局论」放宽否决后，
  // 线上调至 90%，80~90 区间由置信机制标记为「趋近从强」）
  else if (ratio >= 0.9 && gotSeason && !opponentsHaveMainRoot) level = "从强";
  // 无根不言强：日主虚浮时即便党势占优也最高判中和（印重身轻不作身强）
  else if (ratio >= 0.55 && rooted) level = "身强";
  // 中和带 [30%, 55%)（2026-07-03 拍板扩宽）：此量表异党天生三家、同党两家，
  // 经验中位数为 35%，中和取中点两翼而非 50% 附近；原「45%+得令即身强」
  // 条款取消（得令已计入季节系数，属双重计分）
  else if (ratio >= 0.3) level = "中和";
  else level = "身弱";

  // 边界只在「跨过去会改判」时才构成不确定性：从格已被硬否决的边界不参与置信度计算
  const congQiangPossible = gotSeason && !opponentsHaveMainRoot;
  const boundaries = [0.3, 0.55];
  if (!rooted && !alliesHaveMainRoot && !allyStemAlive) boundaries.push(0.2);
  if (congQiangPossible) boundaries.push(0.9);
  const nearest = Math.min(...boundaries.map((b) => Math.abs(ratio - b)));
  let confidence: DayMasterStrength["confidence"] = nearest < 0.04 ? "low" : nearest < 0.08 ? "medium" : "high";
  // 趋近从强带（2026-07-03 拍板）：从强可能且比率落在 80~90 之间，置信至多 medium
  if (congQiangPossible && ratio >= 0.8 && ratio < 0.9 && confidence === "high") confidence = "medium";

  const shiShangEl = GENERATES[dayEl];
  const caiEl = OVERCOMES[dayEl];
  const guanEl = (Object.keys(OVERCOMES) as ElementKey[]).find((k) => OVERCOMES[k] === dayEl)!;
  let favorable: ElementKey[];
  let unfavorable: ElementKey[];
  if (level === "身弱" || level === "从强") { favorable = [yinEl, dayEl]; unfavorable = [caiEl, guanEl, shiShangEl]; }
  else if (level === "身强") { favorable = [shiShangEl, caiEl, guanEl]; unfavorable = [yinEl, dayEl]; }
  else if (level === "从弱") { favorable = [caiEl, guanEl, shiShangEl]; unfavorable = [yinEl, dayEl]; }
  else { favorable = []; unfavorable = []; }

  const reasons = [
    `月令${pillars[1].zhi}，${ELEMENT_NAME[command]}当令，日主${dayStem}${ELEMENT_NAME[dayEl]}处「${seasonPhase(command, dayEl)}」位${gotSeason ? "（得令）" : "（不得令）"}`,
    dayRoot.tier
      ? dayRoot.alive
        ? `日主${dayRoot.tier}根于${dayRoot.branch}`
        : `日主${dayRoot.tier}根于${dayRoot.branch}，但根支被冲拔（可用性不足 ${ROOT_ALIVE_THRESHOLD}），不作有根论`
      : "日主虚浮无根",
    `比劫党 ${Math.round(bijie)}，印星 ${Math.round(yin)}（有效传导 ${Math.round(effectiveYin)}${yin > yinCap ? "，母旺子衰已封顶" : ""}），异党 ${Math.round(total - bijie - yin)}`,
    `同党占比 ${(ratio * 100).toFixed(1)}%，判「${level}」（置信度 ${confidence}）`,
  ];

  const elementPower = Object.fromEntries(
    (Object.keys(raw) as ElementKey[]).map((k) => [k, Math.round((raw[k] / (total || 1)) * 1000) / 10]),
  ) as Elements;

  return {
    raw: Object.fromEntries((Object.keys(raw) as ElementKey[]).map((k) => [k, Math.round(raw[k] * 10) / 10])) as Elements,
    elementPower,
    dayMaster: {
      stem: dayStem, element: dayEl, score: Math.round(ratio * 1000) / 10,
      level, confidence, gotSeason, rooted, favorable, unfavorable, reasons,
    },
    structures,
    trace,
  };
}

// 适配 Bazi.pillars（lunar-javascript 产物）——只取干支字面
export function computeEnergyFromPillars(pillars: { gan: string; zhi: string }[]): EnergyResult {
  return computeEnergy(pillars.map((p) => ({ gan: p.gan, zhi: p.zhi })));
}
