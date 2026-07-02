import type {
  Bazi, BirthInput, Elements, MatchResult, Personality, SocialProfile,
  UserProfile, Zodiac,
  RelationshipAnalysis,
} from "./types";
import { Lunar, Solar } from "lunar-javascript";
import { ChildLimit, DefaultChildLimitProvider, Gender as TymeGender, SolarTime } from "tyme4ts";

const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const stemElements: (keyof Elements)[] = ["wood", "wood", "fire", "fire", "earth", "earth", "metal", "metal", "water", "water"];
const branchElements: (keyof Elements)[] = ["water", "earth", "wood", "wood", "earth", "fire", "fire", "earth", "metal", "metal", "earth", "water"];

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const pillar = (index: number) => stems[((index % 10) + 10) % 10] + branches[((index % 12) + 12) % 12];

function toSolarBirth(birth: BirthInput): BirthInput {
  if (birth.calendarType !== "lunar") return birth;
  const lunar = Lunar.fromYmdHms(
    birth.year,
    birth.isLeapMonth ? -birth.month : birth.month,
    birth.day,
    birth.hour,
    birth.minute ?? 0,
    0,
  );
  const solar = lunar.getSolar();
  return {
    ...birth,
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
    calendarType: "solar",
    isLeapMonth: false,
  };
}

function calculateLuckCycles(birth: BirthInput): UserProfile["luckCycles"] {
  const solarBirth = toSolarBirth(birth);
  ChildLimit.provider = new DefaultChildLimitProvider();
  const childLimit = ChildLimit.fromSolarTime(
    SolarTime.fromYmdHms(solarBirth.year, solarBirth.month, solarBirth.day, solarBirth.hour, solarBirth.minute ?? 0, 0),
    birth.gender === "male" ? TymeGender.MAN : TymeGender.WOMAN,
  );
  const currentYear = new Date().getFullYear();
  const firstCycle = childLimit.getStartDecadeFortune();
  const periods: UserProfile["luckCycles"]["periods"] = Array.from({ length: 8 }, (_, index) => {
    const cycle = firstCycle.next(index);
    const startYear = cycle.getStartSixtyCycleYear().getYear();
    const endYear = cycle.getEndSixtyCycleYear().getYear();
    return {
      index: index + 1,
      ganZhi: cycle.getName(),
      startYear,
      endYear,
      startAge: cycle.getStartAge(),
      endAge: cycle.getEndAge(),
      isCurrent: currentYear >= startYear && currentYear <= endYear,
    };
  });
  const current = periods.find((period) => period.isCurrent);
  const startParts = [
    childLimit.getYearCount() ? `${childLimit.getYearCount()}年` : "",
    childLimit.getMonthCount() ? `${childLimit.getMonthCount()}个月` : "",
    childLimit.getDayCount() ? `${childLimit.getDayCount()}天` : "",
    childLimit.getHourCount() ? `${childLimit.getHourCount()}小时` : "",
    childLimit.getMinuteCount() ? `${childLimit.getMinuteCount()}分` : "",
  ].filter(Boolean).join("");
  return {
    direction: childLimit.isForward() ? "顺排" : "逆排",
    startAgeText: startParts || "出生后不久",
    startDate: childLimit.getEndTime().toString(),
    currentYear,
    currentGanZhi: current?.ganZhi ?? "童限",
    periods,
  };
}

export function validateBirth(input: BirthInput): string | null {
  if (![input.year, input.month, input.day, input.hour].every(Number.isInteger)) return "Birth fields must be integers.";
  if (input.year < 1900 || input.year > 2100) return "Year must be between 1900 and 2100.";
  if (input.month < 1 || input.month > 12) return "Month must be between 1 and 12.";
  if (input.calendarType === "lunar") {
    try {
      Lunar.fromYmdHms(input.year, input.isLeapMonth ? -input.month : input.month, input.day, input.hour, input.minute ?? 0, 0);
    } catch {
      return "所选农历日期不存在，请检查月份、日期或闰月。";
    }
    if (input.day < 1 || input.day > 30) return "农历日期必须在初一至三十之间。";
    if (input.hour < 0 || input.hour > 23) return "Hour must be between 0 and 23.";
    if ((input.minute ?? 0) < 0 || (input.minute ?? 0) > 59) return "Minute must be between 0 and 59.";
    return null;
  }
  const days = new Date(input.year, input.month, 0).getDate();
  if (input.day < 1 || input.day > days) return "Day is not valid for the selected month.";
  if (input.hour < 0 || input.hour > 23) return "Hour must be between 0 and 23.";
  if ((input.minute ?? 0) < 0 || (input.minute ?? 0) > 59) return "Minute must be between 0 and 59.";
  return null;
}

export function calculateBazi(birth: BirthInput): Bazi {
  const solarBirth = toSolarBirth(birth);
  const solar = Solar.fromYmdHms(solarBirth.year, solarBirth.month, solarBirth.day, solarBirth.hour, solarBirth.minute ?? 0, 0);
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
  const branchWeights = [[8, 5, 2], [20, 10, 5], [8, 5, 2], [10, 6, 4]];
  const stemWeights = [5, 5, 0, 5];
  const weightedElements: Elements = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  details.forEach(([, hiddenStems], pillarIndex) => {
    const visibleStem = values[pillarIndex][0];
    const visibleKey = stemElements[stems.indexOf(visibleStem)];
    if (visibleKey) weightedElements[visibleKey] += stemWeights[pillarIndex];
    hiddenStems.forEach((stem, hiddenIndex) => {
      const key = stemElements[stems.indexOf(stem)];
      if (key) weightedElements[key] += branchWeights[pillarIndex][hiddenIndex] ?? 0;
    });
  });
  const weightedTotal = Object.values(weightedElements).reduce((sum, value) => sum + value, 0) || 1;
  const elementStrength = Object.fromEntries(
    Object.entries(weightedElements).map(([key, value]) => [key, Math.round(value / weightedTotal * 1000) / 10]),
  ) as Elements;

  return {
    yearPillar: values[0],
    monthPillar: values[1],
    dayPillar: values[2],
    hourPillar: values[3],
    elements,
    elementStrength,
    solarDate: solar.toYmdHms(),
    lunarDate: lunar.toString(),
    previousSolarTerm: { name: prev.getName(), at: prev.getSolar().toYmdHms() },
    nextSolarTerm: { name: next.getName(), at: next.getSolar().toYmdHms() },
    pillars: details.map(([label, hiddenStems, hiddenTenGods, tenGod, naYin, stage], index) => ({
      label, gan: values[index][0], zhi: values[index][1], hiddenStems, hiddenTenGods,
      tenGod, naYin, wuXing: wuXing[index], stage,
    })),
  };
}

