import type {
  Bazi, BirthInput, Elements, MatchResult, Personality, SocialProfile,
  UserProfile, Zodiac,
  RelationshipAnalysis,
} from "./types";
import { Solar } from "lunar-javascript";

const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const stemElements: (keyof Elements)[] = ["wood", "wood", "fire", "fire", "earth", "earth", "metal", "metal", "water", "water"];
const branchElements: (keyof Elements)[] = ["water", "earth", "wood", "wood", "earth", "fire", "fire", "earth", "metal", "metal", "earth", "water"];

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const pillar = (index: number) => stems[((index % 10) + 10) % 10] + branches[((index % 12) + 12) % 12];

const branchMainStem: Record<string, string> = {
  子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙",
  午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬",
};

function tenGodForStem(dayStem: string, targetStem: string) {
  const dayStemIndex = stems.indexOf(dayStem);
  const targetStemIndex = stems.indexOf(targetStem);
  if (dayStemIndex < 0 || targetStemIndex < 0) return "未知";
  const dayElement = Math.floor(dayStemIndex / 2);
  const targetElement = Math.floor(targetStemIndex / 2);
  const samePolarity = dayStemIndex % 2 === targetStemIndex % 2;
  if (dayElement === targetElement) return samePolarity ? "比肩" : "劫财";
  if ((dayElement + 1) % 5 === targetElement) return samePolarity ? "食神" : "伤官";
  if ((dayElement + 2) % 5 === targetElement) return samePolarity ? "偏财" : "正财";
  if ((targetElement + 2) % 5 === dayElement) return samePolarity ? "七杀" : "正官";
  return samePolarity ? "偏印" : "正印";
}

const luckGodThemes: Record<string, { theme: string; action: string }> = {
  比肩: { theme: "自主与同伴关系", action: "更强调自己的选择，也会重新整理同伴边界" },
  劫财: { theme: "竞争与资源重组", action: "合作、竞争和主导权议题更容易同时出现" },
  食神: { theme: "表达与生活体验", action: "适合把想法做成作品，也更在意生活是否舒展" },
  伤官: { theme: "突破与自我表达", action: "更容易质疑旧规则，主动寻找新的表达出口" },
  偏财: { theme: "机会与流动连接", action: "外部机会、人际流动和快速判断会变得更活跃" },
  正财: { theme: "现实经营与积累", action: "更关注可兑现的结果、稳定投入与长期建设" },
  七杀: { theme: "挑战与快速决断", action: "压力会推着你加快决策，同时考验边界和节奏" },
  正官: { theme: "责任与秩序建立", action: "身份、承诺与规则感会被放到更重要的位置" },
  偏印: { theme: "洞察与路径转向", action: "会更依赖自己的判断，并尝试非标准的解决路径" },
  正印: { theme: "学习与安全支撑", action: "学习、休整、被支持以及内在稳定感更值得经营" },
};

function calculateLuckCycles(birth: BirthInput, dayStem: string): UserProfile["luckCycles"] {
  const solar = Solar.fromYmdHms(birth.year, birth.month, birth.day, birth.hour, birth.minute ?? 0, 0);
  const chart = solar.getLunar().getEightChar();
  chart.setSect(2);
  const yun = chart.getYun(birth.gender === "male" ? 1 : 0, 2);
  const currentYear = new Date().getFullYear();
  const periods: UserProfile["luckCycles"]["periods"] = yun.getDaYun(9).slice(1).map((cycle: {
    getIndex: () => number;
    getGanZhi: () => string;
    getStartYear: () => number;
    getEndYear: () => number;
    getStartAge: () => number;
    getEndAge: () => number;
  }) => {
    const ganZhi = cycle.getGanZhi();
    const stemTenGod = tenGodForStem(dayStem, ganZhi[0]);
    const branchTenGod = tenGodForStem(dayStem, branchMainStem[ganZhi[1]]);
    const stemTheme = luckGodThemes[stemTenGod] ?? { theme: "阶段转换", action: "生活重点会随环境重新排序" };
    const branchTheme = luckGodThemes[branchTenGod] ?? stemTheme;
    return {
      index: cycle.getIndex(),
      ganZhi,
      startYear: cycle.getStartYear(),
      endYear: cycle.getEndYear(),
      startAge: cycle.getStartAge(),
      endAge: cycle.getEndAge(),
      stemTenGod,
      branchTenGod,
      theme: stemTheme.theme,
      analysis: `${stemTenGod}在外显层推动${stemTheme.theme}，${branchTenGod}作为阶段底色；${stemTheme.action}，同时会以“${branchTheme.theme}”的方式落到日常。`,
      isCurrent: currentYear >= cycle.getStartYear() && currentYear <= cycle.getEndYear(),
    };
  });
  const current = periods.find((period) => period.isCurrent);
  const startParts = [
    yun.getStartYear() ? `${yun.getStartYear()}年` : "",
    yun.getStartMonth() ? `${yun.getStartMonth()}个月` : "",
    yun.getStartDay() ? `${yun.getStartDay()}天` : "",
  ].filter(Boolean).join("");
  return {
    direction: yun.isForward() ? "顺排" : "逆排",
    startAgeText: startParts || "出生后不久",
    startDate: yun.getStartSolar().toYmd(),
    currentYear,
    currentAnalysis: current
      ? `现在走到 ${current.ganZhi} 大运（${current.startYear}—${current.endYear}）。${current.analysis}`
      : `首步大运将从 ${periods[0]?.startYear ?? birth.year} 年开始，当前仍在起运前的基础阶段。`,
    periods,
  };
}

export function validateBirth(input: BirthInput): string | null {
  if (![input.year, input.month, input.day, input.hour].every(Number.isInteger)) return "Birth fields must be integers.";
  if (input.year < 1900 || input.year > 2100) return "Year must be between 1900 and 2100.";
  if (input.month < 1 || input.month > 12) return "Month must be between 1 and 12.";
  const days = new Date(input.year, input.month, 0).getDate();
  if (input.day < 1 || input.day > days) return "Day is not valid for the selected month.";
  if (input.hour < 0 || input.hour > 23) return "Hour must be between 0 and 23.";
  if ((input.minute ?? 0) < 0 || (input.minute ?? 0) > 59) return "Minute must be between 0 and 59.";
  return null;
}

export function calculateBazi(birth: BirthInput): Bazi {
  const solar = Solar.fromYmdHms(birth.year, birth.month, birth.day, birth.hour, birth.minute ?? 0, 0);
  const lunar = solar.getLunar();
  const chart = lunar.getEightChar();
  chart.setSect(2);
  const values = [chart.getYear(), chart.getMonth(), chart.getDay(), chart.getTime()] as string[];
  const wuXing = [chart.getYearWuXing(), chart.getMonthWuXing(), chart.getDayWuXing(), chart.getTimeWuXing()] as string[];
  const elements: Elements = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const elementKey: Record<string, keyof Elements> = { 木: "wood", 火: "fire", 土: "earth", 金: "metal", 水: "water" };
  wuXing.join("").split("").forEach((item) => { if (elementKey[item]) elements[elementKey[item]] += 1; });
  const prev = lunar.getPrevJie();
  const next = lunar.getNextJie();
  const details = [
    ["年柱", chart.getYearHideGan(), chart.getYearShiShenZhi(), chart.getYearShiShenGan(), chart.getYearNaYin(), chart.getYearDiShi()],
    ["月柱", chart.getMonthHideGan(), chart.getMonthShiShenZhi(), chart.getMonthShiShenGan(), chart.getMonthNaYin(), chart.getMonthDiShi()],
    ["日柱", chart.getDayHideGan(), chart.getDayShiShenZhi(), "日主", chart.getDayNaYin(), chart.getDayDiShi()],
    ["时柱", chart.getTimeHideGan(), chart.getTimeShiShenZhi(), chart.getTimeShiShenGan(), chart.getTimeNaYin(), chart.getTimeDiShi()],
  ] as [string, string[], string[], string, string, string][];

  return {
    yearPillar: values[0],
    monthPillar: values[1],
    dayPillar: values[2],
    hourPillar: values[3],
    elements,
    lunarDate: lunar.toString(),
    previousSolarTerm: { name: prev.getName(), at: prev.getSolar().toYmdHms() },
    nextSolarTerm: { name: next.getName(), at: next.getSolar().toYmdHms() },
    pillars: details.map(([label, hiddenStems, hiddenTenGods, tenGod, naYin, stage], index) => ({
      label, gan: values[index][0], zhi: values[index][1], hiddenStems, hiddenTenGods,
      tenGod, naYin, wuXing: wuXing[index], stage,
    })),
  };
}

export function calculateZodiac({ month, day }: BirthInput): Zodiac {
  const signs: [Zodiac, number, number][] = [
    ["Capricorn", 1, 20], ["Aquarius", 2, 19], ["Pisces", 3, 21],
    ["Aries", 4, 20], ["Taurus", 5, 21], ["Gemini", 6, 21],
    ["Cancer", 7, 23], ["Leo", 8, 23], ["Virgo", 9, 23],
    ["Libra", 10, 23], ["Scorpio", 11, 22], ["Sagittarius", 12, 22],
  ];
  const entry = signs.find(([, m, cutoff]) => month === m && day < cutoff);
  if (entry) return entry[0];
  return signs[month % 12][0];
}

