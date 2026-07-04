import type { EnergyResult } from "./energy";

export type Spine = {
  thesis: string;
  strength: { level: string; score: number; confidence: string };
  favorable: string[];
  unfavorable: string[];
  coreTension: string;
  monthAxis: string;
};

export type BirthInput = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  name?: string;
  gender?: "male" | "female";
  calendarType?: "solar" | "lunar";
  isLeapMonth?: boolean;
};

export type Elements = {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
};

export type Bazi = {
  yearPillar: string;
  monthPillar: string;
  dayPillar: string;
  hourPillar: string;
  elements: Elements;
  elementStrength: Elements;
  solarDate: string;
  lunarDate: string;
  previousSolarTerm: { name: string; at: string };
  nextSolarTerm: { name: string; at: string };
  pillars: {
    label: string;
    gan: string;
    zhi: string;
    hiddenStems: string[];
    hiddenTenGods: string[];
    tenGod: string;
    naYin: string;
    wuXing: string;
    stage: string;
  }[];
};

export type Zodiac =
  | "Aries" | "Taurus" | "Gemini" | "Cancer" | "Leo" | "Virgo"
  | "Libra" | "Scorpio" | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";

export type Personality = {
  extroversion: number;
  stability: number;
  control: number;
  emotion: number;
};

export type SocialProfile = {
  communication_need: "low" | "medium" | "high";
  conflict_tolerance: "low" | "high";
  relationship_speed: "slow" | "medium" | "fast";
  attachment_style: "secure" | "anxious" | "avoidant";
};

export type UserProfile = {
  id: string;
  birth: BirthInput;
  bazi: Bazi;
  energy: EnergyResult;
  spine: Spine;
  zodiac: Zodiac;
  personality: Personality;
  socialProfile: SocialProfile;
  summary: string;
  archetype: string;
  dominantBasis: string;
  identityTags: string[];
  traitAnalysis: {
    key: string;
    label: string;
    score: number;
    basis: string;
  }[];
  tenGodAnalysis: {
    key: string;
    label: string;
    members: string;
    score: number;
    count: number;
    interpretation: string;
  }[];
  tenGodCounts: Record<string, number>;
  tenGodSources: {
    pillar: string;
    layer: "本气" | "天干" | "中气" | "余气";
    god: string;
    weight: number;
  }[];
  dominantPersona: {
    god: string;
    name: string;
    drive: string;
    behavior: string;
    relationship: string;
    weight: number;
  };
  secondaryPersona: {
    god: string;
    name: string;
    drive: string;
    behavior: string;
    relationship: string;
    weight: number;
  };
  tertiaryPersona: {
    god: string;
    name: string;
    drive: string;
    behavior: string;
    relationship: string;
    weight: number;
  } | null;
  combinedPersona: {
    name: string;
    summary: string;
  };
  luckCycles: {
    direction: "顺排" | "逆排";
    startAgeText: string;
    startDate: string;
    currentYear: number;
    currentGanZhi: string;
    periods: {
      index: number;
      ganZhi: string;
      startYear: number;
      endYear: number;
      startAge: number;
      endAge: number;
      isCurrent: boolean;
      verdict?: { tone: "boost" | "drain" | "mixed" | "neutral"; label: string; text: string };
    }[];
  };
  specialPoints: {
    type: "冲" | "六合" | "三合" | "三会" | "半合" | "半会";
    title: string;
    branches: string[];
    tenGods: string[];
    strength: number;
    summary: string;
    relationshipImpact: string;
  }[];
  deepAnalysis: {
    key: string;
    label: string;
    category: "亲密与安全" | "沟通与连接" | "边界与冲突" | "成长与行动";
    score: number;
    level: string;
    descriptor: string;
    keywords: string[];
    summary: string;
    evidence: string[];
    note: string;
    sceneInsights: {
      scene: "感情中" | "人际中" | "压力下";
      title: string;
      text: string;
    }[];
    logic: {
      premise: string;
      counterSignal: string;
      realWorldCheck: string;
      strength: string;
      blindSpot: string;
      scenes: string[];
    };
  }[];
  specialtyAnalysis: {
    key: "intuition" | "love_structure" | "attraction" | "creative_sensitivity";
    label: string;
    score: number;
    level: string;
    descriptor: string;
    summary: string;
    evidence: string[];
    caution: string;
  }[];
};

export type MatchResult = {
  score: number;
  reasons: string[];
  analysis: string;
  breakdown?: {
    key: string;
    label: string;
    score: number;
    weight: number;
    contribution: number;
    summary: string;
    basis: string[];
  }[];
};

// 双人对比指标：正文只写定性结论，数字一律走此结构由图表呈现（b 缺省时为单值指标）
export type PairMetric = { label: string; a: number; b?: number };

export type RelationshipAnalysis = {
  score: number;
  relationType: string;
  headline: string;
  scoreSummary: string;
  spine: {
    thesis: string;
    primaryResource: { key: string; label: string; why: string };
    primaryTension: { key: string; label: string; why: string };
    elementSynergy: { tone: "mutual" | "oneway" | "costly" | "neutral"; sides: string[] };
  };
  scoreBreakdown: {
    key: string;
    label: string;
    score: number;
    weight: number;
    contribution: number;
    summary: string;
    basis: string[];
  }[];
  cards: {
    key: string;
    label: string;
    summary: string;
    why: string;
    metrics: PairMetric[];
    advice: string;
    logic: string[];
  }[];
  branchDynamics: {
    type: "冲" | "六合" | "三合" | "三会" | "天干克";
    title: string;
    branches: string[];
    userRole: string;
    partnerRole: string;
    userPillars: string[];
    partnerPillars: string[];
    strength: number;
    scoreImpact: number;
    summary: string;
    scenarioImpact: string;
    advice: string;
  }[];
  guide: {
    verdict: { title: string; quip: string; tagline: string; basis: string; metrics: PairMetric[] };
    philosophy: string;
    initiator: { name: string; why: string; firstMove: string; metrics: PairMetric[] };
    behaviors: { label: string; conclusion: string; basis: string; metrics: PairMetric[] }[];
    dispositions: { person: string; trait: string; reading: string; approach: string }[];
    // 人物使用说明书：每人 Do×3 + Don't×3，按结构信号强度选取（贰章主场）
    manuals: { person: string; dos: string[]; donts: string[] }[];
    // 摩擦点结构溯源：source 标明来自哪组命盘结构（详见叁章）或行为结构差异，不硬编（伍章主场）
    hotspots: { scene: string; risk: string; playbook: string; metrics: PairMetric[]; source: string }[];
    longRun: string;
  };
};