export function calculateZodiac(birth: BirthInput): Zodiac {
  const { month, day } = toSolarBirth(birth);
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
  const luckCycles = calculateLuckCycles(birth);
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
  const deepMeta: Record<string, {
    category: UserProfile["deepAnalysis"][number]["category"];
    descriptors: [string, string, string, string, string];
    keywords: [string[], string[], string[], string[], string[]];
    scenes: (score: number) => UserProfile["deepAnalysis"][number]["sceneInsights"];
  }> = {
    ambition: {
      category: "成长与行动",
      descriptors: ["强目标型推进者", "主动破局者", "选择性进取者", "稳态经营者", "体验优先者"],
      keywords: [["好胜", "果断", "突破"], ["进取", "敢试", "结果导向"], ["审慎", "择机", "有后劲"], ["稳健", "耐心", "少冒险"], ["随性", "低竞争", "重体验"]],
      scenes: (score) => [
        { scene: "感情中", title: score >= 60 ? "会想把关系往前推" : "不急着定义关系进度", text: score >= 60 ? "喜欢的人会被纳入未来计划，暧昧过久容易失去耐心，也可能把“确认关系”当成一个必须完成的目标。" : "更在意相处是否舒服，不会为了赶进度强行确认，通常需要生活质量与关系目标同时成立。" },
        { scene: "人际中", title: score >= 60 ? "容易成为发起者" : "更愿意做稳定参与者", text: score >= 60 ? "面对机会、项目或竞争场景，会自然抢先承担难题；别人容易觉得你有主见，也可能感到被推进。" : "不争无意义的主导权，只有遇到真正认同的目标才会持续投入。" },
        { scene: "压力下", title: score >= 60 ? "越难越容易兴奋" : "先保住节奏再行动", text: score >= 60 ? "七杀与伤官会把压力转成行动，但需防止用不断加码证明自己。" : "倾向先评估风险与消耗，确定值得后再投入，不适合长期高压驱动。" },
      ],
    },
    vigilance: {
      category: "亲密与安全",
      descriptors: ["高警觉验证型", "谨慎观察型", "边走边验证型", "善意优先型", "低防御信任型"],
      keywords: [["多疑", "敏锐", "反复核对"], ["谨慎", "看细节", "慢交付"], ["观察", "可沟通", "有保留"], ["松弛", "愿解释", "少预设"], ["直接信任", "低防御", "不内耗"]],
      scenes: (score) => [
        { scene: "感情中", title: score >= 60 ? "会检查前后一致性" : "更愿意先相信善意", text: score >= 60 ? "回复速度、措辞变化和承诺是否兑现都会被纳入判断；信息空白时容易自己补全原因。" : "对方只要整体稳定，就不太会逐条审查信号，猜疑通常来自明确矛盾而非日常波动。" },
        { scene: "人际中", title: score >= 60 ? "入口窄，识人靠长期观察" : "关系入口较轻松", text: score >= 60 ? "不会因为短期热络就交底，更相信持续行动；优点是识别风险早，代价是别人可能觉得一直在被考试。" : "愿意通过聊天快速建立基本信任，但仍需要事实来决定关系深度。" },
        { scene: "压力下", title: score >= 60 ? "最坏情境会先进入脑内" : "倾向直接确认事实", text: score >= 60 ? "偏印负责推演、七杀负责预警，容易在证据不足时过度解释沉默。" : "更可能直接询问或等待信息补齐，不会长期停留在猜测里。" },
      ],
    },
    autonomy: {
      category: "边界与冲突",
      descriptors: ["强自主边界型", "独立协商型", "共享与独处平衡型", "关系协同型", "高度共同体型"],
      keywords: [["独立", "不服管", "空间感"], ["自主", "讲边界", "可协商"], ["平衡", "互相尊重", "能共享"], ["配合", "重共同", "愿让步"], ["黏合", "共决策", "高共享"]],
      scenes: (score) => [
        { scene: "感情中", title: score >= 60 ? "亲密不等于交出决定权" : "更享受共同安排", text: score >= 60 ? "需要保留自己的时间、朋友和判断，被连续追问会先退开；清楚告知空间需求比突然消失更重要。" : "愿意把日程与重要决定放进关系里讨论，长期各自行动反而会削弱连接感。" },
        { scene: "人际中", title: score >= 60 ? "平等比照顾更重要" : "容易进入团队节奏", text: score >= 60 ? "不喜欢居高临下的建议，对被管理或被替你决定非常敏感。" : "能根据团队需要调整个人节奏，关系稳定时也愿意让出部分主导权。" },
        { scene: "压力下", title: score >= 60 ? "先独处恢复控制感" : "会寻求共同商量", text: score >= 60 ? "比肩、劫财和偏印让你先靠自己消化，外界越催越可能沉默。" : "更愿意把问题带回关系或团队中处理，完全独自承担会增加不安。" },
      ],
    },
    social_openness: {
      category: "沟通与连接",
      descriptors: ["流动社交型", "主动连接型", "情境开放型", "熟人深交型", "小圈层守门型"],
      keywords: [["人来熟", "话题多", "圈层流动"], ["主动", "会破冰", "外部取向"], ["看场合", "可热可静", "先判断"], ["慢热", "少而深", "熟人舒展"], ["封闭入口", "固定圈层", "低社交耗散"]],
      scenes: (score) => [
        { scene: "感情中", title: score >= 60 ? "容易从互动热度进入关系" : "更可能从熟悉感进入关系", text: score >= 60 ? "偏财与食伤让你愿意制造话题、邀约和新鲜体验，关系通常先有流动再谈稳定。" : "需要多次自然接触才会展示真实热度，突然的高强度示好反而可能造成负担。" },
        { scene: "人际中", title: score >= 60 ? "擅长打开新连接" : "擅长维护核心关系", text: score >= 60 ? "在陌生环境较容易找到共同话题，但要注意连接广度不自动等于关系深度。" : "不追求认识很多人，优势是能把有限精力投入少数可信关系。" },
        { scene: "压力下", title: score >= 60 ? "通过外部互动换气" : "通过减少社交恢复", text: score >= 60 ? "聊天、换场景和接触新信息能帮你恢复流动感。" : "需要缩小关系半径，回到熟人或独处环境才容易恢复。" },
      ],
    },
    trust_speed: {
      category: "亲密与安全",
      descriptors: ["快速交付型", "开放确认型", "渐进信任型", "慢速验证型", "长期审查型"],
      keywords: [["信任快", "敢暴露", "先连接"], ["开放", "看一致性", "可推进"], ["渐进", "边走边看", "事实导向"], ["慢热", "重兑现", "防受伤"], ["极慢交付", "高验证", "核心保留"]],
      scenes: (score) => [
        { scene: "感情中", title: score >= 60 ? "好感容易转成真实靠近" : "有好感也不会立刻交底", text: score >= 60 ? "只要对方回应稳定，就愿意分享更私人的信息；需区分亲密感和真实可靠性。" : "语言热度不能直接换来信任，需要时间、行动一致和边界尊重。" },
        { scene: "人际中", title: score >= 60 ? "合作先从基本信任开始" : "合作先从小事验证开始", text: score >= 60 ? "愿意先给机会，再根据后续表现调整关系层级。" : "更习惯用小承诺、小合作观察可靠度，不喜欢被催着交付信任。" },
        { scene: "压力下", title: score >= 60 ? "仍愿意求助" : "容易收回核心信息", text: score >= 60 ? "遇到困难较可能向可信对象表达需要。" : "受伤后会延长验证周期，需要明确的修复动作而非口头保证。" },
      ],
    },
    dependency: {
      category: "亲密与安全",
      descriptors: ["高连接依恋型", "回应敏感型", "弹性依恋型", "自主依恋型", "低依赖独行型"],
      keywords: [["黏着", "需要确认", "情绪联动"], ["重回应", "怕降温", "需要陪伴"], ["可亲密", "可独处", "安全感弹性"], ["自主", "少确认", "有个人领域"], ["低依赖", "自我消化", "不爱求助"]],
      scenes: (score) => [
        { scene: "感情中", title: score >= 60 ? "联系连续性会影响安全感" : "亲密之外仍需要个人生活", text: score >= 60 ? "关系状态容易牵动日常情绪，对方忙碌时若没有说明，可能被理解为降温。" : "不会把所有情绪都交给关系处理，对高频确认需求可能感到被占用。" },
        { scene: "人际中", title: score >= 60 ? "重视被记得和被回应" : "重视互不拖累的可靠", text: score >= 60 ? "愿意照顾关系，也期待对方持续反馈；单向付出会很快积累委屈。" : "朋友不必高频联系，但关键时刻是否出现很重要。" },
        { scene: "压力下", title: score >= 60 ? "会放大关系反馈" : "先自己消化再决定是否求助", text: score >= 60 ? "沉默、失联和含糊回应更容易触发不安，需要事先约定忙碌时的沟通方式。" : "不容易主动说需要，别人可能误判为你完全不需要支持。" },
      ],
    },
    responsibility: {
      category: "成长与行动",
      descriptors: ["高承诺承担型", "稳定兑现型", "边界责任型", "弹性承诺型", "自由流动型"],
      keywords: [["负责", "长期主义", "容易多扛"], ["可靠", "守约", "可持续"], ["公平", "分工", "看边界"], ["灵活", "不爱被框", "看状态"], ["自由", "低结构", "抗拒固定"]],
      scenes: (score) => [
        { scene: "感情中", title: score >= 60 ? "确认后会进入经营模式" : "更重视当下真实感", text: score >= 60 ? "会记住约定、规划未来并处理现实问题；风险是把照顾变成单方面兜底。" : "不喜欢让承诺先于感受，关系需要清楚讨论什么是双方都能长期做到的。" },
        { scene: "人际中", title: score >= 60 ? "容易成为可靠的人" : "更愿意按真实能力承诺", text: score >= 60 ? "别人会把重要任务交给你，但也可能默认你会处理所有收尾。" : "不会轻易答应，答应前会保留弹性，需要明确分工才更稳定。" },
        { scene: "压力下", title: score >= 60 ? "先扛责任后处理自己" : "先调整承诺再恢复", text: score >= 60 ? "正官、正财会推动你维持秩序，需防止过度承担造成隐性怨气。" : "压力过大时会重新评估投入，不适合用道德压力推动。" },
      ],
    },
    romance: {
      category: "沟通与连接",
      descriptors: ["热烈示好型", "主动营造型", "氛围回应型", "行动含蓄型", "低调陪伴型"],
      keywords: [["会撩", "制造惊喜", "推进快"], ["主动", "有仪式", "重体验"], ["看氛围", "有回应", "不冒进"], ["含蓄", "用行动", "慢升温"], ["低表达", "陪伴式", "不爱表演"]],
      scenes: (score) => [
        { scene: "感情中", title: score >= 60 ? "喜欢让好感被看见" : "喜欢藏在行动里", text: score >= 60 ? "会通过邀约、分享和新场景制造关系温度，也期待对方给出明确反馈。" : "示爱更像陪伴、解决问题和记住细节，若对方只识别语言热度，容易错过你的信号。" },
        { scene: "人际中", title: score >= 60 ? "擅长制造共同体验" : "擅长提供稳定在场", text: score >= 60 ? "聚会、旅行和兴趣活动会成为建立关系的主要方式。" : "不一定组织热闹活动，但在具体需要时更容易出现。" },
        { scene: "压力下", title: score >= 60 ? "会用行动找回热度" : "浪漫表达会先收缩", text: score >= 60 ? "关系降温时倾向安排一次新的互动重新连接。" : "压力越高越务实，需要对方看见低调投入而不是只追问情绪表达。" },
      ],
    },
    empathy_deep: {
      category: "沟通与连接",
      descriptors: ["高共感吸收型", "细腻体察型", "感受判断平衡型", "事实共情型", "方案优先型"],
      keywords: [["高敏感", "会吸收", "情绪雷达"], ["细腻", "先陪伴", "读空气"], ["理解", "不失判断", "可切换"], ["需要明说", "重事实", "少猜测"], ["解决问题", "低情绪读取", "直接"]],
      scenes: (score) => [
        { scene: "感情中", title: score >= 60 ? "容易听见话外情绪" : "需要对方把需求说清", text: score >= 60 ? "语气、停顿与情绪变化都会被接收，优点是细腻，风险是把对方情绪背到自己身上。" : "表达越具体越容易给出有效回应，暗示和试探反而会造成错位。" },
        { scene: "人际中", title: score >= 60 ? "常成为倾听与缓冲者" : "常成为问题解决者", text: score >= 60 ? "能提前感知气氛变化，但需要学会问“这是你的感受，还是我的责任”。" : "更擅长梳理事实、提供方案，不代表冷漠，只是共情入口不同。" },
        { scene: "压力下", title: score >= 60 ? "容易情绪过载" : "容易显得过早讲道理", text: score >= 60 ? "多人情绪同时出现时会消耗很快，需要明确边界与恢复时间。" : "七杀或理性信号会先处理问题，记得先确认感受再给建议。" },
      ],
    },
    resilience: {
      category: "成长与行动",
      descriptors: ["高压聚焦型", "危机行动型", "可恢复承压型", "稳定环境型", "高敏恢复型"],
      keywords: [["抗压", "硬撑", "先解决"], ["果断", "能扛事", "延后情绪"], ["有韧性", "需恢复", "可求助"], ["怕持续不确定", "重节奏", "需缓冲"], ["敏感", "易耗竭", "需要安全"]],
      scenes: (score) => [
        { scene: "感情中", title: score >= 60 ? "危机里先处理问题" : "需要先确认关系安全", text: score >= 60 ? "遇到矛盾会先找解决方案，情绪可能延后出现；伴侣容易误以为你没有感受。" : "持续冲突会明显消耗连接感，明确暂停与恢复时间比硬谈到底更有效。" },
        { scene: "人际中", title: score >= 60 ? "关键时刻容易被依赖" : "适合稳定可预期的协作", text: score >= 60 ? "突发任务中能快速集中，但长期被当作救火队会透支。" : "准备充分时表现稳定，不适合反复临时变更与高压催促。" },
        { scene: "压力下", title: score >= 60 ? "能扛，但恢复可能滞后" : "恢复需要更明确的缓冲", text: score >= 60 ? "注意压力结束后的失眠、空耗或迟发情绪，高韧性不等于无需支持。" : "减少刺激、恢复规律和获得具体支持，比要求自己立刻振作更有效。" },
      ],
    },
    conflict_expression: {
      category: "边界与冲突",
      descriptors: ["锋利直球型", "主动摊牌型", "协商表达型", "延后表达型", "回避冲突型"],
      keywords: [["直言", "攻击性风险", "不忍"], ["敢说", "重真实", "语气先行"], ["协商", "看后果", "能调整"], ["压住", "事后说", "怕伤关系"], ["退让", "沉默", "积累不满"]],
      scenes: (score) => [
        { scene: "感情中", title: score >= 60 ? "问题会很快被摆上桌" : "问题容易在心里停留", text: score >= 60 ? "伤官与劫财让你不愿装作没事，清楚是优势，情绪高时则可能把诚实变成刺。" : "会先考虑关系后果再说，不满若长期延后，容易在小事上集中爆发。" },
        { scene: "人际中", title: score >= 60 ? "敢挑战不合理规则" : "擅长维持表面合作", text: score >= 60 ? "能说出群体里没人愿意说的问题，但要区分解决问题和证明对方错误。" : "更愿意私下沟通或用委婉方式修正，需避免默认别人能读懂暗示。" },
        { scene: "压力下", title: score >= 60 ? "语速与锋利度一起上升" : "沉默与退让先出现", text: score >= 60 ? "先描述事实和需要，再评价动机，可以减少伤官式越界。" : "先说“我需要暂停，但会回来谈”，避免沉默被误解为惩罚。" },
      ],
    },
    novelty: {
      category: "边界与冲突",
      descriptors: ["高变化需求型", "持续更新型", "仪式与变化平衡型", "熟悉积累型", "固定节奏依赖型"],
      keywords: [["怕无聊", "探索", "易厌重复"], ["爱尝试", "要成长", "主动更新"], ["稳定中求新", "有仪式", "可持续"], ["熟悉", "低刺激", "重积累"], ["固定", "可预期", "抗变化"]],
      scenes: (score) => [
        { scene: "感情中", title: score >= 60 ? "稳定里也必须有更新" : "重复会累积安全感", text: score >= 60 ? "需要新话题、共同成长或新体验来维持投入；这不等于容易变心，而是关系不能长期停滞。" : "固定联系、熟悉地点和共同习惯会让感情更稳，频繁制造刺激反而可能疲惫。" },
        { scene: "人际中", title: score >= 60 ? "喜欢跨圈层与新项目" : "喜欢长期熟人与固定合作", text: score >= 60 ? "新的观点和场景能激活你，关系网络可能随阶段流动。" : "信任与默契来自时间累积，不会仅因新鲜就更换关系。" },
        { scene: "压力下", title: score >= 60 ? "会通过换场景重新启动" : "会通过恢复秩序稳定自己", text: score >= 60 ? "短途出行、新计划或学习新东西能打破停滞。" : "回到固定作息与熟悉环境更有恢复力，突然变化需要预告。" },
      ],
    },
  };
  const rankedScores = deepBase
    .map((item, index) => ({ raw: item.score, index }))
    .sort((a, b) => a.raw - b.raw || a.index - b.index);
  const deepAnalysis = deepBase.map((item, itemIndex) => {
    const rank = rankedScores.findIndex((entry) => entry.index === itemIndex);
    const rankScore = 18 + rank / Math.max(1, rankedScores.length - 1) * 74;
    const score = clamp(item.score * .45 + rankScore * .55);
    const band = deepBandIndex(score);
    const meta = deepMeta[item.key];
    return {
      ...item,
      score,
      level: level(score),
      category: meta.category,
      descriptor: meta.descriptors[band],
      keywords: meta.keywords[band],
      summary: deepBandTexts[item.key][band],
      sceneInsights: meta.scenes(score),
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
  // 三合/三会完整成局的五行，对应十神组获得底层加权后再定主格
  const roleGroups: Record<string, string[]> = { 比劫: ["比肩", "劫财"], 食伤: ["食神", "伤官"], 财星: ["正财", "偏财"], 官杀: ["正官", "七杀"], 印星: ["正印", "偏印"] };
  const adjustedGodCounts = { ...godCounts };
  specialPoints.filter((point) => (point.type === "三合" || point.type === "三会") && point.strength >= 90).forEach((point) => {
    const element = point.title.slice(-1);
    const role = elementRoleForDayMaster(bazi.dayPillar[0], element);
    const bonus = point.type === "三会" ? 9 : 7;
    (roleGroups[role] ?? []).forEach((god) => { adjustedGodCounts[god as keyof typeof adjustedGodCounts] = Math.round((adjustedGodCounts[god as keyof typeof adjustedGodCounts] + bonus) * 100) / 100; });
  });
  const baselineDominant = godNames.slice().sort((a, b) => godCounts[b] - godCounts[a])[0];
  const dominantGodName = godNames.slice().sort((a, b) => adjustedGodCounts[b] - adjustedGodCounts[a])[0];
  const secondaryGodName = godNames.slice().sort((a, b) => adjustedGodCounts[b] - adjustedGodCounts[a])[1];
  const dominantTrio = specialPoints.find((point) => (point.type === "三合" || point.type === "三会") && point.strength >= 90
    && (roleGroups[elementRoleForDayMaster(bazi.dayPillar[0], point.title.slice(-1))] ?? []).includes(dominantGodName));
  const dominantBasis = dominantTrio && dominantGodName !== baselineDominant
    ? `${dominantTrio.type}成局定格 · ${dominantTrio.branches.join("")}${dominantTrio.title.slice(-1)}局`
    : dominantTrio
      ? `月令定格 · ${dominantTrio.type}${dominantTrio.title.slice(-1)}局同气加持`
      : "月令主导定格";
  const persona = tenGodPersonas[dominantGodName];
  const secondary = tenGodPersonas[secondaryGodName];
  const dominantPersona = { god: dominantGodName, ...persona, weight: adjustedGodCounts[dominantGodName] };
  const secondaryPersona = { god: secondaryGodName, ...secondary, weight: adjustedGodCounts[secondaryGodName] };
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
  const rawDeep = (key: string) => deepBase.find((item) => item.key === key)?.score ?? 50;
  // 社交行为模式：综合深维原始分、十神权重与人格四维定档
  const enrichedSocial: SocialProfile = {
    communication_need: personality.extroversion >= 68 || rawDeep("dependency") >= 62 || tenGodAnalysis[4].score >= 34
      ? "high"
      : personality.extroversion < 46 && rawDeep("autonomy") >= 52 ? "low" : "medium",
    conflict_tolerance: personality.stability >= 60 || rawDeep("resilience") >= 58 || tenGodAnalysis[0].score >= 30 ? "high" : "low",
    relationship_speed: rawDeep("trust_speed") >= 62 && rawDeep("social_openness") >= 52
      ? "fast"
      : rawDeep("trust_speed") <= 45 || rawDeep("vigilance") >= 60 ? "slow" : "medium",
    attachment_style: rawDeep("dependency") >= 58 && (personality.emotion >= 66 || rawDeep("vigilance") >= 56)
      ? "anxious"
      : rawDeep("autonomy") >= 62 && rawDeep("trust_speed") <= 52 ? "avoidant" : "secure",
  };
  const archetype = `${elementName}系${persona.name}`;
  const identityTags = [
    enrichedSocial.relationship_speed === "slow" ? "慢热关系" : enrichedSocial.relationship_speed === "fast" ? "快速靠近" : "自然升温",
    personality.stability >= 68 ? "情绪稳定" : personality.emotion >= 68 ? "感受细腻" : "理性感性平衡",
    personality.control >= 65 ? "边界清晰" : expressiveness >= 65 ? "善于表达" : "重视默契",
  ];
  const tenSpiritDays = new Set(["甲辰", "乙亥", "丙辰", "丁酉", "戊午", "庚戌", "庚寅", "辛亥", "壬寅", "癸未"]);
  const isTenSpiritDay = tenSpiritDays.has(bazi.dayPillar);
  const groupTarget = (branch: string, kind: "huagai" | "peach") => {
    if (["寅", "午", "戌"].includes(branch)) return kind === "huagai" ? "戌" : "卯";
    if (["亥", "卯", "未"].includes(branch)) return kind === "huagai" ? "未" : "子";
    if (["申", "子", "辰"].includes(branch)) return kind === "huagai" ? "辰" : "酉";
    return kind === "huagai" ? "丑" : "午";
  };
  const bases = [bazi.pillars[0].zhi, bazi.pillars[2].zhi];
  const huagaiTargets: string[] = [...new Set<string>(bases.map((branch) => groupTarget(branch, "huagai")))];
  const peachTargets: string[] = [...new Set<string>(bases.map((branch) => groupTarget(branch, "peach")))];
  const huagaiCount = branchEntries.filter((entry) => huagaiTargets.includes(entry.branch)).length;
  const peachCount = branchEntries.filter((entry) => peachTargets.includes(entry.branch)).length;
  const relationshipPenalty = birth.gender === "male"
    ? Math.max(0, Math.min(25, g("劫财") * 10 + g("比肩") * 4 - g("正财") * 2))
    : birth.gender === "female"
      ? Math.max(0, Math.min(25, g("伤官") * 8 + Math.min(g("伤官"), g("正官") + g("七杀")) * 8))
      : Math.max(0, Math.min(18, g("劫财") * 5 + g("伤官") * 5));
  const specialtyLevel = (score: number) => score >= 82 ? "非常突出" : score >= 65 ? "明显" : score >= 45 ? "中等" : score >= 28 ? "偏弱" : "低显";
  const specialty = (
    key: UserProfile["specialtyAnalysis"][number]["key"], label: string, raw: number,
    descriptors: [string, string, string], summaries: [string, string, string], evidence: string[], caution: string,
  ) => {
    const score = clamp(raw);
    const band = score >= 68 ? 0 : score >= 42 ? 1 : 2;
    return { key, label, score, level: specialtyLevel(score), descriptor: descriptors[band], summary: summaries[band], evidence, caution };
  };
  const specialtyAnalysis: UserProfile["specialtyAnalysis"] = [
    specialty("intuition", "玄学感知力",
      24 + g("偏印") * 14 + g("正印") * 5 + huagaiCount * 12 + (isTenSpiritDay ? 15 : 0) + bazi.elements.water * 3,
      ["直觉捕捉型", "理性验证型", "现实感知型"],
      ["对隐喻、象征与他人未说出口的状态更敏锐，适合把直觉发展成可复盘的方法。", "有感受力，但通常需要知识框架或现实证据确认，不会只凭第一感觉下结论。", "更依赖直接经验与清晰信息，玄学兴趣未必低，只是不容易把模糊感受当作依据。"],
      [`偏印 ${g("偏印")}×14，正印 ${g("正印")}×5`, `华盖命中 ${huagaiCount}×12`, `十灵日 ${isTenSpiritDay ? "命中 +15" : "未命中"}`, `水元素 ${bazi.elements.water}×3`],
      "此分数衡量象征感知、模式联想与直觉敏锐度，不代表超自然能力。"),
    specialty("love_structure", "感情结构稳定度",
      50 + g("正财") * 7 + g("正官") * 6 + g("正印") * 4 + personality.stability * .16 - relationshipPenalty,
      ["持续经营型", "需要磨合型", "高波动课题型"],
      ["更容易把喜欢落实为持续投入、责任和可预期的行动。", "有进入关系的能力，但投入、表达与边界之间需要现实磨合。", "关系里较容易出现竞争、挑剔或承诺压力，重点不是“好不好”，而是能否识别自己的触发模式。"],
      [`正财 ${g("正财")}×7，正官 ${g("正官")}×6，正印 ${g("正印")}×4`, `稳定度 ${personality.stability}×0.16`, birth.gender === "male" ? `男命比劫对财星修正 −${relationshipPenalty.toFixed(1)}` : birth.gender === "female" ? `女命伤官与官杀同见修正 −${relationshipPenalty.toFixed(1)}` : `比劫与伤官综合修正 −${relationshipPenalty.toFixed(1)}`],
      "这是关系经营成本模型，不判断婚姻吉凶；真实关系仍取决于选择、沟通和环境。"),
    specialty("attraction", "心动与吸引力",
      31 + peachCount * 12 + g("偏财") * 7 + g("伤官") * 5 + g("食神") * 4 + bazi.elements.fire * 3,
      ["高辨识度型", "氛围启动型", "熟悉后显现型"],
      ["容易通过表达、反差或社交流动形成辨识度，关系开场通常不缺记忆点。", "吸引力更依赖合适场景与互动反馈，不一定第一眼强烈，但有继续聊的空间。", "魅力通常在熟悉与安全感建立后出现，第一印象可能比真实状态安静。"],
      [`桃花支命中 ${peachCount}×12`, `偏财 ${g("偏财")}×7，伤官 ${g("伤官")}×5，食神 ${g("食神")}×4`, `火元素 ${bazi.elements.fire}×3`],
      "吸引力不等于关系质量，高分更需要边界与筛选能力。"),
    specialty("creative_sensitivity", "审美与创作灵感",
      27 + g("伤官") * 8 + g("食神") * 7 + g("偏印") * 8 + huagaiCount * 7 + bazi.elements.wood * 3,
      ["非线性创作型", "输入转化型", "实用表达型"],
      ["更容易把跳跃联想、私人感受和独特视角转化为作品或表达。", "需要持续输入与具体主题才能进入状态，灵感和执行之间要靠结构连接。", "偏好清晰、实用和可落地的表达，创作冲动不是主要驱动力。"],
      [`伤官 ${g("伤官")}×8，食神 ${g("食神")}×7`, `偏印 ${g("偏印")}×8，华盖 ${huagaiCount}×7`, `木元素 ${bazi.elements.wood}×3`],
      "高灵感不等于高产出；完成度仍依赖训练、时间和反馈。"),
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
    socialProfile: enrichedSocial,
    archetype,
    dominantBasis,
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
    specialtyAnalysis,
    summary: `你的五行以${elementName}为主要能量，日主为${bazi.dayPillar[0]}。${zodiacName}为这组底色加入了新的表达方式：你有${({ low: "较低", medium: "适中", high: "较高" } as const)[enrichedSocial.communication_need]}的沟通需求，关系通常以${({ slow: "慢热", medium: "自然", fast: "快速" } as const)[enrichedSocial.relationship_speed]}的节奏展开，并呈现${({ secure: "安全型", anxious: "焦虑型", avoidant: "回避型" } as const)[enrichedSocial.attachment_style]}依恋倾向。`,
  };
}

const traitScore = (profile: UserProfile, key: string) =>
  profile.traitAnalysis.find((item) => item.key === key)?.score ?? 50;

const deepScore = (profile: UserProfile, key: string) =>
  profile.deepAnalysis.find((item) => item.key === key)?.score ?? 50;

function compatibilityBreakdown(
  a: UserProfile,
  b: UserProfile,
  relationType = "恋爱",
  dynamics: RelationshipAnalysis["branchDynamics"] = [],
): RelationshipAnalysis["scoreBreakdown"] {
  const difference = (left: number, right: number) => Math.abs(left - right);
  const extGap = difference(a.personality.extroversion, b.personality.extroversion);
  const expressionGap = difference(traitScore(a, "expressiveness"), traitScore(b, "expressiveness"));
  const emotionGap = difference(a.personality.emotion, b.personality.emotion);
  const paceMap = { slow: 0, medium: 1, fast: 2 };
  const paceGap = Math.abs(paceMap[a.socialProfile.relationship_speed] - paceMap[b.socialProfile.relationship_speed]);
  const controlGap = difference(a.personality.control, b.personality.control);
  const autonomyGap = difference(deepScore(a, "autonomy"), deepScore(b, "autonomy"));
  const noveltyGap = difference(deepScore(a, "novelty"), deepScore(b, "novelty"));
  const conflictGap = difference(deepScore(a, "conflict_expression"), deepScore(b, "conflict_expression"));
  const resilienceA = deepScore(a, "resilience");
  const resilienceB = deepScore(b, "resilience");
  const groupScore = (profile: UserProfile, key: string) => profile.tenGodAnalysis.find((item) => item.key === key)?.score ?? 0;
  const elementComplement =
    Math.min(a.bazi.elements.fire + b.bazi.elements.water, b.bazi.elements.fire + a.bazi.elements.water)
    + Math.min(a.bazi.elements.wood + b.bazi.elements.metal, b.bazi.elements.wood + a.bazi.elements.metal);
  const positiveDynamic = dynamics.filter((item) => item.scoreImpact > 0).reduce((sum, item) => sum + item.scoreImpact, 0);
  const frictionDynamic = Math.abs(dynamics.filter((item) => item.scoreImpact < 0).reduce((sum, item) => sum + item.scoreImpact, 0));
  const dayDynamic = dynamics
    .filter((item) => item.userPillars.includes("日柱") || item.partnerPillars.includes("日柱"))
    .reduce((sum, item) => sum + item.scoreImpact, 0);

  const attraction = clamp(52 + Math.min(16, elementComplement * 1.6) + positiveDynamic * .7
    + (extGap >= 12 && extGap <= 36 ? 7 : extGap > 48 ? -6 : 2));
  const emotionalHolding = clamp(58 - emotionGap * .32
    + Math.min(a.personality.stability, b.personality.stability) * .28
    + Math.min(groupScore(a, "resource"), groupScore(b, "resource")) * .16
    - (a.socialProfile.attachment_style !== b.socialProfile.attachment_style ? 7 : 0));
  const expressionTranslation = clamp(74 - expressionGap * .38 - emotionGap * .18
    + Math.min(groupScore(a, "output"), groupScore(b, "output")) * .15
    + Math.min(groupScore(a, "resource"), groupScore(b, "resource")) * .12);
  const powerNegotiation = clamp(84 - controlGap * .34 - autonomyGap * .3
    - (a.personality.control >= 72 && b.personality.control >= 72 ? 9 : 0) - frictionDynamic * .45);
  const dailyBond = clamp(78 - paceGap * 14 - noveltyGap * .24 + dayDynamic * .85
    + Math.min(groupScore(a, "wealth"), groupScore(b, "wealth")) * .12);
  const repair = clamp(48 + Math.min(a.personality.stability, b.personality.stability) * .27
    + Math.min(resilienceA, resilienceB) * .24 - conflictGap * .22 - frictionDynamic * .35);

  const weights = relationType === "同事"
    ? { attraction: 8, emotional: 12, expression: 22, power: 24, daily: 14, repair: 20 }
    : relationType === "朋友"
      ? { attraction: 15, emotional: 17, expression: 22, power: 14, daily: 17, repair: 15 }
      : relationType === "家人"
        ? { attraction: 4, emotional: 23, expression: 19, power: 18, daily: 18, repair: 18 }
        : { attraction: 20, emotional: 22, expression: 16, power: 14, daily: 16, repair: 12 };
  const dynamicLabels = dynamics.length ? dynamics.map((item) => `${item.title}${item.scoreImpact > 0 ? "+" : ""}${item.scoreImpact}`).join("、") : "无强合冲";
  const items = [
    { key: "attraction", label: "初见引力", score: attraction, weight: weights.attraction, summary: attraction >= 70 ? "差异与互补能形成明显注意力，容易很快感到对方有意思。" : "吸引更依赖共同经历，不一定在第一眼就形成强张力。", basis: [`火水、木金互补 ${elementComplement.toFixed(1)}`, `表达差 ${extGap}`, `合会增益 ${positiveDynamic}`] },
    { key: "emotional", label: "情绪承接", score: emotionalHolding, weight: weights.emotional, summary: emotionGap <= 18 ? "情绪浓度接近，感受较容易被对方识别。" : "两人的情绪音量不同，需要把安慰方式说清楚。", basis: [`情感差 ${emotionGap}`, `最低稳定度 ${Math.min(a.personality.stability, b.personality.stability)}`, `双方印星 ${groupScore(a, "resource")}/${groupScore(b, "resource")}`] },
    { key: "expression", label: "表达译码", score: expressionTranslation, weight: weights.expression, summary: expressionGap <= 15 ? "说话强度接近，表面含义与真实意图较少错位。" : "一方偏直接、一方偏内收，同一句话容易被翻译成不同意思。", basis: [`表达差 ${expressionGap}`, `双方食伤 ${groupScore(a, "output")}/${groupScore(b, "output")}`, `情感差 ${emotionGap}`] },
    { key: "power", label: "主导权协商", score: powerNegotiation, weight: weights.power, summary: controlGap <= 15 && autonomyGap <= 18 ? "对决定权和个人空间的预期接近。" : "谁定义关系、谁掌握节奏会成为真实议题。", basis: [`控制差 ${controlGap}`, `空间需求差 ${autonomyGap}`, `冲克压力 ${frictionDynamic}`] },
    { key: "daily", label: "日常黏合", score: dailyBond, weight: weights.daily, summary: paceGap === 0 && noveltyGap <= 18 ? "联系频率、约会更新和生活安排较容易形成稳定惯性。" : "热度不等于生活适配，需要试过真实日常才知道能否长期舒服。", basis: [`推进差 ${paceGap}`, `新鲜感差 ${noveltyGap}`, `日支结构 ${dayDynamic > 0 ? "+" : ""}${dayDynamic}`] },
    { key: "repair", label: "冲突修复", score: repair, weight: weights.repair, summary: repair >= 68 ? "出现分歧后仍有能力回到事实、责任和下一步。" : "冲突后容易各自防御，需要提前约定暂停与重启方式。", basis: [`压力韧性 ${resilienceA}/${resilienceB}`, `冲突表达差 ${conflictGap}`, `跨盘结构 ${dynamicLabels}`] },
  ];
  return items.map((item) => ({ ...item, contribution: Math.round(item.score * item.weight) / 100 }));
}

export function matchProfiles(a: UserProfile, b: UserProfile): MatchResult {
  // 与 analyzeRelationship 走同一条算分通道：合冲修正一并计入，
  // 确保同一对人在任何入口看到同一个分数。
  const breakdown = compatibilityBreakdown(a, b, "恋爱", analyzeCrossBranchDynamics(a, b));
  const score = clamp(breakdown.reduce((sum, item) => sum + item.contribution, 0));
  const reasons = breakdown
    .slice()
    .sort((left, right) => right.contribution - left.contribution)
    .slice(0, 3)
    .map((item) => `${item.label} ${item.score} 分：${item.summary}`);
  return {
    score,
    reasons,
    analysis: explainMatch(score, reasons),
    breakdown,
  };
}

export function explainMatch(score: number, reasons: string[]): string {
  const tone = score >= 80 ? "你们呈现出很强的关系潜力" : score >= 65 ? "你们具备值得探索的互补空间" : "你们的连接更需要耐心建立";
  return `${tone}。${reasons.join("")}这份解释只描述规则结果，不替代真实互动；最好的验证，仍然是一次诚实而轻松的对话。`;
}

export type AnnualFlow = {
  stemElement: string;
  stemRole: string;
  stemTheme: string;
  specials: { name: string; summary: string }[];
  interactions: { type: "冲" | "六合" | "半合" | "同气"; title: string; summary: string }[];
};

// 流年干支与原局四柱的结构关系：只描述哪一柱的主题被触发，不作吉凶判断。
export function analyzeAnnualFlow(profile: UserProfile, ganZhi: string): AnnualFlow {
  const dayStem = profile.bazi.dayPillar[0];
  const elementCn: Record<keyof Elements, string> = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
  const stemElement = elementCn[stemElements[stems.indexOf(ganZhi[0])]];
  const stemRole = elementRoleForDayMaster(dayStem, stemElement);
  const roleThemes: Record<string, string> = {
    比劫: "自我立场与同伴关系", 食伤: "表达、体验与输出", 财星: "投入、经营与现实事务",
    官杀: "规则、责任与外部压力", 印星: "学习、支持与安全感",
  };
  const branch = ganZhi[1];
  const clashMap: Record<string, string> = { 子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅", 卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳" };
  const sixMap: Record<string, string> = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };
  const trioGroups: [string, string, string, string][] = [
    ["申", "子", "辰", "水"], ["亥", "卯", "未", "木"], ["寅", "午", "戌", "火"], ["巳", "酉", "丑", "金"],
  ];
  const interactions: AnnualFlow["interactions"] = [];
  profile.bazi.pillars.forEach((pillar) => {
    const god = pillar.hiddenTenGods[0] ?? "日主";
    if (clashMap[branch] === pillar.zhi) interactions.push({
      type: "冲", title: `流年${branch}冲${pillar.label}${pillar.zhi}`,
      summary: `${pillar.label}承载的${god}（${godThemesForRelationship(god)}）这一年更容易被外部事件正面触发，原有节奏会被打断或加速。`,
    });
    if (sixMap[branch] === pillar.zhi) interactions.push({
      type: "六合", title: `流年${branch}与${pillar.label}${pillar.zhi}六合`,
      summary: `外部环境与${pillar.label}的${god}（${godThemesForRelationship(god)}）更容易形成配合接口，相关主题推进阻力较小。`,
    });
    if (branch === pillar.zhi) interactions.push({
      type: "同气", title: `流年${branch}与${pillar.label}同支`,
      summary: `${pillar.label}的既有模式被同类能量加强，${god}相关的惯性这一年更明显。`,
    });
  });
  trioGroups.forEach(([first, second, third, element]) => {
    const group = [first, second, third];
    if (!group.includes(branch)) return;
    const partners = profile.bazi.pillars.filter((pillar) => group.includes(pillar.zhi) && pillar.zhi !== branch);
    if (!partners.length) return;
    const role = elementRoleForDayMaster(dayStem, element);
    interactions.push({
      type: "半合", title: `流年${branch}与${[...new Set(partners.map((pillar) => pillar.zhi))].join("、")}半合${element}`,
      summary: `${element}属性的主题（对你属于${role}，即${roleThemes[role]}）这一年更容易被激活，相关场景出现频率上升。`,
    });
  });
  // 特殊流年点：只描述场景密度与扰动强度，不作吉凶断言
  const dayBranch = profile.bazi.dayPillar[1];
  const chartYearBranch = profile.bazi.yearPillar[1];
  const peachOf = (base: string) => ["寅", "午", "戌"].includes(base) ? "卯" : ["亥", "卯", "未"].includes(base) ? "子" : ["申", "子", "辰"].includes(base) ? "酉" : "午";
  const specials: AnnualFlow["specials"] = [];
  if (branch === peachOf(dayBranch) || branch === peachOf(chartYearBranch)) specials.push({
    name: "桃花年",
    summary: `流年${branch}恰是你的桃花支（依${branch === peachOf(dayBranch) ? `日支${dayBranch}` : `年支${chartYearBranch}`}三合局取）。这一年被关注、被示好的场景明显变多，人际曝光上升——桃花说的是机会密度变大，不预言结果，筛选权始终在你手里。`,
  });
  const dayStemElement = elementCn[stemElements[stems.indexOf(dayStem)]];
  const controlsMap: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
  if (controlsMap[stemElement] === dayStemElement && clashMap[branch] === dayBranch) specials.push({
    name: "天克地冲",
    summary: `流年${ganZhi}与你的日柱${profile.bazi.dayPillar}天干相克、地支相冲，是十年里对身心与亲密关系扰动最强的年份之一。这一年重大决定建议放慢节奏、多留确认时间——扰动是变化的入口，不是坏事的判决。`,
  });
  if (branch === chartYearBranch) specials.push({
    name: "本命之年",
    summary: `流年${branch}与你的年支相同，传统称"值太岁"。这一年自我课题被放大，容易对现状生出重新选择的冲动——冲动是信号，落地之前多给自己一个季度的观察期。`,
  });
  trioGroups.forEach(([first, second, third, element]) => {
    const group = [first, second, third];
    if (!group.includes(branch)) return;
    const others = group.filter((item) => item !== branch);
    const chartBranches = profile.bazi.pillars.map((pillar) => pillar.zhi);
    if (others.every((item) => chartBranches.includes(item))) specials.push({
      name: "三合成局年",
      summary: `你的原局已有${others.join("、")}，流年${branch}补齐${group.join("")}三合${element}局。${element}所代表的主题（对你属${elementRoleForDayMaster(dayStem, element)}）这一年会成为高频主场，相关的人与事更容易主动找上门。`,
    });
  });
  return { stemElement, stemRole, stemTheme: roleThemes[stemRole], specials, interactions };
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
  const pillarWeight: Record<string, number> = { 月柱: 28, 日柱: 24, 时柱: 18, 年柱: 12 };
  const aEntries = a.bazi.pillars.map((pillar) => ({ pillar: pillar.label, branch: pillar.zhi, god: pillar.hiddenTenGods[0] ?? "日主" }));
  const bEntries = b.bazi.pillars.map((pillar) => ({ pillar: pillar.label, branch: pillar.zhi, god: pillar.hiddenTenGods[0] ?? "日主" }));
  const aSet = new Set(aEntries.map((item) => item.branch));
  const bSet = new Set(bEntries.map((item) => item.branch));
  const union = new Set([...aSet, ...bSet]);
  const result: RelationshipAnalysis["branchDynamics"] = [];
  const roleMeaning: Record<string, string> = {
    比劫: "自主与同伴立场", 食伤: "表达与体验", 财星: "投入与现实经营", 官杀: "规则与压力", 印星: "理解与安全感",
  };
  const unique = (values: string[]) => [...new Set(values)];
  const crossMatches = (left: string, right: string) => aEntries.flatMap((userEntry) =>
    bEntries
      .filter((partnerEntry) =>
        (userEntry.branch === left && partnerEntry.branch === right)
        || (userEntry.branch === right && partnerEntry.branch === left))
      .map((partnerEntry) => ({ userEntry, partnerEntry })));
  const structureStrength = (userPillars: string[], partnerPillars: string[], base: number) =>
    clamp(base + Math.min(40,
      userPillars.reduce((sum, name) => sum + pillarWeight[name] * .45, 0)
      + partnerPillars.reduce((sum, name) => sum + pillarWeight[name] * .45, 0)));
  const clashes = [["子", "午"], ["丑", "未"], ["寅", "申"], ["卯", "酉"], ["辰", "戌"], ["巳", "亥"]];
  clashes.forEach(([left, right]) => {
    const matches = crossMatches(left, right);
    if (!matches.length) return;
    const userPillars = unique(matches.map(({ userEntry }) => userEntry.pillar));
    const partnerPillars = unique(matches.map(({ partnerEntry }) => partnerEntry.pillar));
    const userBranches = unique(matches.map(({ userEntry }) => userEntry.branch));
    const partnerBranches = unique(matches.map(({ partnerEntry }) => partnerEntry.branch));
    const userGod = unique(matches.map(({ userEntry }) => userEntry.god)).join("、");
    const partnerGod = unique(matches.map(({ partnerEntry }) => partnerEntry.god)).join("、");
    const strength = structureStrength(userPillars, partnerPillars, 38 + Math.min(12, (matches.length - 1) * 6));
    result.push({
      type: "冲", title: `${userName}的${userBranches.join("、")}冲${partnerName}的${partnerBranches.join("、")}`, branches: [left, right],
      userRole: userGod, partnerRole: partnerGod,
      userPillars, partnerPillars, strength, scoreImpact: -Math.max(2, Math.round(strength / 18)),
      summary: `${userName}的${userGod}需求与${partnerName}的${partnerGod}需求会直接碰面：${userName}更在意${godThemesForRelationship(userGod)}，${partnerName}更在意${godThemesForRelationship(partnerGod)}。`,
      scenarioImpact: userPillars.includes("日柱") || partnerPillars.includes("日柱")
        ? "冲落到日支时，亲密距离、相处习惯与情绪反应更容易被直接触发；吸引力和摩擦常同时出现。"
        : userPillars.includes("月柱") || partnerPillars.includes("月柱")
          ? "冲落到月令时，双方长期形成的做事逻辑容易互相挑战，日常磨合比短期热度更重要。"
          : "这组冲更多在社交环境、未来安排或阶段节奏上出现，不必等同于关系一定不稳定。",
      advice: `不要争谁更合理。先让${userName}说清${godThemesForRelationship(userGod)}的底线，再由${partnerName}说明${godThemesForRelationship(partnerGod)}需要怎样被满足。`,
    });
  });
  const harmonies = [
    ["子", "丑", "土"], ["寅", "亥", "木"], ["卯", "戌", "火"],
    ["辰", "酉", "金"], ["巳", "申", "水"], ["午", "未", "土"],
  ];
  harmonies.forEach(([left, right, element]) => {
    const matches = crossMatches(left, right);
    if (!matches.length) return;
    const userPillars = unique(matches.map(({ userEntry }) => userEntry.pillar));
    const partnerPillars = unique(matches.map(({ partnerEntry }) => partnerEntry.pillar));
    const strength = structureStrength(userPillars, partnerPillars, 34 + Math.min(10, (matches.length - 1) * 5));
    const userRole = elementRoleForDayMaster(a.bazi.dayPillar[0], element);
    const partnerRole = elementRoleForDayMaster(b.bazi.dayPillar[0], element);
    result.push({
      type: "六合", title: `${left}${right}六合${element}`, branches: [left, right], userRole, partnerRole,
      userPillars, partnerPillars, strength, scoreImpact: Math.max(2, Math.round(strength / 22)),
      summary: `这个${element}的连接，对${userName}落在${userRole}（${roleMeaning[userRole]}），对${partnerName}落在${partnerRole}（${roleMeaning[partnerRole]}）。`,
      scenarioImpact: userPillars.includes("日柱") && partnerPillars.includes("日柱")
        ? "双方日支直接六合，生活习惯和亲密互动更容易形成黏合，但也可能为了维持和谐而少说真实分歧。"
        : "六合提供一个较自然的合作接口，具体表现取决于它落在双方哪一柱，而不是无条件增加好感。",
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
    const userPillars = unique(aEntries.filter((item) => group.branches.includes(item.branch)).map((item) => item.pillar));
    const partnerPillars = unique(bEntries.filter((item) => group.branches.includes(item.branch)).map((item) => item.pillar));
    const strength = structureStrength(userPillars, partnerPillars, group.type === "三会" ? 48 : 44);
    const userRole = elementRoleForDayMaster(a.bazi.dayPillar[0], group.element);
    const partnerRole = elementRoleForDayMaster(b.bazi.dayPillar[0], group.element);
    result.push({
      type: group.type, title: `${group.branches.join("")}${group.type}${group.element}`, branches: group.branches,
      userRole, partnerRole,
      userPillars, partnerPillars, strength, scoreImpact: Math.max(3, Math.round(strength / 18)),
      summary: `两张命盘合在一起补齐${group.branches.join("、")}。${group.element}对${userName}属于${userRole}（${roleMeaning[userRole]}），对${partnerName}属于${partnerRole}（${roleMeaning[partnerRole]}）。`,
      scenarioImpact: `${group.element}的主题会成为这段关系的高频场景：${userName}从${godThemesForRelationship(userRole)}体验它，${partnerName}则从${godThemesForRelationship(partnerRole)}体验它。结构越靠近日月支，日常体感越明显。`,
      advice: userRole === partnerRole
        ? `${userName}和${partnerName}会被同一种${roleMeaning[userRole]}同时激活，适合共同做一件能持续推进的事，避免只停留在情绪热度。`
        : `${userName}会从${roleMeaning[userRole]}进入关系，${partnerName}会从${roleMeaning[partnerRole]}进入；先承认入口不同，再设计一个两边都能得到的互动。`,
    });
  });

  const elementCn: Record<keyof Elements, string> = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
  const controls: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
  const stemEntries = (profile: UserProfile) => profile.bazi.pillars.map((pillar, index) => ({
    pillar: pillar.label,
    stem: pillar.gan,
    god: pillar.tenGod,
    element: elementCn[stemElements[stems.indexOf(pillar.gan)]],
    importance: pillarWeight[pillar.label] + (index === 2 ? 5 : 0),
  }));
  const stemTensions = stemEntries(a).flatMap((userEntry) => stemEntries(b).map((partnerEntry) => {
    const userControls = controls[userEntry.element] === partnerEntry.element;
    const partnerControls = controls[partnerEntry.element] === userEntry.element;
    return { userEntry, partnerEntry, userControls, partnerControls, importance: userEntry.importance + partnerEntry.importance };
  })).filter((item) => item.userControls || item.partnerControls)
    .sort((left, right) => right.importance - left.importance)
    .filter((item, index, all) => all.findIndex((candidate) =>
      candidate.userEntry.stem === item.userEntry.stem && candidate.partnerEntry.stem === item.partnerEntry.stem) === index)
    .slice(0, 2);
  // 五行相制的意象表达：以材质分工描述，不写成"谁克谁"
  const controlMetaphors: Record<string, { name: string; controllerRole: string; receiverRole: string; scene: string }> = {
    金木: { name: "金木相制", controllerRole: "修枝", receiverRole: "生长", scene: "讨论计划与改进意见时" },
    木土: { name: "木土相制", controllerRole: "扎根", receiverRole: "承载", scene: "分配责任、占用彼此精力时" },
    土水: { name: "土水相制", controllerRole: "筑堤", receiverRole: "奔流", scene: "商定边界与自由度时" },
    水火: { name: "水火相制", controllerRole: "降温", receiverRole: "燃烧", scene: "一方兴头正盛、另一方保持冷静时" },
    火金: { name: "火金相制", controllerRole: "熔炼", receiverRole: "成器", scene: "一方催促改变、另一方坚持原则时" },
  };
  stemTensions.forEach(({ userEntry, partnerEntry, userControls, importance }) => {
    const strength = clamp(32 + importance * .55);
    const controller = userControls ? userName : partnerName;
    const receiver = userControls ? partnerName : userName;
    const controllerEntry = userControls ? userEntry : partnerEntry;
    const receiverEntry = userControls ? partnerEntry : userEntry;
    const metaphor = controlMetaphors[`${controllerEntry.element}${receiverEntry.element}`]
      ?? { name: `${controllerEntry.element}${receiverEntry.element}相制`, controllerRole: "定形", receiverRole: "舒展", scene: "商议做法与标准时" };
    result.push({
      type: "天干克",
      title: `${metaphor.name} · ${controller}主${metaphor.controllerRole}，${receiver}主${metaphor.receiverRole}`,
      branches: [userEntry.stem, partnerEntry.stem],
      userRole: userEntry.god,
      partnerRole: partnerEntry.god,
      userPillars: [userEntry.pillar],
      partnerPillars: [partnerEntry.pillar],
      strength,
      scoreImpact: -Math.max(1, Math.round(strength / 28)),
      summary: `${controller}天干${controllerEntry.stem}属${controllerEntry.element}，${receiver}天干${receiverEntry.stem}属${receiverEntry.element}。${metaphor.scene}，${controller}会自然站到提出修正的一侧，${receiver}则更常是被要求调整的一方——这不是谁压制谁，而是两种材质相遇时的默认分工。`,
      scenarioImpact: "天干属于外显的表达与行为层，这组相制多出现在说话方式、决策权与谁来定义“更好的做法”上；它是一种协商成本，并不等同于地支层面的深层冲突。",
      advice: `提出修正的一方宜同时给出理由与可协商的余地；被修正的一方宜明确说出可接受的边界——将分歧留在具体事务上，勿升级为对人格的评判。`,
    });
  });
  return result.sort((left, right) => right.strength - left.strength);
}

function godThemesForRelationship(god: string) {
  const themes: Record<string, string> = {
    正官: "规则与承诺", 七杀: "决断与控制", 正印: "稳定支持", 偏印: "观察与空间",
    正财: "持续投入", 偏财: "新鲜连接", 比肩: "平等与自主", 劫财: "主导与竞争",
    食神: "舒服表达", 伤官: "直接表达", 日主: "自我核心",
    比劫: "自主与同伴立场", 食伤: "表达与体验", 财星: "投入与现实经营", 官杀: "规则与压力", 印星: "理解与安全感",
  };
  if (themes[god]) return themes[god];
  const splitThemes = god.split("、").map((item) => themes[item]).filter(Boolean);
  return splitThemes.length ? [...new Set(splitThemes)].join("、") : "关系需求";
}

// 确定性变体：同一对人永远选中同一条文案，不同的人落到不同变体，避免"人人一模一样"。
const textSeed = (text: string) => {
  let hash = 0;
  for (let index = 0; index < text.length; index++) hash = (hash * 31 + text.charCodeAt(index)) | 0;
  return Math.abs(hash);
};

export function analyzeRelationship(a: UserProfile, b: UserProfile, relationType = "恋爱"): RelationshipAnalysis {
  const userName = a.birth.name?.trim() || "你";
  const partnerName = b.birth.name?.trim() || "对方";
  const branchDynamics = analyzeCrossBranchDynamics(a, b);
  const scoreBreakdown = compatibilityBreakdown(a, b, relationType, branchDynamics);
  const relationshipScore = clamp(scoreBreakdown.reduce((sum, item) => sum + item.contribution, 0));
  const diff = (key: keyof Personality) => Math.abs(a.personality[key] - b.personality[key]);
  const aGod = Object.fromEntries(a.tenGodAnalysis.map((item) => [item.key, item]));
  const bGod = Object.fromEntries(b.tenGodAnalysis.map((item) => [item.key, item]));
  const paceA = a.socialProfile.relationship_speed;
  const paceB = b.socialProfile.relationship_speed;
  const primaryDynamic = branchDynamics[0];
  const dynamicReason = primaryDynamic
    ? `本次合盘最强触发是${primaryDynamic.title}：对${userName}落为${primaryDynamic.userRole}，对${partnerName}落为${primaryDynamic.partnerRole}。`
    : "两盘没有形成强合冲，互动主要由双方原局十神与行为差异承担。";
  const expressionA = deepScore(a, "social_openness");
  const expressionB = deepScore(b, "social_openness");
  const romanceA = deepScore(a, "romance");
  const romanceB = deepScore(b, "romance");
  const noveltyA = deepScore(a, "novelty");
  const noveltyB = deepScore(b, "novelty");
  const attachmentName = (style: SocialProfile["attachment_style"]) =>
    ({ secure: "安全型", anxious: "焦虑型", avoidant: "回避型" } as const)[style];
  const cards = [
    {
      key: "communication", label: "你们怎么沟通",
      summary: `${userName}以${a.dominantPersona.god}为主轴，表达开放度 ${expressionA}；${partnerName}以${b.dominantPersona.god}为主轴，表达开放度 ${expressionB}。${diff("extroversion") >= 22 ? `${a.personality.extroversion > b.personality.extroversion ? userName : partnerName}更容易把话题往前推，${a.personality.extroversion > b.personality.extroversion ? partnerName : userName}更习惯确认语气与安全感后再接球。` : "两人的表达速度接近，日常话题容易连续，但涉及真实需求时可能同时等对方先开口。"}`,
      why: `${dynamicReason}${diff("extroversion") >= 22 ? "表达差制造吸引，也制造误读：主动者容易觉得对方冷，观察者容易觉得被催。" : "相近的表达轮廓降低了聊天成本，但也可能把关键情绪藏在“都懂”里面。"}`,
      evidence: `外向表达 ${a.personality.extroversion}:${b.personality.extroversion}；社交开放 ${expressionA}:${expressionB}；食伤权重 ${aGod.output.count}:${bGod.output.count}${primaryDynamic ? `；${primaryDynamic.title} 强度 ${primaryDynamic.strength}` : ""}`,
      advice: diff("extroversion") >= 22
        ? `${a.personality.extroversion > b.personality.extroversion ? userName : partnerName}一次只抛一个明确问题并留出回应时间；${a.personality.extroversion > b.personality.extroversion ? partnerName : userName}不要只回“嗯”，至少补一句当下感受或下一次可聊的时间。`
        : `${userName}和${partnerName}每次聊天都多完成一步：从“发生了什么”继续问到“你当时是什么感觉”，避免只交换信息。`,
      logic: [`读取双方日主与主轴十神：${a.bazi.dayPillar[0]}·${a.dominantPersona.god} / ${b.bazi.dayPillar[0]}·${b.dominantPersona.god}`, `比较外向表达 ${a.personality.extroversion}:${b.personality.extroversion} 与食伤权重 ${aGod.output.count}:${bGod.output.count}`, primaryDynamic ? `叠加跨盘结构 ${primaryDynamic.title}，分别落为${primaryDynamic.userRole}/${primaryDynamic.partnerRole}` : "跨盘无强合冲，不额外修正沟通判断", `表达差值 ${diff("extroversion")}；22 以上判为主导—观察结构`],
    },
    {
      key: "pace", label: "关系如何升温",
      summary: `${userName}的浪漫主动 ${romanceA}、新鲜感 ${noveltyA}，${partnerName}分别为 ${romanceB}、${noveltyB}。${paceA === paceB ? `两人都偏${paceA === "fast" ? "快速靠近" : paceA === "slow" ? "慢热确认" : "自然升温"}，升温不是缺速度，而是需要把下一次见面变具体。` : `${userName}偏${paceA === "fast" ? "快速靠近" : paceA === "slow" ? "慢热确认" : "自然升温"}，${partnerName}偏${paceB === "fast" ? "快速靠近" : paceB === "slow" ? "慢热确认" : "自然升温"}，热度与确认感不会同时到达。`}`,
      why: `${dynamicReason}${paceA === paceB ? "节奏同频能减少拉扯，但如果双方都等氛围自然发生，关系也可能舒服地停在原地。" : "速度快的人把连续互动理解为确定，速度慢的人把稳定而不被催促理解为安全。"}`,
      evidence: `关系速度 ${paceA}:${paceB}；浪漫主动 ${romanceA}:${romanceB}；新鲜感 ${noveltyA}:${noveltyB}；情感强度 ${a.personality.emotion}:${b.personality.emotion}`,
      advice: paceA === paceB
        ? `${romanceA >= romanceB ? userName : partnerName}负责提出一个有时间和地点的轻邀约，${romanceA >= romanceB ? partnerName : userName}负责补充偏好；结束前约定下一次，不靠“改天”。`
        : `采用“两次轻互动 + 一次明确邀约”的节奏：先共享日常，再交换一个私人偏好，最后提出具体见面；慢的一方不被催答，快的一方能看到进度。`,
      logic: [`读取关系速度：${paceA}/${paceB}`, `比较浪漫主动 ${romanceA}:${romanceB} 与新鲜感 ${noveltyA}:${noveltyB}`, primaryDynamic ? `校验${primaryDynamic.title}对双方十神入口：${primaryDynamic.userRole}/${primaryDynamic.partnerRole}` : "无强跨盘结构，升温主要按原局关系速度判断", paceA === paceB ? "速度相同，重点判断谁负责把氛围转为具体行动" : "速度不同，设计分阶段确认而非即时对齐"],
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
      summary: a.socialProfile.attachment_style === b.socialProfile.attachment_style ? `${userName}和${partnerName}都偏${attachmentName(a.socialProfile.attachment_style)}，容易理解彼此的安全感语言。` : `${userName}偏${attachmentName(a.socialProfile.attachment_style)}，${partnerName}偏${attachmentName(b.socialProfile.attachment_style)}，两个人确认关系状态的方式不同。`,
      why: a.socialProfile.attachment_style === b.socialProfile.attachment_style ? "两个人对回应、空间和承诺的期待相近。" : `${userName}需要的确认方式与${partnerName}提供安全感的方式不完全相同，必须提前说清楚。`,
      evidence: `依恋倾向 ${attachmentName(a.socialProfile.attachment_style)} : ${attachmentName(b.socialProfile.attachment_style)}；印星权重 ${aGod.resource.count} : ${bGod.resource.count}`,
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
      summary: Math.min(a.personality.stability, b.personality.stability) >= 60 ? `${(a.personality.stability - deepScore(a, "conflict_expression") * .5) >= (b.personality.stability - deepScore(b, "conflict_expression") * .5) ? userName : partnerName}更可能先冷静下来，把对话重新拉回问题本身。` : `${userName}和${partnerName}在压力下都容易先进入防御，立即讲道理效果有限。`,
      why: Math.min(a.personality.stability, b.personality.stability) >= 60 ? "关系里存在一个稳定锚点，修复关键是让较稳定的人先说需求而不是裁判对错。" : "两个人都需要先从情绪状态退出，再讨论事实，否则容易互相放大。",
      evidence: `稳定度 ${a.personality.stability} : ${b.personality.stability}；压力韧性 ${deepScore(a, "resilience")} : ${deepScore(b, "resilience")}`,
      advice: "先暂停情绪升级，再约定恢复对话的具体时间。修复必须包含理解、责任和下一次怎么做。",
      logic: [`读取${userName}与${partnerName}的稳定方式`, `比较两人的压力恢复节奏`, Math.min(a.personality.stability, b.personality.stability) >= 60 ? `${userName}与${partnerName}具备回到问题本身的能力` : `${userName}与${partnerName}都需要先暂停降温`],
    },
  ];
  const initiativeA = a.traitAnalysis[6].score;
  const initiativeB = b.traitAnalysis[6].score;
  const initiatorIsUser = initiativeA + romanceA * .6 >= initiativeB + romanceB * .6;
  const initiatorName = initiatorIsUser ? userName : partnerName;
  const responderName = initiatorIsUser ? partnerName : userName;
  const responderPace = initiatorIsUser ? paceB : paceA;
  const initiatorProfile = initiatorIsUser ? a : b;
  const initiatorGodStats = initiatorIsUser ? aGod : bGod;
  const vary = (slot: string, variants: string[]) => variants[textSeed(`${a.id}|${b.id}|${relationType}|${slot}`) % variants.length];
  const breakdownScore = (key: string) => scoreBreakdown.find((item) => item.key === key)?.score ?? 60;
  const conflictA = deepScore(a, "conflict_expression");
  const conflictB = deepScore(b, "conflict_expression");
  const vigilanceA = deepScore(a, "vigilance");
  const vigilanceB = deepScore(b, "vigilance");
  const dependencyA = deepScore(a, "dependency");
  const dependencyB = deepScore(b, "dependency");
  // 关系判词：按结构特征从特殊到一般依次命中，标题幽默、依据严肃
  const clashDynamic = branchDynamics.find((item) => item.type === "冲");
  const bondDynamic = branchDynamics.find((item) => item.type === "六合" || item.type === "三合" || item.type === "三会");
  const extGap = diff("extroversion");
  const verdict: RelationshipAnalysis["guide"]["verdict"] =
    a.dominantPersona.god === b.dominantPersona.god ? {
      title: "双星同轨",
      quip: `翻译一下：世界上另一个自己。优点是从不需要解释，缺点是连犯错都挑同一个坑——坑里见了面，还得互相笑一声"你也在啊"。`,
      tagline: `两张命盘的主轴同为${a.dominantPersona.god}（权重 ${a.dominantPersona.weight}:${b.dominantPersona.weight}），同频毫不费力，只是没有人负责踩刹车。`,
      basis: `主导十神相同 · 均为${a.dominantPersona.name}`,
    } : clashDynamic && breakdownScore("attraction") >= 62 ? {
      title: "相爱相杀",
      quip: `翻译一下：让你笑得最大声的和气得摔门的，是同一个人。外人劝你们冷静，你们自己知道——这日子过得挺来劲。`,
      tagline: `${clashDynamic.title}，而初见引力偏有 ${breakdownScore("attraction")} 分：吸引与摩擦出自同一组地支，最热闹与最僵持的场面，大概率围绕同一个话题。`,
      basis: `${clashDynamic.title}（强度 ${clashDynamic.strength}）× 初见引力 ${breakdownScore("attraction")}`,
    } : breakdownScore("expression") >= 78 ? {
      title: "高山流水",
      quip: `翻译一下：你话说一半，TA已经把后半句接完了。想吵架都难——误会还没长大，就被听懂掐灭了。`,
      tagline: `表达译码 ${breakdownScore("expression")} 分，一方起调，另一方接得住，误译率远低于常人。伯牙不常有，而钟子期就坐在对面。`,
      basis: `表达译码 ${breakdownScore("expression")} · 食伤权重 ${aGod.output.count}:${bGod.output.count}`,
    } : bondDynamic && bondDynamic.scoreImpact >= 4 ? {
      title: "榫卯相合",
      quip: `翻译一下：不是干柴烈火，是拼图"咔哒"一声对上的那种合适。安静，但严丝合缝——拆开反而费劲。`,
      tagline: `${bondDynamic.title}将两张盘扣在一处，属于结构性的合得来，不依赖情绪热度维持。`,
      basis: `${bondDynamic.title} · 结构修正 +${bondDynamic.scoreImpact}`,
    } : conflictA >= 62 && conflictB >= 62 ? {
      title: "针尖麦芒",
      quip: `翻译一下：嘴上谁都不服，心里谁都放不下。外人看是辩论赛，你们自己心里清楚——这是你们独有的调情方式。`,
      tagline: `两支伤官（冲突表达 ${conflictA}:${conflictB}）谁也不肯让话，争执必然精彩，和好得也快——前提是无人翻旧账。`,
      basis: `冲突表达双高 · 伤官权重 ${a.tenGodCounts["伤官"]}:${b.tenGodCounts["伤官"]}`,
    } : extGap >= 25 ? {
      title: "一动一静",
      quip: `翻译一下：一个负责精彩，一个负责稳当。风筝飞得再高也不慌——线在对方手里，而且对方从不撒手。`,
      tagline: `外向表达 ${a.personality.extroversion}:${b.personality.extroversion}，一人生风，一人定锚。只要不试图把对方改造成自己，便是上好的配置。`,
      basis: `外向差 ${extGap} · 动静结构互补`,
    } : paceA === "slow" && paceB === "slow" ? {
      title: "文火慢炖",
      quip: `翻译一下：前三个月像同事，三年后像失散多年的家人。这锅汤急不得——但凡是炖出来的，都散不了。`,
      tagline: `两个慢热结构相遇，升温以年为单位计。急不来，同样也散不快——耐心在这里按复利计息。`,
      basis: `关系速度均为慢热 · 信任建立 ${deepScore(a, "trust_speed")}:${deepScore(b, "trust_speed")}`,
    } : relationType !== "恋爱" && breakdownScore("daily") >= 72 ? {
      title: "福禄同席",
      quip: `翻译一下：一起吃饭不用找话题、沉默也不尴尬的缘分。饭搭子里的天花板，搭伙过日子的免检产品。`,
      tagline: `日常黏合 ${breakdownScore("daily")} 分，生活节奏天然咬合，属于可以长期同桌吃饭而不生嫌隙的结构。`,
      basis: `日常黏合 ${breakdownScore("daily")} · ${relationType}场景加权`,
    } : relationshipScore >= 80 ? {
      title: "珠联璧合",
      quip: `翻译一下：别人磨合三年才解决的问题，你们出厂就自带答案。唯一要练的本事，是别把好运气过成理所当然。`,
      tagline: `总分 ${relationshipScore}，六维没有明显短板，此类组合的风险只剩把顺利当作寻常。`,
      basis: `总分 ${relationshipScore} · 六维均衡`,
    } : relationshipScore >= 65 ? {
      title: "渐入佳境",
      quip: `翻译一下：第一印象平平无奇，处久了真香。属于几年后翻聊天记录，会对着屏幕笑出声的那种。`,
      tagline: `总分 ${relationshipScore}，吸引与磨合并存，属于"处着处着就顺了"的类型——前提是熬过前三次别扭。`,
      basis: `总分 ${relationshipScore} · 磨合型结构`,
    } : {
      title: "各自成篇",
      quip: `翻译一下：两本好书，语言不同。读懂对方得查字典——但查着查着，你就成了世界上最懂那本书的译者。`,
      tagline: `总分 ${relationshipScore}，两套完整但语法不同的叙事：译得好是互补，译不好是平行——好在译法都写在下面。`,
      basis: `总分 ${relationshipScore} · 差异型结构`,
    };
  // 关系样态判读：结论落在具体互动情景上，命盘数据退居括号作佐证
  const jealousyA = clamp(vigilanceA * .45 + a.personality.emotion * .35 + (a.socialProfile.attachment_style === "anxious" ? 14 : 0));
  const jealousyB = clamp(vigilanceB * .45 + b.personality.emotion * .35 + (b.socialProfile.attachment_style === "anxious" ? 14 : 0));
  const softenA = a.personality.stability - conflictA * .5;
  const softenB = b.personality.stability - conflictB * .5;
  const outputScoreA = aGod.output.score;
  const outputScoreB = bGod.output.score;
  const jealousName = jealousyA > jealousyB ? userName : partnerName;
  const initiativeLead = initiativeA > initiativeB ? userName : partnerName;
  const initiativeFollow = initiativeA > initiativeB ? partnerName : userName;
  const softenLead = softenA > softenB ? userName : partnerName;
  const dependLead = dependencyA > dependencyB ? userName : partnerName;
  const dependFollow = dependencyA > dependencyB ? partnerName : userName;
  const anxiousNote = (a.socialProfile.attachment_style === "anxious" && jealousyA >= jealousyB) || (b.socialProfile.attachment_style === "anxious" && jealousyB > jealousyA)
    ? "，且更倾向焦虑型依恋" : "";
  const behaviors: RelationshipAnalysis["guide"]["behaviors"] = [
    {
      label: "主动权归属",
      conclusion: Math.abs(initiativeA - initiativeB) <= 8
        ? `双方接近，${initiatorName}略占先手`
        : `${initiatorName}更主动`,
      basis: Math.abs(initiativeA - initiativeB) <= 8
        ? `两人的关系主动性很接近（${initiativeA}:${initiativeB}），提议见面这类事基本轮流来；但把浪漫主动（${romanceA}:${romanceB}）一起算进去，第一步由${initiatorName}发起会更自然——这与「先动的人」的结论一致。`
        : `发起邀约、打破冷场、记住纪念日，这些事更多落在${initiatorName}身上：TA习惯把关系当成需要经营的事务（关系主动性 ${initiativeA}:${initiativeB}，浪漫主动 ${romanceA}:${romanceB}，财星权重 ${aGod.wealth.count}:${bGod.wealth.count}）；${responderName}更习惯在被邀请中确认心意——一个划桨、一个掌舵，本来就是配套分工，别读成谁更爱谁。`,
    },
    {
      label: "醋意浓度",
      conclusion: Math.abs(jealousyA - jealousyB) <= 6
        ? "旗鼓相当，互相在意"
        : `${jealousName}的醋意更明显`,
      basis: Math.abs(jealousyA - jealousyB) <= 6
        ? `对"你跟谁走得近"这件事，你们的敏感度不相上下（关系警觉 ${vigilanceA}:${vigilanceB}）——属于互相留意型，醋意都不算重，但都不许对方表现得无所谓。`
        : `对方与别人聊得正欢时，先安静下来的多半是${jealousName}：TA的关系警觉与情感强度偏高（${vigilanceA}:${vigilanceB} / ${a.personality.emotion}:${b.personality.emotion}）${anxiousNote}，信息空白容易被自动补全成剧情。这种醋意说破即化——说出口的是在乎，憋出来的才是事故。`,
    },
    {
      label: "相处氛围",
      conclusion: outputScoreA >= 55 && outputScoreB >= 55
        ? "热络不冷场"
        : outputScoreA < 40 && outputScoreB < 40
          ? "静而不僵，各自安好"
          : "一人递话，一人接住",
      basis: outputScoreA >= 55 && outputScoreB >= 55
        ? `你们的饭桌不会冷：双方食伤皆旺（权重 ${aGod.output.count}:${bGod.output.count}），一个话头能接出十个岔路。对你们而言，突然的安静反而才是值得留意的信号。${clashDynamic ? `唯${clashDynamic.title}在场，热闹里偶尔带电。` : ""}`
        : outputScoreA < 40 && outputScoreB < 40
          ? `你们可以一起安静很久而不觉尴尬——双方食伤皆收（${aGod.output.count}:${bGod.output.count}），各做各的事、偶尔搭一句，就是你们的舒适区。外人看着冷清，你们自己知道那叫安稳。`
          : `一人负责起话头，一人负责接住收尾（食伤 ${aGod.output.count}:${bGod.output.count}）：${outputScoreA >= outputScoreB ? userName : partnerName}像逗哏，${outputScoreA >= outputScoreB ? partnerName : userName}像捧哏。配合得当是相声，但逗哏若长期得不到回应也会泄气——捧哏的记得偶尔主动抛一句。`,
    },
    {
      label: "服软次序",
      conclusion: Math.abs(softenA - softenB) <= 6
        ? "视事由而定，各让一半"
        : `${softenLead}多半先递台阶`,
      basis: Math.abs(softenA - softenB) <= 6
        ? `吵完架谁先发那句"睡了吗"，你们基本轮流——情绪稳定与冲突表达都接近（${a.personality.stability}:${b.personality.stability} / ${conflictA}:${conflictB}），谁理亏谁心软，看具体事由。`
        : `冷战大概率由${softenLead}先打破：TA情绪降温更快（稳定 ${a.personality.stability}:${b.personality.stability}），伤官较轻、不恋战（冲突表达 ${conflictA}:${conflictB}）。先递台阶的不是输家——是TA心里那杆秤回正得更快。`,
    },
    {
      label: "依附程度",
      conclusion: Math.abs(dependencyA - dependencyB) <= 7
        ? "黏度对等，进退同步"
        : `${dependLead}更为依附`,
      basis: Math.abs(dependencyA - dependencyB) <= 7
        ? `想见就见、各忙各的也不慌——你们的黏度基本对等（情感依赖 ${dependencyA}:${dependencyB}），这种进退同步，在两人关系里是稀缺品。`
        : `忙季或异地时，先觉得不对劲的多半是${dependLead}：TA的情感依赖更高（${dependencyA}:${dependencyB}，印星权重 ${aGod.resource.count}:${bGod.resource.count}），需要被持续接住。${dependFollow}的独立不是冷淡，是出厂设置——但独立的人不开口，不等于不需要。`,
    },
  ];
  // 双方性情释读：以命盘结构为据，给出行为倾向与相处要领
  const dispositionFor = (profile: UserProfile, name: string, partner: string) => {
    const style = profile.socialProfile.attachment_style;
    const conflictScore = deepScore(profile, "conflict_expression");
    const autonomyScore = deepScore(profile, "autonomy");
    const expressScore = traitScore(profile, "expressiveness");
    const stats = profile === a ? aGod : bGod;
    const items: RelationshipAnalysis["guide"]["dispositions"] = [];
    if (style === "avoidant" || autonomyScore >= 65) items.push({
      person: name, trait: "比劫立身，界限分明",
      reading: `${name}比劫与偏印结构偏重（自主空间需求 ${autonomyScore}），亲密并不改变其独处回血的底层设定。沉默多半是在消化，不是疏远；退开是充电，不是离场。`,
      approach: vary(`disp-avoidant-${name}`, [
        `相处时建议给出明确的等待期，而不是连续追问。对这类人，克制比热情更能积累信任。`,
        `${partner}可以把TA的独处当成固定日程而不是突发事故：有预告的退开不用过度解读，按约定时间等它结束就好。`,
        `施压是这类结构的天敌。给出选择权，比连环关心更能让${name}主动靠近。`,
      ]),
    });
    if (style === "anxious") items.push({
      person: name, trait: "印水相涵，心思绵密",
      reading: `${name}印星与情感结构偏旺（情感强度 ${profile.personality.emotion}，印星权重 ${stats.resource.count}），对回应的连续性高度敏感，信息空白会被自动补全为负面剧本。`,
      approach: vary(`disp-anxious-${name}`, [
        `固定的联系节奏胜过长篇解释；提前预告忙碌、说到就准点出现，是对这类结构最实际的安抚。`,
        `回应贵在准时，不在长度。${partner}最好养成先报时间点、再谈内容的习惯，能省下大量无谓消耗。`,
        `这类不安多半来自"不知道"，而不是"不满意"。让${name}始终知道下一次联系在什么时候，大半问题会自己消失。`,
      ]),
    });
    if (style === "secure") items.push({
      person: name, trait: "土厚金清，安而不争",
      reading: `${name}结构安稳（情绪稳定 ${profile.personality.stability}，印星权重 ${stats.resource.count}），少有主动索取，习惯自我消化。但安全型不是没有需求，只是不为需求吵闹。`,
      approach: vary(`disp-secure-${name}`, [
        `建议定期主动问问TA没说出口的部分，别把稳定当成免维护——免维护的下一站，是无声的撤退。`,
        `${partner}要主动把关注送到位，而不是等${name}开口。懂事的人，最不该被亏欠。`,
        `这类委屈是按静默计息的。周期性的主动关照，是最便宜也最有效的偿还。`,
      ]),
    });
    if (conflictScore >= 65) items.push({
      person: name, trait: "伤官吐秀，锋从口出",
      reading: `${name}伤官偏旺（冲突表达 ${conflictScore}，伤官权重 ${profile.tenGodCounts["伤官"]}），言辞锐度与在乎程度成正比——对无关之人，${name}向来只有客气。`,
      approach: vary(`disp-sharp-${name}`, [
        `冲突中建议先接住事实层，再谈表达方式。锋利被当场纠正的次数越多，以后的真话就越少。`,
        `${partner}可以把话锋的锐度理解成分量而不是敌意：说得越重，说明这件事在${name}心里越重。`,
        `和这类人相处，接内容、放语气是基本功；语气留到事后复盘，当下只回应观点本身。`,
      ]),
    });
    else if (conflictScore <= 40) items.push({
      person: name, trait: "食神温润，讷于言争",
      reading: `${name}冲突表达收敛（${conflictScore}，食神权重 ${profile.tenGodCounts["食神"]}），不满往往延迟出现；当下的"没事"多半是还没想好怎么说，不是真的没事。`,
      approach: vary(`disp-mild-${name}`, [
        `重要议题建议留出二次确认的余地：隔天再提一次，往往才能得到真实的答案。`,
        `${partner}多看行动、少只听话面：情绪的真相，写在之后两天的行为温度里。`,
        `给出延迟表达的许可，压力撤掉之后，这类人的真话才会浮出水面。`,
      ]),
    });
    if (expressScore <= 45 && items.length < 2) items.push({
      person: name, trait: "财官务实，情在事中",
      reading: `${name}语言表达偏敛（表达意愿 ${expressScore}，财星权重 ${stats.wealth.count}），情感输出以行动为主——接送、记挂、替你把事办了，都是TA的表达。`,
      approach: vary(`disp-doer-${name}`, [
        `把TA的行动计入情感账目，同时明确提出对语言表达的最低需求；需求不说出口，等于没有。`,
        `${partner}可以练习翻译：把每一次绕路和代办，如实读成一句没说出口的在乎。`,
        `对行动派来说，模糊的期待最难兑现。给出具体的表达规格，TA就会按规格交付。`,
      ]),
    });
    return items.slice(0, 2);
  };
  const gapCandidates = [
    {
      value: Math.abs(({ slow: 0, medium: 1, fast: 2 })[paceA] - ({ slow: 0, medium: 1, fast: 2 })[paceB]) * 30,
      scene: "推进速度错位",
      risk: `${userName}偏${({ slow: "慢热确认", medium: "自然推进", fast: "快速靠近" } as const)[paceA]}，${partnerName}偏${({ slow: "慢热确认", medium: "自然推进", fast: "快速靠近" } as const)[paceB]}。快的一方将连续互动理解为确定，慢的一方将不被催促理解为安全——双方都自觉进展顺利，直至快的一方要求定义关系。`,
      playbook: vary("play-pace", [
        `把发起权和确认权分开：快的一方负责发起，慢的一方负责在每次相处结束时定下一次的时间。分工明确之后，试探和逼问都没有必要了。`,
        `推进用小步高频代替大步慢频——低成本、高频次的相处，比重大表态更适合你们的结构。`,
        `确认关系状态时，谈节奏舒不舒服，别追问名分定义；前者是协商，后者更像施压。`,
      ]),
    },
    {
      value: diff("control"),
      scene: "规则与自由的拉锯",
      risk: `边界控制 ${a.personality.control}:${b.personality.control}。一方需要明确的规则与回应以获得安全感，另一方被规定得越死越想脱身——求规则者在寻安全，避规则者在保自由，两边皆非恶意。`,
      playbook: vary("play-control", [
        `底线规则要少而明确：压缩到三条以内，其余一概放行。规则越少，越有约束力。`,
        `规则最好共同拟定：各自列出最在意的三件事，交换后各让一条，剩下的就是共同章程——一起定的规则，不会被当成单方面的控制。`,
        `立规则的一方说明安全感从哪来，抗拒规则的一方给出替代方案。谈需求而不是谈条款，谈判就不会变成对抗。`,
      ]),
    },
    {
      value: Math.abs(deepScore(a, "autonomy") - deepScore(b, "autonomy")),
      scene: "空间需求不同频",
      risk: `空间需求 ${deepScore(a, "autonomy")}:${deepScore(b, "autonomy")}。需求高者退开充电时，需求低者读到的是被推开；一方追近解释，另一方退得更远——典型的依恋追逃循环。`,
      playbook: vary("play-autonomy", [
        `把独处制度化：预留固定的各自时间，写进两个人的默认日程。提前预留的空间，不会被误读成逃离。`,
        `退开要有预告，回来要有时间点；有始有终的独处，不会触发追逃循环。`,
        `空间需求较低的一方，可以练习"随叫随到但不打扰"的在场方式——这是陪伴的高级形态。`,
      ]),
    },
    {
      value: Math.abs(noveltyA - noveltyB),
      scene: "新鲜感与稳定感的配比",
      risk: `新鲜感需求 ${noveltyA}:${noveltyB}。一方视"老地方老节目"为安心，另一方视之为停滞；提议新花样的人接连受挫之后，探索欲便会向关系之外寻找出口。`,
      playbook: vary("play-novelty", [
        `日常和新意按八二配比：多数时间维持惯例来喂养稳定，每月由求新的一方主导一次新体验，另一方只有参与的义务，没有否决的权力。`,
        `可以共同维护一份"想试清单"，每月挑一条执行；想变的有出口，求稳的有预期，谁都不用改本性。`,
        `把新意嵌进旧框架：在熟悉的场景里加小幅变化，是两种结构都能承受的更新方式。`,
      ]),
    },
    {
      value: diff("emotion"),
      scene: "情绪音量不一致",
      risk: `情感强度 ${a.personality.emotion}:${b.personality.emotion}。音量高的一方需要情绪先被接住，音量低的一方习惯直接分析问题——于是同一场争执里，一方在要安慰，另一方在讲道理，各说各话。`,
      playbook: vary("play-emotion", [
        `处理分歧按"先承接、后解决"的顺序来：情绪没被确认之前，任何道理都会被当成攻击。`,
        `情绪音量低的一方先表明"我在听"，再进入分析；顺序反了，事倍功半。`,
        `可以设一个暂停机制：任何一方都能叫停，但叫停的人负责定重启时间——中断是为了回到桌面，不是离席。`,
      ]),
    },
  ].sort((left, right) => right.value - left.value);
  const guide: RelationshipAnalysis["guide"] = {
    verdict,
    philosophy: relationshipScore >= 80
      ? vary("philosophy-high", [
        `${relationshipScore} 分意味着你们的默认相处方式摩擦很小——但低成本关系最大的风险，是把默契当成免维护。这份指南告诉你们哪里不能偷懒。`,
        `${relationshipScore} 分说明你们大部分相处是顺的。顺的关系最容易输给理所当然：下面这些位置，是你们仅剩的、也最值得花力气的地方。`,
        `${relationshipScore} 分：你们的底层节奏咬合得不错。接下来要防的不是冲突，而是惰性——下面每一条都在标注"别在这里睡着"。`,
      ])
      : relationshipScore >= 65
        ? vary("philosophy-mid", [
          `${relationshipScore} 分属于"有差异的吸引"：扣掉的分数全部扣在磨合成本上，而不是可能性上。下面每一条都对应一个具体成本和它的绕行方案。`,
          `${relationshipScore} 分的含义：你们互相吸引的地方和互相消耗的地方一样具体。好消息是消耗点全部可命名、可绕行——它们就列在下面。`,
          `${relationshipScore} 分不高不低，说明这段关系值得做、但需要方法。分数扣在哪里，下面的场景就写到哪里，一条对一条。`,
        ])
        : vary("philosophy-low", [
          `先把话说清楚：${relationshipScore} 分不是"不合适"的判决。这个分数衡量的是两套默认相处方式之间的摩擦成本——如果你们已经互有好感，真实的相处永远比模型重要，这份报告是使用说明书，不是预言。成本高只意味着更需要照着说明书操作，所以下面的内容也写得更具体。`,
          `${relationshipScore} 分需要正确地读：它衡量的是两套默认习惯之间的摩擦成本，不是感情的上限。互有好感的两个人拿到这个分数，正确反应是把说明书读厚一点，而不是把关系判轻一点。`,
          `别被 ${relationshipScore} 分吓到——模型只能看到你们的出厂设置，看不到你们愿意为对方调整多少。成本确实偏高，所以下面每一条都写得更细：路窄，就把地图画大。`,
        ]),
    initiator: {
      name: initiatorName,
      why: `${initiatorName}关系主动性 ${initiatorIsUser ? initiativeA : initiativeB}、浪漫主动 ${initiatorIsUser ? romanceA : romanceB}，综合高于${responderName}；且其主轴为${initiatorProfile.dominantPersona.god}，财星权重 ${initiatorGodStats.wealth.count}——这类结构由自己发起最自然，被动等待反而容易积累怨气。主动权明确归属，比轮流试探更省损耗。`,
      firstMove: responderPace === "slow"
        ? vary("firstmove-slow", [
          `建议由${initiatorName}发起一次时长可控、退出成本低的见面，发出之后不追问。${responderName}是慢热结构，第一步的全部目标是让下一次自然发生，而不是推进关系定义。`,
          `第一次发起宜小不宜大：时间短、场景熟、结束时间明确。对${responderName}来说，可预期本身就是诚意。`,
          `${initiatorName}发一个具体而轻的邀约，然后安静等。${responderName}的信任按次数累积，催促只会让计时清零。`,
        ])
        : vary("firstmove-fast", [
          `建议由${initiatorName}直接给出明确的时间和地点。对${responderName}来说，模糊的相约不如具体的安排——确定性本身就是好感的证据。`,
          `${initiatorName}可以一次给两个具体选项让${responderName}挑一个；给选项，就是给尊重。`,
          `${initiatorName}负责把"下次见"落到日历上：日期、地点、做什么，一次说全。对${responderName}这类结构来说，执行力比修辞更浪漫。`,
        ]),
    },
    behaviors,
    dispositions: [...dispositionFor(b, partnerName, userName), ...dispositionFor(a, userName, partnerName)],
    hotspots: gapCandidates.slice(0, 3).map((item) => ({ scene: item.scene, risk: item.risk, playbook: item.playbook })),
    longRun: Math.min(noveltyA, noveltyB) >= 55
      ? vary("longrun-high", [
        `长线要则：双方新鲜感需求俱高（${noveltyA}:${noveltyB}），此关系的保鲜之道不在互相盯紧，而在共同更新——共同的计划、新的场景、阶段性的目标。停滞才是你们唯一真正的敌人。`,
        `长线要则：你们的热度由"共同的下一件事"维持。手中宜常留一个进行中的计划——旅行、课程、任何目标皆可——计划断档之时，往往即是关系降温之始。`,
        `长线要则：对新鲜感需求 ${noveltyA}:${noveltyB} 的两张盘而言，最好的纪念日礼物是新计划而非旧回忆。每季度保有一个"第一次"，这段关系便不会陈旧。`,
      ])
      : vary("longrun-low", [
        `长线要则：你们中至少一方（新鲜感需求 ${Math.min(noveltyA, noveltyB)}）以熟悉感积累安全。仪式感——固定的日子、重复的小习惯——对这段关系不是老套，而是地基；先把地基打稳，再谈偶尔的惊喜。`,
        `长线要则：这段关系的安全感建立在重复之上。守住几个雷打不动的小仪式，这些看似寻常的重复，即是关系的承重之墙。`,
        `长线要则：求稳的一方定节奏，求变的一方添花样，配比约为八比二。先令日子可预期，再令日子有惊喜——次序不可颠倒。`,
      ]),
  };
  return {
    score: relationshipScore,
    relationType,
    headline: relationshipScore >= 80 ? "高互补，也需要认真接住彼此" : relationshipScore >= 65 ? "有吸引力的差异，值得慢慢验证" : "节奏并不天然一致，但仍有可经营空间",
    scoreSummary: `${relationType}场景采用加权评分：${scoreBreakdown.map((item) => `${item.label}${item.weight}%`).join("、")}。分数只衡量互动成本与互补空间，不判断关系成败。`,
    scoreBreakdown,
    cards,
    branchDynamics,
    guide,
  };
}

// 标准化事实清单：把规则引擎的全部结论压缩为机器可读 JSON，供 AI 叙述层使用。
// 契约：AI 只允许转述清单中的事实与数字，不得新增判断——事实相同、结构相同，措辞可变。
export function buildRelationshipFacts(a: UserProfile, b: UserProfile, analysis: RelationshipAnalysis) {
  const attachmentTendency = { secure: "偏安全型", anxious: "偏焦虑型", avoidant: "偏回避型" } as const;
  const person = (profile: UserProfile) => ({
    name: profile.birth.name ?? "未命名",
    dayPillar: profile.bazi.dayPillar,
    archetype: profile.archetype,
    persona: profile.combinedPersona.name,
    dominantGod: profile.dominantPersona.god,
    attachmentTendency: attachmentTendency[profile.socialProfile.attachment_style],
    personality: profile.personality,
    keyScores: {
      initiative: profile.traitAnalysis[6].score,
      expressiveness: traitScore(profile, "expressiveness"),
      conflictExpression: deepScore(profile, "conflict_expression"),
      vigilance: deepScore(profile, "vigilance"),
      dependency: deepScore(profile, "dependency"),
      autonomy: deepScore(profile, "autonomy"),
      novelty: deepScore(profile, "novelty"),
      romance: deepScore(profile, "romance"),
    },
    identityTags: profile.identityTags,
  });
  return {
    relationType: analysis.relationType,
    score: analysis.score,
    verdict: analysis.guide.verdict,
    persons: [person(a), person(b)],
    dimensions: analysis.scoreBreakdown.map(({ key, label, score, weight, summary }) => ({ key, label, score, weight, summary })),
    structures: analysis.branchDynamics.map(({ type, title, scoreImpact, summary }) => ({ type, title, scoreImpact, summary })),
    behaviors: analysis.guide.behaviors,
    dispositions: analysis.guide.dispositions,
    frictions: analysis.guide.hotspots,
    longRun: analysis.guide.longRun,
  };
}

// 当前日期所处的流月干支（按节气交接），供流月相关推荐使用。
export function monthGanZhi(year: number, month: number, day: number): string {
  return Solar.fromYmdHms(year, month, day, 12, 0, 0).getLunar().getMonthInGanZhi();
}