export function buildPersonality(elements: Elements, zodiac: Zodiac): Personality {
  const p = {
    extroversion: 42 + elements.fire * 9 + elements.wood * 3 - elements.water * 2,
    stability: 45 + elements.earth * 8 + elements.metal * 5 - elements.water * 5,
    control: 38 + elements.metal * 10 + elements.earth * 2 - elements.wood * 2,
    emotion: 40 + elements.water * 9 + elements.fire * 5,
  };
  const fire = ["Aries", "Leo", "Sagittarius"];
  const water = ["Cancer", "Scorpio", "Pisces"];
  const air = ["Gemini", "Libra", "Aquarius"];
  const earth = ["Taurus", "Virgo", "Capricorn"];
  if (fire.includes(zodiac)) p.extroversion += 10;
  if (water.includes(zodiac)) p.emotion += 10;
  if (air.includes(zodiac)) p.extroversion += 10; // social tendency maps to observable extroversion
  if (earth.includes(zodiac)) p.stability += 10;
  return {
    extroversion: clamp(p.extroversion),
    stability: clamp(p.stability),
    control: clamp(p.control),
    emotion: clamp(p.emotion),
  };
}

export function buildSocialProfile(p: Personality): SocialProfile {
  const attachment_style = p.emotion >= 70
    ? "anxious"
    : p.stability >= 68
      ? "secure"
      : p.control >= 68
        ? "avoidant"
        : "secure";
  return {
    communication_need: p.extroversion >= 70 || p.emotion >= 75 ? "high" : p.extroversion < 45 ? "low" : "medium",
    conflict_tolerance: p.stability >= 60 || p.control >= 65 ? "high" : "low",
    relationship_speed: p.emotion >= 75 && p.extroversion >= 55 ? "fast" : p.control >= 70 ? "slow" : "medium",
    attachment_style,
  };
}

export function analyzeBirth(birth: BirthInput): UserProfile {
  const bazi = calculateBazi(birth);
  const luckCycles = calculateLuckCycles(birth, bazi.dayPillar[0]);
  const zodiac = calculateZodiac(birth);
  const personality = buildPersonality(bazi.elements, zodiac);
  const socialProfile = buildSocialProfile(personality);
  const strongest = (Object.entries(bazi.elements) as [keyof Elements, number][]).sort((a, b) => b[1] - a[1])[0][0];
  const elementName = ({ wood: "木", fire: "火", earth: "土", metal: "金", water: "水" } as const)[strongest];
  const zodiacName = ({
    Aries: "白羊座", Taurus: "金牛座", Gemini: "双子座", Cancer: "巨蟹座",
    Leo: "狮子座", Virgo: "处女座", Libra: "天秤座", Scorpio: "天蝎座",
    Sagittarius: "射手座", Capricorn: "摩羯座", Aquarius: "水瓶座", Pisces: "双鱼座",
  } as const)[zodiac];
  const godNames = ["正官", "七杀", "正印", "偏印", "正财", "偏财", "比肩", "劫财", "食神", "伤官"] as const;
  const godCounts = Object.fromEntries(godNames.map((name) => [name, 0])) as Record<typeof godNames[number], number>;
  const branchWeights = [
    [8, 5, 2],
    [20, 10, 5],
    [8, 5, 2],
    [10, 6, 4],
  ];
  const stemWeights = [5, 5, 0, 5];
  const tenGodSources: UserProfile["tenGodSources"] = [];
  bazi.pillars.forEach((pillar, pillarIndex) => {
    if (pillar.tenGod !== "日主" && pillar.tenGod in godCounts) {
      const weight = stemWeights[pillarIndex];
      godCounts[pillar.tenGod as keyof typeof godCounts] += weight;
      tenGodSources.push({ pillar: pillar.label, layer: "天干", god: pillar.tenGod, weight });
    }
    pillar.hiddenTenGods.forEach((god, hiddenIndex) => {
      if (!(god in godCounts)) return;
      const layer = hiddenIndex === 0 ? "本气" : hiddenIndex === 1 ? "中气" : "余气";
      const weight = branchWeights[pillarIndex][hiddenIndex] ?? 0;
      godCounts[god as keyof typeof godCounts] += weight;
      tenGodSources.push({ pillar: pillar.label, layer, god, weight });
    });
  });
  godNames.forEach((name) => { godCounts[name] = Math.round(godCounts[name] * 100) / 100; });
  const totalGodWeight = Object.values(godCounts).reduce((sum, value) => sum + value, 0);
  const tenGodGroups = [
    { key: "authority", label: "秩序与边界", members: "正官 · 七杀", gods: ["正官", "七杀"], interpretation: "官杀代表你如何面对规则、责任和关系边界。正官偏向稳定秩序，七杀偏向快速决断与压力反应。" },
    { key: "resource", label: "内在安全", members: "正印 · 偏印", gods: ["正印", "偏印"], interpretation: "印星代表吸收信息、获得支持和建立安全感的方式。正印重稳定照顾，偏印重独立理解与非标准思考。" },
    { key: "wealth", label: "关系投入", members: "正财 · 偏财", gods: ["正财", "偏财"], interpretation: "财星代表对关系与资源的实际投入。正财重持续兑现，偏财重流动连接、机会感与社交慷慨。" },
    { key: "peer", label: "同伴与自主", members: "比肩 · 劫财", gods: ["比肩", "劫财"], interpretation: "比劫代表自我立场和同伴关系。比肩重平等独立，劫财重竞争、行动联盟与强烈参与感。" },
    { key: "output", label: "表达与创造", members: "食神 · 伤官", gods: ["食神", "伤官"], interpretation: "食伤代表情绪与想法如何向外流动。食神偏温和分享，伤官偏直接表达、质疑与打破惯例。" },
  ];
  const tenGodAnalysis = tenGodGroups.map((group) => {
    const count = group.gods.reduce((sum, god) => sum + godCounts[god as keyof typeof godCounts], 0);
    return { ...group, score: clamp(totalGodWeight ? count / totalGodWeight * 100 : 0), count: Math.round(count * 100) / 100 };
  });
  const zodiacGroup = ["Aries", "Leo", "Sagittarius"].includes(zodiac) ? "火象"
    : ["Cancer", "Scorpio", "Pisces"].includes(zodiac) ? "水象"
      : ["Gemini", "Libra", "Aquarius"].includes(zodiac) ? "风象" : "土象";
  const expressiveness = clamp(34 + bazi.elements.wood * 10 + bazi.elements.fire * 5 + (zodiacGroup === "风象" ? 10 : 0));
  const empathy = clamp(30 + bazi.elements.water * 10 + personality.emotion * .28);
  const initiative = clamp(34 + bazi.elements.fire * 10 + bazi.elements.metal * 4 + (zodiacGroup === "火象" ? 10 : 0));
  const adaptability = clamp(50 + bazi.elements.water * 6 + bazi.elements.wood * 4 - personality.control * .12);
  const relationScores = {
    extroversion: clamp(personality.extroversion * .4 + tenGodAnalysis[4].score * .4 + tenGodAnalysis[2].score * .2),
    stability: clamp(personality.stability * .4 + tenGodAnalysis[1].score * .35 + tenGodAnalysis[0].score * .25),
    control: clamp(personality.control * .35 + tenGodAnalysis[0].score * .45 + tenGodAnalysis[3].score * .2),
    emotion: clamp(personality.emotion * .45 + tenGodAnalysis[1].score * .3 + tenGodAnalysis[4].score * .25),
    expressiveness: clamp(expressiveness * .35 + tenGodAnalysis[4].score * .65),
    empathy: clamp(empathy * .4 + tenGodAnalysis[1].score * .6),
    initiative: clamp(initiative * .35 + tenGodAnalysis[2].score * .35 + tenGodAnalysis[3].score * .3),
    adaptability: clamp(adaptability * .4 + tenGodAnalysis[1].score * .3 + tenGodAnalysis[4].score * .3),
  };
  const g = (name: typeof godNames[number]) => Math.round(godCounts[name] / 13.6 * 100) / 100;
  const level = (score: number) => score >= 82 ? "强倾向" : score >= 65 ? "偏高" : score >= 45 ? "中段" : score >= 28 ? "偏低" : "弱倾向";
  const deep = (
    key: string, label: string, value: number, high: string, mid: string, low: string,
    evidence: string[], note: string,
  ) => {
    const score = clamp(value);
    return { key, label, score, level: level(score), summary: score >= 68 ? high : score >= 42 ? mid : low, evidence, note };
  };
  const deepBase = [
    deep("ambition", "野心与进取", 30 + g("七杀") * 10 + g("偏财") * 6 + g("伤官") * 5 + bazi.elements.fire * 3,
      "目标感强，越有挑战越容易被激活；不太满足于只维持现状。",
      "有上进心，但会先确认投入是否值得，不会为了竞争本身消耗自己。",
      "更看重稳定体验与生活质量，外部竞争不是主要驱动力。",
      [`七杀 ${g("七杀")}×10：压力驱动与突破欲`, `偏财 ${g("偏财")}×6：机会敏感度`, `伤官 ${g("伤官")}×5 + 火 ${bazi.elements.fire}×3：主动突破`],
      "高分不等于事业成就，只表示更容易被目标、难度和机会调动。"),
    deep("vigilance", "关系警觉", 26 + g("偏印") * 11 + g("七杀") * 7 + bazi.elements.water * 4 - g("食神") * 3,
      "进入关系时会观察细节、验证前后是否一致；容易先保留，再交付信任。",
      "既会感受氛围，也愿意听对方解释，警觉与开放大致平衡。",
      "更倾向先相信善意，不会持续分析对方每个信号。",
      [`偏印 ${g("偏印")}×11：独立解读与反复思考`, `七杀 ${g("七杀")}×7：风险扫描`, `水 ${bazi.elements.water}×4 − 食神 ${g("食神")}×3：敏感与松弛的拉扯`],
      "这里描述的是防御性警觉，不等同于病理性的猜疑。"),
    deep("autonomy", "自主与空间需求", 30 + g("比肩") * 10 + g("劫财") * 7 + g("偏印") * 6 + bazi.elements.metal * 3 - g("正印") * 2,
      "即使在亲密关系中也需要保留独立决定与个人空间，被持续追问容易产生退缩。",
      "能在共同生活和个人空间之间切换，关键是边界是否被尊重。",
      "更享受高度共享的关系模式，倾向把重要决定放在两个人之间讨论。",
      [`比肩 ${g("比肩")}×10：独立立场`, `劫财 ${g("劫财")}×7 + 偏印 ${g("偏印")}×6：自主行动与内部消化`, `金 ${bazi.elements.metal}×3 − 正印 ${g("正印")}×2：边界与依赖修正`],
      "自主需求高不代表回避亲密，而是需要以自主选择的方式靠近。"),
    deep("social_openness", "社交开放度", 28 + g("偏财") * 9 + g("食神") * 7 + g("伤官") * 5 + bazi.elements.fire * 3 - g("偏印") * 3,
      "容易对新人、新场景产生兴趣，关系网络通常较流动，也愿意主动释放友好信号。",
      "在熟悉环境中开放，在陌生或高风险场景会先观察再参与。",
      "社交入口较窄，更偏好少数稳定关系，不急于扩大连接。",
      [`偏财 ${g("偏财")}×9：流动连接`, `食神 ${g("食神")}×7 + 伤官 ${g("伤官")}×5：分享与话题表达`, `火 ${bazi.elements.fire}×3 − 偏印 ${g("偏印")}×3：外放与保留`],
      "开放度描述连接入口，不等于关系深度或外向程度。"),
    deep("trust_speed", "信任建立速度", 58 + g("正印") * 5 + g("食神") * 4 - g("偏印") * 8 - g("七杀") * 5,
      "较容易接受稳定善意，只要互动一致，关系升温会比较自然。",
      "信任需要几轮稳定互动，会边靠近边验证。",
      "信任建立较慢，需要时间、事实和持续兑现来解除防备。",
      [`正印 ${g("正印")}×5：接受支持`, `食神 ${g("食神")}×4：松弛交流`, `偏印 ${g("偏印")}×−8 + 七杀 ${g("七杀")}×−5：保留与风险验证`],
      "分数越高表示信任越快，不代表判断一定更准确。"),
    deep("dependency", "情感依赖倾向", 28 + g("正印") * 7 + g("正财") * 5 + bazi.elements.water * 4 - g("比肩") * 4,
      "重视稳定回应和持续陪伴，关系状态容易影响日常情绪。",
      "既需要连接也保留个人空间，依赖程度随安全感变化。",
      "自主性较强，即使亲密也需要清晰的个人领域。",
      [`正印 ${g("正印")}×7：被照顾需求`, `正财 ${g("正财")}×5：稳定绑定`, `水 ${bazi.elements.water}×4 − 比肩 ${g("比肩")}×4：依恋与自主`],
      "依赖是连接方式，不直接等同于成熟或不成熟。"),
    deep("responsibility", "承诺与责任感", 34 + g("正官") * 10 + g("正财") * 8 + g("正印") * 4 + bazi.elements.earth * 3,
      "一旦确认关系，会倾向把承诺落到具体行动，不喜欢反复失约。",
      "愿意负责，但需要确认责任边界是公平的。",
      "更重视关系的自然流动，对固定承诺会保持弹性。",
      [`正官 ${g("正官")}×10：责任与规范`, `正财 ${g("正财")}×8：持续投入`, `正印 ${g("正印")}×4 + 土 ${bazi.elements.earth}×3：稳定承接`],
      "高责任感也可能带来过度承担，需要观察是否懂得拒绝。"),
    deep("romance", "浪漫主动性", 28 + g("偏财") * 9 + g("食神") * 7 + g("伤官") * 4 + bazi.elements.fire * 4,
      "愿意制造新鲜体验和表达好感，关系初期通常不缺行动。",
      "有感觉时会主动，但表达方式更看氛围与确定性。",
      "浪漫表达偏含蓄，倾向用陪伴或实际行动代替热烈示爱。",
      [`偏财 ${g("偏财")}×9：社交机会与惊喜`, `食神 ${g("食神")}×7：享受与分享`, `伤官 ${g("伤官")}×4 + 火 ${bazi.elements.fire}×4：热烈表达`],
      "浪漫主动性只描述表达方式，不代表感情深浅。"),
    deep("empathy_deep", "共情与体察", 33 + g("正印") * 7 + g("食神") * 6 + bazi.elements.water * 5 - g("七杀") * 3,
      "容易捕捉语气和情绪变化，常在对方明确表达前就察觉异常。",
      "能够理解情绪，也会保留自己的判断，不容易完全被带走。",
      "更依赖清楚表达和事实信息，不擅长猜测未说出口的需求。",
      [`正印 ${g("正印")}×7：接纳与照顾`, `食神 ${g("食神")}×6：温和共鸣`, `水 ${bazi.elements.water}×5 − 七杀 ${g("七杀")}×3：感受与快速决断`],
      "高共情需要搭配边界，否则容易承担不属于自己的情绪。"),
    deep("resilience", "压力韧性", 33 + g("七杀") * 8 + g("偏印") * 6 + g("比肩") * 5 + bazi.elements.metal * 3,
      "遇到压力时容易迅速收拢注意力，先解决问题再处理情绪。",
      "能承担常规压力，连续不确定性会需要独处恢复。",
      "对高压和冲突较敏感，更适合稳定、可预期的互动环境。",
      [`七杀 ${g("七杀")}×8：危机应对`, `偏印 ${g("偏印")}×6：内部消化`, `比肩 ${g("比肩")}×5 + 金 ${bazi.elements.metal}×3：自我支撑`],
      "韧性高不代表没有情绪，只是更可能延后处理。"),
    deep("conflict_expression", "冲突表达方式", 27 + g("伤官") * 10 + g("劫财") * 6 + bazi.elements.fire * 3 - g("正官") * 2,
      "观点表达直接，遇到不合理之处很难长期沉默。",
      "会表达不同意见，但通常会考虑关系后果。",
      "更擅长委婉沟通，冲突中可能先退让或延后表达。",
      [`伤官 ${g("伤官")}×10：质疑与直言`, `劫财 ${g("劫财")}×6 + 火 ${bazi.elements.fire}×3：表达冲劲`, `正官 ${g("正官")}×−2：规则约束`],
      "锋利度高可以是真诚清晰，也可能在情绪中显得攻击性强。"),
    deep("novelty", "新鲜感需求", 28 + g("偏财") * 8 + g("伤官") * 7 + g("食神") * 5 + bazi.elements.wood * 4 + bazi.elements.fire * 3 - g("正官") * 3,
      "关系需要持续出现新体验、新话题或共同成长，长期重复容易降低投入感。",
      "既需要稳定，也希望偶尔打破惯性；共同计划比单纯刺激更有效。",
      "偏爱熟悉、稳定和可预期的相处方式，重复本身反而能积累安全感。",
      [`偏财 ${g("偏财")}×8 + 伤官 ${g("伤官")}×7：机会与变化`, `食神 ${g("食神")}×5 + 木 ${bazi.elements.wood}×4 + 火 ${bazi.elements.fire}×3：体验欲`, `正官 ${g("正官")}×−3：秩序抑制变化`],
      "新鲜感需求高不等于不稳定，关键是能否在承诺内部创造变化。"),
  ];
  const deepLogicBase: Record<string, { premise: string; counterSignal: string; realWorldCheck: string }> = {
    ambition: { premise: "以七杀作为挑战驱动主信号，偏财表示机会捕捉，伤官与火元素修正主动突破程度。", counterSignal: "正印、正官或土旺会让目标更稳健，可能降低外显的冒险感。", realWorldCheck: "观察遇到困难任务时，是兴奋接手、评估后行动，还是优先维持现状。" },
    vigilance: { premise: "偏印主独立解读，七杀主风险扫描，水元素提高对细微信号的敏感度。", counterSignal: "食神提供松弛与善意解释，因此在公式中作为减项。", realWorldCheck: "观察关系初期是否反复确认细节，以及对方回复变慢时会不会自动推演原因。" },
    autonomy: { premise: "比肩、劫财代表自我立场与独立行动，偏印代表内部消化，金元素强化边界。", counterSignal: "正印较强时更容易接受照顾与共同决定，因此作为减项。", realWorldCheck: "观察亲密后是否仍需要固定独处时间，以及共同决策时对自主权的敏感程度。" },
    social_openness: { premise: "偏财代表流动连接，食伤代表对外分享，火元素提升进入新场景的速度。", counterSignal: "偏印会增加观察与保留，所以降低即时开放度。", realWorldCheck: "观察陌生聚会中主动开启对话的频率，以及关系网络更偏广度还是深度。" },
    trust_speed: { premise: "正印与食神支持接受善意和松弛互动，偏印与七杀提高验证成本。", counterSignal: "稳定、持续兑现的现实经历可以显著改变先天信任节奏。", realWorldCheck: "记录从认识到分享脆弱信息需要多久，以及信任主要依赖语言还是行动。" },
    dependency: { premise: "正印代表被支持需求，正财代表稳定绑定，水元素提高情绪连接；比肩提高自主性。", counterSignal: "安全型关系环境会降低焦虑依赖，压力期则可能放大需求。", realWorldCheck: "观察对方暂时失联时情绪受影响程度，以及是否需要频繁确认关系状态。" },
    responsibility: { premise: "正官代表责任规范，正财代表持续兑现，正印与土元素提供稳定承接。", counterSignal: "责任能量过高时可能变成过度承担，而不是健康承诺。", realWorldCheck: "观察是否会记住约定、按时出现，并在关系出问题时主动承担自己的部分。" },
    romance: { premise: "偏财带来惊喜与流动，食伤负责表达体验，火元素提升示好行动。", counterSignal: "印星或土金偏强时，浪漫可能转化为照顾和实际投入而非语言。", realWorldCheck: "观察喜欢一个人时更常主动邀约、表达情绪，还是通过解决问题和陪伴示爱。" },
    empathy_deep: { premise: "正印提供接纳，食神提供温和共鸣，水元素增强情绪感知。", counterSignal: "七杀在压力下倾向快速处理问题，可能暂时压过共情反应。", realWorldCheck: "观察他人情绪变化时，是先感受、先询问，还是直接提供解决方案。" },
    resilience: { premise: "七杀表示压力应对，偏印负责内部消化，比肩与金元素提供自我支撑。", counterSignal: "高韧性有时是延迟处理情绪，需要区分恢复和压抑。", realWorldCheck: "观察压力结束后恢复需要多久，以及是否能主动寻求帮助。" },
    conflict_expression: { premise: "伤官主质疑与直言，劫财和火元素提升对抗能量，正官抑制越界表达。", counterSignal: "情境安全、沟通训练和关系重要性会改变表达方式。", realWorldCheck: "观察冲突中是直接说、讽刺暗示、暂时退出，还是先安抚再讨论。" },
    novelty: { premise: "偏财、伤官与食神推动新体验，木火增加探索欲，正官提供秩序约束。", counterSignal: "有共同成长感的稳定关系也能满足新鲜感，不必依赖频繁更换对象或场景。", realWorldCheck: "观察关系进入规律期后，是主动设计新体验，还是更享受固定仪式。" },
  };
  const deepExtras: Record<string, { strength: string; blindSpot: string; scenes: string[] }> = {
    ambition: { strength: "遇到明确目标时能迅速集中资源。", blindSpot: "可能把休息误解成停滞，把关系也变成任务。", scenes: ["工作：主动接高难度任务", "关系：希望快速确认走向", "压力：越被质疑越想证明"] },
    vigilance: { strength: "能较早发现承诺与行动不一致。", blindSpot: "信息不足时容易用最坏情况补全空白。", scenes: ["初识：先观察细节", "失联：反复推演原因", "承诺：更相信持续行动"] },
    autonomy: { strength: "不容易在关系中失去自我。", blindSpot: "需要空间时若不解释，可能被理解成冷淡。", scenes: ["亲密：仍保留个人安排", "决策：希望自己做主", "冲突：先独处再回应"] },
    social_openness: { strength: "能决定谁真正进入自己的关系圈。", blindSpot: "入口太窄时，别人很难看到真实热度。", scenes: ["聚会：熟人局更放松", "初聊：不急于暴露自己", "交友：偏少而深"] },
    trust_speed: { strength: "不会因为短期热度轻易交付信任。", blindSpot: "验证周期过长会让对方感到一直被考试。", scenes: ["初识：边靠近边确认", "承诺：看行动一致性", "受伤：恢复信任较慢"] },
    dependency: { strength: "能辨认自己需要陪伴还是需要空间。", blindSpot: "安全感不足时可能用回应频率衡量感情。", scenes: ["忙碌期：在意联系连续性", "亲密：需要稳定回应", "独处：仍想确认关系状态"] },
    responsibility: { strength: "承诺后愿意持续兑现。", blindSpot: "可能替对方承担本应由对方负责的部分。", scenes: ["约定：重视准时出现", "长期：愿意规划未来", "冲突：会检查自己的责任"] },
    romance: { strength: "能用适合自己的方式制造关系温度。", blindSpot: "表达含蓄时容易被误判为没有兴趣。", scenes: ["心动：通过邀约靠近", "日常：用细节表达喜欢", "纪念日：重体验或行动"] },
    empathy_deep: { strength: "能捕捉没有直接说出口的情绪。", blindSpot: "容易吸收别人的状态，忽略自己的界限。", scenes: ["聊天：注意语气变化", "低落：先陪伴再建议", "冲突：能看到对方感受"] },
    resilience: { strength: "高压环境中仍能维持行动。", blindSpot: "可能延后处理情绪，表面没事但内部累积。", scenes: ["危机：先解决问题", "受挫：很快重新组织", "事后：需要独处恢复"] },
    conflict_expression: { strength: "能让真实分歧被看见。", blindSpot: "在情绪高点表达，准确可能变成锋利。", scenes: ["不满：直接指出问题", "被控：反应明显", "修复：需要具体回应"] },
    novelty: { strength: "会主动给稳定关系创造新体验。", blindSpot: "把平稳误读成无聊时，可能低估长期积累。", scenes: ["约会：喜欢尝试新场景", "日常：需要共同话题", "长期：重视一起成长"] },
  };
  const deepBandTexts: Record<string, [string, string, string, string, string]> = {
    ambition: [
      "挑战越大越容易进入状态，目标一旦成立，会主动争取资源与主导权。",
      "有清楚的上升意愿，愿意为值得的目标承受压力，但仍会计算投入产出。",
      "进取与生活感大致并重，通常要先确认目标有意义才会明显发力。",
      "不太被名次和竞争驱动，更愿意在熟悉节奏里把事情稳稳做好。",
      "维持内在舒适比向外证明更重要，强竞争环境反而容易消耗动力。",
    ],
    vigilance: [
      "对关系信号极敏锐，会持续核对细节与前后一致性，信任必须经得住验证。",
      "会先观察再靠近，能较快发现含糊承诺或情绪变化，不轻易交底。",
      "保留必要警觉，也愿意接受合理解释，不会默认每个空白都有问题。",
      "通常先按善意理解对方，只有反复失信时才会明显启动防御。",
      "很少预设风险，容易先投入再判断，需要留意是否忽略早期边界信号。",
    ],
    autonomy: [
      "个人空间是亲密关系的前提，越被控制越会迅速收回情绪与决定权。",
      "自主需求明确，重要决定希望自己掌舵，但并不排斥稳定陪伴。",
      "能在共同安排与个人节奏间切换，边界说清楚后通常愿意配合。",
      "更习惯共同讨论和共享日常，独立空间有需要，但不是首要条件。",
      "高度重视连接与共同决定，容易为了维持关系暂时让出个人需求。",
    ],
    social_openness: [
      "对新人和新场景有明显兴奋感，常由你率先制造话题与连接机会。",
      "社交入口较宽，熟悉气氛后能自然带动交流，也愿意扩展关系网络。",
      "看场合决定开放程度：安全场景主动，陌生环境先观察再加入。",
      "关系入口偏窄，更愿意把精力给少数熟人，不追求持续认识新人。",
      "对陌生连接明显谨慎，只有长期共处或强共同点才容易真正打开。",
    ],
    trust_speed: [
      "稳定善意很快就能被你接住，几次一致互动后便愿意分享真实感受。",
      "信任建立较快，但仍会看行动是否连续，不会只凭第一印象下注。",
      "通常边互动边验证，需要若干次兑现才会把关系从礼貌推进到真实。",
      "信任门槛偏高，语言只能加分，时间与可重复的行动才真正有效。",
      "交付信任非常慢，即使有好感也会长期保留核心部分，关系需要耐心。",
    ],
    dependency: [
      "关系回应会显著牵动情绪，需要稳定联系与清楚确认来维持安全感。",
      "重视陪伴连续性，压力期尤其希望对方在场，但仍能保留部分自我节奏。",
      "既需要连接也需要空间，依赖程度通常随着对方的可靠度上下变化。",
      "多数情绪能自行消化，亲密关系重要，但不会成为日常状态的唯一支点。",
      "高度自我支撑，很少主动索取陪伴；真正的难点是让别人知道你也有需要。",
    ],
    responsibility: [
      "承诺会被你当成必须兑现的结构，常主动规划未来并承担关系里的难题。",
      "责任感清晰，确认关系后会稳定投入，也会在失约时主动补救。",
      "愿意负责，但会先判断分工是否公平，不接受长期单方面承担。",
      "更看重当下真实感受，对固定承诺保留弹性，需要具体约定才能持续。",
      "不喜欢关系被责任框死，若期待没有说清，容易选择随状态调整投入。",
    ],
    romance: [
      "心动通常会变成明确行动，擅长制造邀约、惊喜和快速升温的时刻。",
      "有感觉时愿意主动示好，表达不算含蓄，也在意关系里是否持续有温度。",
      "浪漫要看氛围与确定性，会在行动和克制之间寻找舒服的分寸。",
      "示爱偏实际，常用陪伴、照顾或解决问题替代热烈语言。",
      "很少主动营造浪漫，即使喜欢也可能表现得平静，需要更明确地传递兴趣。",
    ],
    empathy_deep: [
      "会迅速捕捉语气、停顿和情绪变化，甚至在对方开口前就察觉不对劲。",
      "共情反应较强，能理解未说出口的感受，但偶尔会把对方情绪带回自己身上。",
      "既能感受情绪也保留判断，通常会先确认，而不是完全依赖直觉。",
      "更依赖清楚表达来理解需求，对含蓄暗示可能反应稍慢但愿意倾听。",
      "处理关系时以事实和方案为先，不擅长猜情绪，需要对方把需求说具体。",
    ],
    resilience: [
      "高压会激活行动模式，越是复杂局面越能迅速聚焦，但情绪常被延后处理。",
      "压力承载力较强，受挫后能重新组织节奏，只是事后需要独处恢复。",
      "常规压力可以消化，面对长期不确定时仍需要稳定支持与明确出口。",
      "连续冲突容易耗空能量，更适合可预期节奏，恢复期也需要被认真对待。",
      "对高压和突发变化非常敏感，安全环境与及时求助比硬撑更能恢复状态。",
    ],
    conflict_expression: [
      "不合理之处很难忍住不说，冲突中追求直接与真实，也最容易显得锋利。",
      "表达分歧较主动，能把问题摊开，但情绪上来时语气可能先于分寸。",
      "会说出不同意见，也会衡量关系后果，通常在直接和缓和之间切换。",
      "倾向先压住反应、整理措辞再沟通，有时会让不满延迟出现。",
      "很少正面表达冲突，常以退让或沉默维持和平，需要练习更早说出边界。",
    ],
    novelty: [
      "重复很快削弱投入感，需要持续的新体验、新话题与共同成长来保持热度。",
      "对变化需求明显，会主动设计新场景；稳定可以接受，但不能长期没有更新。",
      "既享受固定仪式，也需要偶尔打破惯性，共同计划比单纯刺激更有效。",
      "熟悉感比变化更能累积安全，偶尔的新安排足够，不需要持续制造刺激。",
      "高度偏爱可预期与固定节奏，重复会带来安心，突然变化反而容易造成负担。",
    ],
  };
  const deepBandIndex = (score: number) => score >= 82 ? 0 : score >= 65 ? 1 : score >= 45 ? 2 : score >= 28 ? 3 : 4;
  const rankedScores = deepBase
    .map((item, index) => ({ raw: item.score, index }))
    .sort((a, b) => a.raw - b.raw || a.index - b.index);
  const deepAnalysis = deepBase.map((item, itemIndex) => {
    const rank = rankedScores.findIndex((entry) => entry.index === itemIndex);
    const rankScore = 18 + rank / Math.max(1, rankedScores.length - 1) * 74;
    const score = clamp(item.score * .45 + rankScore * .55);
    return {
      ...item,
      score,
      level: level(score),
      summary: deepBandTexts[item.key][deepBandIndex(score)],
      logic: { ...deepLogicBase[item.key], ...deepExtras[item.key] },
    };
  });
  const tenGodPersonas: Record<string, { name: string; drive: string; behavior: string; relationship: string }> = {
    七杀: { name: "压迫决断型", drive: "压力 / 生存 / 对抗", behavior: "快决策、强控制、不拖延", relationship: "容易主导关系、强张力" },
    正官: { name: "秩序规则型", drive: "规则 / 责任 / 稳定", behavior: "守规矩、克制、稳重", relationship: "关系稳定、偏理性" },
    伤官: { name: "破界表达型", drive: "自由 / 表达 / 反规则", behavior: "直接表达、反控制、情绪与逻辑都强", relationship: "易冲突但吸引强" },
    食神: { name: "松弛表达型", drive: "体验 / 舒适 / 输出", behavior: "随性、轻松、有分享欲", relationship: "舒服关系、不压迫" },
    正印: { name: "安全稳定型", drive: "安全 / 接纳 / 内收", behavior: "慢热、思考多、不激进", relationship: "稳定但推进慢" },
    偏印: { name: "隐性策略型", drive: "洞察 / 非线性 / 观察", behavior: "观察多、表达少、有策略感", relationship: "有距离感、不易看透" },
    正财: { name: "现实结构型", drive: "现实 / 可控 / 结果", behavior: "务实、目标清晰、不浪费", relationship: "功能型关系、稳定" },
    偏财: { name: "流动社交型", drive: "机会 / 外部 / 灵活", behavior: "社交强、行动快、不固定", relationship: "易开始也易变化" },
    比肩: { name: "自我主导型", drive: "自我 / 独立 / 平等", behavior: "不依赖、坚持自我", relationship: "平等关系、不服管" },
    劫财: { name: "竞争对抗型", drive: "竞争 / 资源 / 控制", behavior: "强竞争、抢主导、不服输", relationship: "易冲突、抢控制权" },
  };
  const dominantGodName = godNames.slice().sort((a, b) => godCounts[b] - godCounts[a])[0];
  const secondaryGodName = godNames.slice().sort((a, b) => godCounts[b] - godCounts[a])[1];
  const persona = tenGodPersonas[dominantGodName];
  const secondary = tenGodPersonas[secondaryGodName];
  const dominantPersona = { god: dominantGodName, ...persona, weight: godCounts[dominantGodName] };
  const secondaryPersona = { god: secondaryGodName, ...secondary, weight: godCounts[secondaryGodName] };
  const personaNouns: Record<string, string> = {
    七杀: "决断者", 正官: "秩序者", 伤官: "破界者", 食神: "体验者", 正印: "守护者",
    偏印: "洞察者", 正财: "建设者", 偏财: "连接者", 比肩: "独行者", 劫财: "竞合者",
  };
  const personaAdjectives: Record<string, string> = {
    七杀: "锋利", 正官: "克制", 伤官: "自由", 食神: "松弛", 正印: "温厚",
    偏印: "敏锐", 正财: "务实", 偏财: "灵活", 比肩: "独立", 劫财: "好胜",
  };
  const combinedPersona = {
    name: `${personaAdjectives[secondaryGodName]}${personaNouns[dominantGodName]}`,
    summary: `以${dominantGodName}的${persona.drive.replaceAll(" / ", "、")}为主轴，同时带有${secondaryGodName}的${secondary.drive.replaceAll(" / ", "、")}。`,
  };
  const branchEntries = bazi.pillars.map((pillar) => ({
    pillar: pillar.label,
    branch: pillar.zhi,
    god: pillar.hiddenTenGods[0] ?? "日主",
  }));
  const branchCounts = Object.fromEntries(branches.map((branch) => [branch, branchEntries.filter((item) => item.branch === branch).length])) as Record<string, number>;
  const godThemes: Record<string, string> = {
    正官: "规则与责任", 七杀: "压力与决断", 正印: "接纳与安全", 偏印: "观察与策略",
    正财: "现实投入", 偏财: "机会与连接", 比肩: "自我立场", 劫财: "竞争与主导",
    食神: "松弛表达", 伤官: "破界表达", 日主: "自我核心",
  };
  const specialPoints: UserProfile["specialPoints"] = [];
  const clashPairs = [["子", "午"], ["丑", "未"], ["寅", "申"], ["卯", "酉"], ["辰", "戌"], ["巳", "亥"]];
  clashPairs.forEach(([left, right]) => {
    if (!branchCounts[left] || !branchCounts[right]) return;
    const leftGod = branchEntries.find((item) => item.branch === left)?.god ?? "";
    const rightGod = branchEntries.find((item) => item.branch === right)?.god ?? "";
    const force = branchCounts[left] * branchCounts[right];
    const title = branchCounts[right] > branchCounts[left]
      ? `${branchCounts[right]}个${right}冲${left}`
      : `${branchCounts[left] > 1 ? `${branchCounts[left]}个` : ""}${left}冲${branchCounts[right] > 1 ? `${branchCounts[right]}个` : ""}${right}`;
    specialPoints.push({
      type: "冲", title, branches: [left, right], tenGods: [leftGod, rightGod], strength: Math.min(100, 55 + force * 15),
      summary: `${left}的${leftGod}（${godThemes[leftGod]}）与${right}的${rightGod}（${godThemes[rightGod]}）发生正面拉扯。${force > 1 ? `命盘中共有 ${force} 组同类冲，重复感更明显。` : ""}`,
      relationshipImpact: `${godThemes[leftGod]}与${godThemes[rightGod]}不容易同时满足，关系中更容易在这两种需求之间来回摆动。`,
    });
  });
  const sixHarmony = [
    ["子", "丑", "土"], ["寅", "亥", "木"], ["卯", "戌", "火"],
    ["辰", "酉", "金"], ["巳", "申", "水"], ["午", "未", "土"],
  ];
  sixHarmony.forEach(([left, right, element]) => {
    if (!branchCounts[left] || !branchCounts[right]) return;
    const leftGod = branchEntries.find((item) => item.branch === left)?.god ?? "";
    const rightGod = branchEntries.find((item) => item.branch === right)?.god ?? "";
    specialPoints.push({
      type: "六合", title: `${left}${right}六合${element}`, branches: [left, right], tenGods: [leftGod, rightGod], strength: 68,
      summary: `${left}的${leftGod}（${godThemes[leftGod]}）与${right}的${rightGod}（${godThemes[rightGod]}）形成六合，关系更容易找到彼此接住的接口。`,
      relationshipImpact: `${godThemes[leftGod]}与${godThemes[rightGod]}会倾向互相牵引，但是否化为${element}仍需看全盘与透干。`,
    });
  });
  const harmonyGroups = [
    { type: "三合" as const, branches: ["申", "子", "辰"], element: "水", theme: "感受与流动" },
    { type: "三合" as const, branches: ["亥", "卯", "未"], element: "木", theme: "生长与表达" },
    { type: "三合" as const, branches: ["寅", "午", "戌"], element: "火", theme: "行动与热度" },
    { type: "三合" as const, branches: ["巳", "酉", "丑"], element: "金", theme: "规则与边界" },
    { type: "三会" as const, branches: ["亥", "子", "丑"], element: "水", theme: "感受与流动" },
    { type: "三会" as const, branches: ["寅", "卯", "辰"], element: "木", theme: "生长与表达" },
    { type: "三会" as const, branches: ["巳", "午", "未"], element: "火", theme: "行动与热度" },
    { type: "三会" as const, branches: ["申", "酉", "戌"], element: "金", theme: "规则与边界" },
  ];
  harmonyGroups.forEach((group) => {
    const present = group.branches.filter((branch) => branchCounts[branch]);
    if (present.length < 2) return;
    const complete = present.length === 3;
    if (!complete && group.type === "三会") {
      const indexes = present.map((branch) => group.branches.indexOf(branch)).sort();
      if (indexes[1] - indexes[0] !== 1) return;
    }
    const type = complete ? group.type : group.type === "三合" ? "半合" : "半会";
    const gods = present.map((branch) => branchEntries.find((item) => item.branch === branch)?.god ?? "");
    specialPoints.push({
      type, title: `${present.join("")}${type}${group.element}`,
      branches: present, tenGods: gods, strength: complete ? 90 : 58,
      summary: `${present.join("、")}把${gods.map((god) => `${god}（${godThemes[god]}）`).join("、")}牵引到${group.element}的${group.theme}上。${complete ? "三支齐全，结构完整。" : "目前是两支倾向，不等同于完整成局。"}`,
      relationshipImpact: complete ? `关系中${group.theme}会成为反复出现的主场。` : `遇到能补齐剩余地支的人或环境时，${group.theme}更容易被明显激活。`,
    });
  });
  specialPoints.sort((a, b) => b.strength - a.strength);
  const archetype = `${elementName}系${persona.name}`;
  const identityTags = [
    socialProfile.relationship_speed === "slow" ? "慢热关系" : socialProfile.relationship_speed === "fast" ? "快速靠近" : "自然升温",
    personality.stability >= 68 ? "情绪稳定" : personality.emotion >= 68 ? "感受细腻" : "理性感性平衡",
    personality.control >= 65 ? "边界清晰" : expressiveness >= 65 ? "善于表达" : "重视默契",
  ];
  const traitAnalysis = [
    { key: "extroversion", label: "社交外向", score: relationScores.extroversion, basis: `食伤 ${tenGodAnalysis[4].count} 权重 + 财星 ${tenGodAnalysis[2].count} 权重，结合火木外放性` },
    { key: "stability", label: "情绪稳定", score: relationScores.stability, basis: `印星 ${tenGodAnalysis[1].count} 提供安全感，官杀 ${tenGodAnalysis[0].count} 提供秩序，结合土金强度` },
    { key: "control", label: "边界意识", score: relationScores.control, basis: `官杀 ${tenGodAnalysis[0].count} 为主要依据；比劫 ${tenGodAnalysis[3].count} 反映自我立场` },
    { key: "emotion", label: "情感强度", score: relationScores.emotion, basis: `印星 ${tenGodAnalysis[1].count} 的内在感受，加上食伤 ${tenGodAnalysis[4].count} 的情绪流动` },
    { key: "expressiveness", label: "表达意愿", score: relationScores.expressiveness, basis: `食神、伤官合计权重 ${tenGodAnalysis[4].count}；食神温和分享，伤官直接表达` },
    { key: "empathy", label: "共情能力", score: relationScores.empathy, basis: `正偏印合计权重 ${tenGodAnalysis[1].count}，结合水元素与情感强度` },
    { key: "initiative", label: "关系主动性", score: relationScores.initiative, basis: `财星 ${tenGodAnalysis[2].count} 表示投入，比劫 ${tenGodAnalysis[3].count} 表示参与和行动` },
    { key: "adaptability", label: "关系适应力", score: relationScores.adaptability, basis: `印星 ${tenGodAnalysis[1].count} 的理解力与食伤 ${tenGodAnalysis[4].count} 的表达调节共同作用` },
  ];
  return {
    id: `${birth.year}${String(birth.month).padStart(2, "0")}${String(birth.day).padStart(2, "0")}${String(birth.hour).padStart(2, "0")}${String(birth.minute ?? 0).padStart(2, "0")}`,
    birth,
    bazi,
    zodiac,
    personality,
    socialProfile,
    archetype,
    identityTags,
    traitAnalysis,
    tenGodAnalysis,
    tenGodCounts: godCounts,
    tenGodSources,
    dominantPersona,
    secondaryPersona,
    combinedPersona,
    luckCycles,
    specialPoints,
    deepAnalysis,
    summary: `你的五行以${elementName}为主要能量，日主为${bazi.dayPillar[0]}。${zodiacName}为这组底色加入了新的表达方式：你有${({ low: "较低", medium: "适中", high: "较高" } as const)[socialProfile.communication_need]}的沟通需求，关系通常以${({ slow: "慢热", medium: "自然", fast: "快速" } as const)[socialProfile.relationship_speed]}的节奏展开，并呈现${({ secure: "安全型", anxious: "焦虑型", avoidant: "回避型" } as const)[socialProfile.attachment_style]}依恋倾向。`,
  };
}

const hasBalance = (a: Elements, b: Elements, x: keyof Elements, y: keyof Elements) =>
  (a[x] >= 2 && b[y] >= 2) || (a[y] >= 2 && b[x] >= 2);

export function matchProfiles(a: UserProfile, b: UserProfile): MatchResult {
  let score = 50;
  const reasons: string[] = [];
  if (hasBalance(a.bazi.elements, b.bazi.elements, "fire", "water")) {
    score += 15; reasons.push("火与水形成互补，为行动力与感受力带来平衡。");
  }
  if (hasBalance(a.bazi.elements, b.bazi.elements, "wood", "metal")) {
    score += 10; reasons.push("木与金形成互补，表达力和边界感可以互相校准。");
  }
  const extDiff = Math.abs(a.personality.extroversion - b.personality.extroversion);
  if (extDiff >= 25) {
    score += 10; reasons.push("外向与内向节奏互补，关系同时拥有连接速度与交流深度。");
  }
  const emotionDiff = Math.abs(a.personality.emotion - b.personality.emotion);
  if (emotionDiff >= 12 && emotionDiff <= 30) {
    score += 8; reasons.push("情绪表达差异适中，既有共鸣也保留调节空间。");
  }
  const stabilityDiff = Math.abs(a.personality.stability - b.personality.stability);
  if (stabilityDiff >= 25) {
    score += 15; reasons.push("稳定性一强一弱，压力情境中具备明显的互补潜力。");
  }
  const bothExtreme = (a.personality.stability >= 85 && b.personality.stability >= 85)
    || (a.personality.stability <= 30 && b.personality.stability <= 30);
  if (bothExtreme) {
    score -= 10; reasons.push("双方稳定性都处于极端区间，需要主动管理关系惯性。");
  }
  if (reasons.length === 0) reasons.push("双方特质接近，关系更依赖共同经历与持续沟通。");
  score = clamp(score);
  return {
    score,
    reasons,
    analysis: explainMatch(score, reasons),
  };
}

export function explainMatch(score: number, reasons: string[]): string {
  const tone = score >= 80 ? "你们呈现出很强的关系潜力" : score >= 65 ? "你们具备值得探索的互补空间" : "你们的连接更需要耐心建立";
  return `${tone}。${reasons.join("")}这份解释只描述规则结果，不替代真实互动；最好的验证，仍然是一次诚实而轻松的对话。`;
}

function elementRoleForDayMaster(dayStem: string, targetElement: string) {
  const elementCn = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" } as const;
  const dayElement = elementCn[stemElements[stems.indexOf(dayStem)]];
  const generates: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
  const controls: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
  if (targetElement === dayElement) return "比劫";
  if (generates[dayElement] === targetElement) return "食伤";
  if (controls[dayElement] === targetElement) return "财星";
  if (controls[targetElement] === dayElement) return "官杀";
  return "印星";
}

function analyzeCrossBranchDynamics(a: UserProfile, b: UserProfile): RelationshipAnalysis["branchDynamics"] {
  const userName = a.birth.name?.trim() || "你";
  const partnerName = b.birth.name?.trim() || "TA";
  const aEntries = a.bazi.pillars.map((pillar) => ({ branch: pillar.zhi, god: pillar.hiddenTenGods[0] ?? "日主" }));
  const bEntries = b.bazi.pillars.map((pillar) => ({ branch: pillar.zhi, god: pillar.hiddenTenGods[0] ?? "日主" }));
  const aSet = new Set(aEntries.map((item) => item.branch));
  const bSet = new Set(bEntries.map((item) => item.branch));
  const union = new Set([...aSet, ...bSet]);
  const result: RelationshipAnalysis["branchDynamics"] = [];
  const roleMeaning: Record<string, string> = {
    比劫: "自主与同伴立场", 食伤: "表达与体验", 财星: "投入与现实经营", 官杀: "规则与压力", 印星: "理解与安全感",
  };
  const clashes = [["子", "午"], ["丑", "未"], ["寅", "申"], ["卯", "酉"], ["辰", "戌"], ["巳", "亥"]];
  clashes.forEach(([left, right]) => {
    const direct = aSet.has(left) && bSet.has(right);
    const reverse = aSet.has(right) && bSet.has(left);
    if (!direct && !reverse) return;
    const userBranch = direct ? left : right;
    const partnerBranch = direct ? right : left;
    const userGod = aEntries.find((item) => item.branch === userBranch)?.god ?? "";
    const partnerGod = bEntries.find((item) => item.branch === partnerBranch)?.god ?? "";
    result.push({
      type: "冲", title: `${userName}的${userBranch}冲${partnerName}的${partnerBranch}`, branches: [userBranch, partnerBranch],
      userRole: userGod, partnerRole: partnerGod,
      summary: `${userName}的${userGod}需求与${partnerName}的${partnerGod}需求会直接碰面：${userName}更在意${godThemesForRelationship(userGod)}，${partnerName}更在意${godThemesForRelationship(partnerGod)}。`,
      advice: `不要争谁更合理。先让${userName}说清${godThemesForRelationship(userGod)}的底线，再由${partnerName}说明${godThemesForRelationship(partnerGod)}需要怎样被满足。`,
    });
  });
  const harmonies = [
    ["子", "丑", "土"], ["寅", "亥", "木"], ["卯", "戌", "火"],
    ["辰", "酉", "金"], ["巳", "申", "水"], ["午", "未", "土"],
  ];
  harmonies.forEach(([left, right, element]) => {
    const cross = (aSet.has(left) && bSet.has(right)) || (aSet.has(right) && bSet.has(left));
    if (!cross) return;
    const userRole = elementRoleForDayMaster(a.bazi.dayPillar[0], element);
    const partnerRole = elementRoleForDayMaster(b.bazi.dayPillar[0], element);
    result.push({
      type: "六合", title: `${left}${right}六合${element}`, branches: [left, right], userRole, partnerRole,
      summary: `这个${element}的连接，对${userName}落在${userRole}（${roleMeaning[userRole]}），对${partnerName}落在${partnerRole}（${roleMeaning[partnerRole]}）。`,
      advice: `${userName}需要用${roleMeaning[userRole]}参与关系，${partnerName}则通过${roleMeaning[partnerRole]}接住；把两种方式放进同一个具体计划最容易形成黏合。`,
    });
  });
  const groups = [
    { type: "三合" as const, branches: ["申", "子", "辰"], element: "水" },
    { type: "三合" as const, branches: ["亥", "卯", "未"], element: "木" },
    { type: "三合" as const, branches: ["寅", "午", "戌"], element: "火" },
    { type: "三合" as const, branches: ["巳", "酉", "丑"], element: "金" },
    { type: "三会" as const, branches: ["亥", "子", "丑"], element: "水" },
    { type: "三会" as const, branches: ["寅", "卯", "辰"], element: "木" },
    { type: "三会" as const, branches: ["巳", "午", "未"], element: "火" },
    { type: "三会" as const, branches: ["申", "酉", "戌"], element: "金" },
  ];
  groups.forEach((group) => {
    if (!group.branches.every((branch) => union.has(branch))) return;
    if (!group.branches.some((branch) => aSet.has(branch)) || !group.branches.some((branch) => bSet.has(branch))) return;
    const userRole = elementRoleForDayMaster(a.bazi.dayPillar[0], group.element);
    const partnerRole = elementRoleForDayMaster(b.bazi.dayPillar[0], group.element);
    result.push({
      type: group.type, title: `${group.branches.join("")}${group.type}${group.element}`, branches: group.branches,
      userRole, partnerRole,
      summary: `两张命盘合在一起补齐${group.branches.join("、")}。${group.element}对${userName}属于${userRole}（${roleMeaning[userRole]}），对${partnerName}属于${partnerRole}（${roleMeaning[partnerRole]}）。`,
      advice: userRole === partnerRole
        ? `${userName}和${partnerName}会被同一种${roleMeaning[userRole]}同时激活，适合共同做一件能持续推进的事，避免只停留在情绪热度。`
        : `${userName}会从${roleMeaning[userRole]}进入关系，${partnerName}会从${roleMeaning[partnerRole]}进入；先承认入口不同，再设计一个两边都能得到的互动。`,
    });
  });
  return result;
}

function godThemesForRelationship(god: string) {
  const themes: Record<string, string> = {
    正官: "规则与承诺", 七杀: "决断与控制", 正印: "稳定支持", 偏印: "观察与空间",
    正财: "持续投入", 偏财: "新鲜连接", 比肩: "平等与自主", 劫财: "主导与竞争",
    食神: "舒服表达", 伤官: "直接表达", 日主: "自我核心",
  };
  return themes[god] ?? "关系需求";
}

export function analyzeRelationship(a: UserProfile, b: UserProfile, relationType = "恋爱"): RelationshipAnalysis {
  const match = matchProfiles(a, b);
  const userName = a.birth.name?.trim() || "你";
  const partnerName = b.birth.name?.trim() || "对方";
  const diff = (key: keyof Personality) => Math.abs(a.personality[key] - b.personality[key]);
  const aGod = Object.fromEntries(a.tenGodAnalysis.map((item) => [item.key, item]));
  const bGod = Object.fromEntries(b.tenGodAnalysis.map((item) => [item.key, item]));
  const paceA = a.socialProfile.relationship_speed;
  const paceB = b.socialProfile.relationship_speed;
  const cards = [
    {
      key: "communication", label: "你们怎么沟通",
      summary: diff("extroversion") >= 22 ? `${a.personality.extroversion > b.personality.extroversion ? userName : partnerName}更容易主动展开话题，${a.personality.extroversion > b.personality.extroversion ? partnerName : userName}会先观察再回应。` : `${userName}和${partnerName}的表达速度接近，容易接住日常话题，但深层感受可能都等对方先说。`,
      why: diff("extroversion") >= 22 ? "一个负责打开场面，一个负责判断关系是否安全，互补感强，但沉默容易被误读。" : "表达轮廓重合，所以相处舒服；真正的推进点在于谁先暴露一点真实情绪。",
      evidence: `外向表达 ${a.personality.extroversion} : ${b.personality.extroversion}；食伤权重 ${aGod.output.count} : ${bGod.output.count}`,
      advice: diff("extroversion") >= 22 ? `${a.personality.extroversion > b.personality.extroversion ? userName : partnerName}留出回应空间；${a.personality.extroversion > b.personality.extroversion ? partnerName : userName}明确说“我需要一点时间”，避免被误读为冷淡。` : "不要只停留在舒服话题，每次主动多问一个关于感受的问题。",
      logic: [`读取双方外向表达：${a.personality.extroversion} 与 ${b.personality.extroversion}`, `比较食伤权重：${aGod.output.count} 与 ${bGod.output.count}`, `差值 ${diff("extroversion")}；达到 22 以上判定为明显节奏差，否则判定为相近`],
    },
    {
      key: "pace", label: "关系如何升温",
      summary: paceA === paceB ? `${userName}和${partnerName}都属于${paceA === "fast" ? "快速靠近" : paceA === "slow" ? "慢热确认" : "自然升温"}型，关系节奏基本同步。` : `${userName}更偏${paceA === "fast" ? "快速靠近" : paceA === "slow" ? "慢热确认" : "自然升温"}，${partnerName}更偏${paceB === "fast" ? "快速靠近" : paceB === "slow" ? "慢热确认" : "自然升温"}。`,
      why: paceA === paceB ? `${userName}和${partnerName}对联系频率和确认速度的期待接近，不容易因为快慢产生误会。` : `${userName}与${partnerName}确认安全感的速度不同，需要找到两个人都能持续的联系频率。`,
      evidence: `关系速度 ${paceA} : ${paceB}；情感强度 ${a.personality.emotion} : ${b.personality.emotion}`,
      advice: paceA === paceB ? "保持节奏的同时设置一个具体的下一次互动，让关系有自然的连续性。" : "用可预期的小频率代替忽冷忽热，例如固定时间联系，而不是要求即时回应。",
      logic: [`读取关系速度标签：${paceA} 与 ${paceB}`, `比较情感强度：${a.personality.emotion} 与 ${b.personality.emotion}`, paceA === paceB ? "速度标签相同，判断为升温节奏同步" : "速度标签不同，判断为确认关系的频率需求不同"],
    },
    {
      key: "conflict", label: "冲突从哪里开始",
      summary: diff("control") >= 20 ? `${a.personality.control > b.personality.control ? userName : partnerName}更需要规则与明确回应，${a.personality.control > b.personality.control ? partnerName : userName}更在意空间和自然感。` : `${userName}和${partnerName}对边界的理解接近，冲突更可能来自谁先让步、谁承担更多。`,
      why: diff("control") >= 20 ? "规则需求差异明显：追问定义的人是在寻找安全感，回避规定的人是在保护自由。" : "双方都知道边界在哪里，因此矛盾通常不是规则本身，而是投入是否公平。",
      evidence: `边界控制 ${a.personality.control} : ${b.personality.control}；官杀权重 ${aGod.authority.count} : ${bGod.authority.count}`,
      advice: "冲突时先说需求，不推测动机。把“你为什么总是”改成“这件事让我需要更明确的回应”。",
      logic: [`读取边界控制：${a.personality.control} 与 ${b.personality.control}`, `比较官杀权重：${aGod.authority.count} 与 ${bGod.authority.count}`, `边界差值 ${diff("control")}；20 以上标记为规则需求错位`],
    },
    {
      key: "attachment", label: "安全感如何建立",
      summary: a.socialProfile.attachment_style === b.socialProfile.attachment_style ? `${userName}和${partnerName}都偏${a.socialProfile.attachment_style === "secure" ? "安全" : a.socialProfile.attachment_style === "anxious" ? "焦虑" : "回避"}型，容易理解彼此的安全感语言。` : `${userName}偏${a.socialProfile.attachment_style}，${partnerName}偏${b.socialProfile.attachment_style}，两个人确认关系状态的方式不同。`,
      why: a.socialProfile.attachment_style === b.socialProfile.attachment_style ? "两个人对回应、空间和承诺的期待相近。" : `${userName}需要的确认方式与${partnerName}提供安全感的方式不完全相同，必须提前说清楚。`,
      evidence: `依恋倾向 ${a.socialProfile.attachment_style} : ${b.socialProfile.attachment_style}；印星权重 ${aGod.resource.count} : ${bGod.resource.count}`,
      advice: "提前约定忙碌、沉默和需要空间时怎么告知，减少把暂时退开解释成关系降温。",
      logic: [`识别依恋类型：${a.socialProfile.attachment_style} 与 ${b.socialProfile.attachment_style}`, `读取印星权重：${aGod.resource.count} 与 ${bGod.resource.count}`, a.socialProfile.attachment_style === b.socialProfile.attachment_style ? "类型相同，安全感语言相近" : "类型不同，标记回应确认与独处消化之间的错位"],
    },
    {
      key: "initiative", label: "谁更容易主动",
      summary: a.traitAnalysis[6].score > b.traitAnalysis[6].score + 10 ? `${userName}更容易发起邀约和维持联系，${partnerName}更习惯确认安全后回应。` : b.traitAnalysis[6].score > a.traitAnalysis[6].score + 10 ? `${partnerName}更容易发起互动，${userName}更习惯确认安全后回应。` : `${userName}和${partnerName}主动性接近，谁先遇到共同话题，谁就更可能打开关系。`,
      why: "这里不只看谁先发消息，也看谁安排时间、记住细节和在关系降温后主动修复。",
      evidence: `关系主动性 ${a.traitAnalysis[6].score} : ${b.traitAnalysis[6].score}；财星权重 ${aGod.wealth.count} : ${bGod.wealth.count}`,
      advice: "不要只统计谁先联系，也观察谁在安排时间、记住细节和修复关系中投入。",
      logic: [`读取关系主动性：${a.traitAnalysis[6].score} 与 ${b.traitAnalysis[6].score}`, `读取财星权重：${aGod.wealth.count} 与 ${bGod.wealth.count}`, "主动性差值超过 10 时标记主要发起者，否则判断为双向发起"],
    },
    {
      key: "repair", label: "吵架后怎么修复",
      summary: Math.min(a.personality.stability, b.personality.stability) >= 60 ? `${a.personality.stability >= b.personality.stability ? userName : partnerName}更可能先冷静下来，把对话重新拉回问题本身。` : `${userName}和${partnerName}在压力下都容易先进入防御，立即讲道理效果有限。`,
      why: Math.min(a.personality.stability, b.personality.stability) >= 60 ? "关系里存在一个稳定锚点，修复关键是让较稳定的人先说需求而不是裁判对错。" : "两个人都需要先从情绪状态退出，再讨论事实，否则容易互相放大。",
      evidence: `稳定度 ${a.personality.stability} : ${b.personality.stability}；压力韧性 ${a.deepAnalysis[9].score} : ${b.deepAnalysis[9].score}`,
      advice: "先暂停情绪升级，再约定恢复对话的具体时间。修复必须包含理解、责任和下一次怎么做。",
      logic: [`读取${userName}与${partnerName}的稳定方式`, `比较两人的压力恢复节奏`, Math.min(a.personality.stability, b.personality.stability) >= 60 ? `${userName}与${partnerName}具备回到问题本身的能力` : `${userName}与${partnerName}都需要先暂停降温`],
    },
  ];
  const extGap = diff("extroversion");
  const bothSlow = a.socialProfile.relationship_speed === "slow" || b.socialProfile.relationship_speed === "slow";
  const socialConversion = {
    atmosphere: match.score >= 80
      ? bothSlow ? "你们属于刚开始有点互相试探，但熟起来很容易上头的类型。" : "你们是那种一聊就容易接上，越互动越有感觉的组合。"
      : extGap >= 20 ? "一开始可能觉得不太搭，但越接触越容易被对方吸引。" : "表面看着平淡，但越聊越容易变熟。",
    icebreakers: relationType === "同事"
      ? ["你平时做事是先想清楚，还是先开干？", "如果一起做项目，你最怕队友哪一点？"]
      : relationType === "朋友"
        ? ["你会不会属于那种刚认识很安静，熟了以后特别疯的人？", "最近有什么东西是你逢人就想推荐的？", "如果现在出门散步，你会选热闹的地方还是安静的地方？"]
        : ["我感觉你应该是那种不太爱先主动的人？", "如果我们聊天，你会先观察还是直接开怼？", "你会不会属于慢热，但熟了以后反差很大的类型？"],
    trigger: extGap >= 20
      ? "需要一次有点玩笑性质的对话破冰。"
      : bothSlow ? "需要一个共同兴趣或最近生活切入。" : "需要对方先表达一点真实情绪。",
  };
  const branchDynamics = analyzeCrossBranchDynamics(a, b);
  return {
    score: match.score,
    relationType,
    headline: match.score >= 80 ? "高互补，也需要认真接住彼此" : match.score >= 65 ? "有吸引力的差异，值得慢慢验证" : "节奏并不天然一致，但仍有可经营空间",
    cards,
    socialConversion,
    branchDynamics,
  };
}
