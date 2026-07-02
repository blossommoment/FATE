import Link from "next/link";
import type { CSSProperties } from "react";
import { analyzeBirth, analyzeRelationship, matchProfiles, validateBirth } from "@/lib/fate";
import type { BirthInput } from "@/lib/types";
import ChatAssistant from "@/components/ChatAssistant";
import { askDeepSeek } from "@/lib/deepseek";

const zodiacLabels: Record<string, string> = {
  Aries: "白羊座", Taurus: "金牛座", Gemini: "双子座", Cancer: "巨蟹座",
  Leo: "狮子座", Virgo: "处女座", Libra: "天秤座", Scorpio: "天蝎座",
  Sagittarius: "射手座", Capricorn: "摩羯座", Aquarius: "水瓶座", Pisces: "双鱼座",
};
const labels = { extroversion: "外向表达", stability: "情绪稳定", control: "边界控制", emotion: "情感感知" };
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
  birth, embedded = false, view = "overview", partnerBirth, relationType = "恋爱", detail, assistantQuestion, flowYear = new Date().getFullYear(),
}: {
  birth: BirthInput;
  embedded?: boolean;
  view?: "overview" | "deep" | "match" | "square";
  partnerBirth?: BirthInput;
  relationType?: string;
  detail?: string;
  assistantQuestion?: string;
  flowYear?: number;
}) {
  const error = validateBirth(birth);
  if (error) return (
    <main className="result-page"><nav><Link className="brand" href="/">FATE<span>°</span></Link></nav>
      <section className="invalid"><div className="section-number">输入有误</div><h1>这个时间点<br />似乎不存在。</h1><p>{error}</p><Link className="back-link" href="/">← 返回重新填写</Link></section>
    </main>
  );

  const profile = analyzeBirth(birth);
  const recommendations = candidates
    .map((candidate) => {
      const candidateProfile = analyzeBirth(candidate.birth);
      return { ...candidate, candidateProfile, result: matchProfiles(profile, candidateProfile) };
    })
    .sort((a, b) => b.result.score - a.result.score);
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
    title: selectedInteraction.label, summary: selectedInteraction.summary, evidence: [selectedInteraction.summary, selectedInteraction.advice],
    suggestions: ["为什么会这样互动？", "冲突时具体怎么做？", "双方谁更需要安全感？"],
  } : {
    title: view === "square" ? "同频广场" : view === "match" ? "双人匹配" : view === "deep" ? "十神深度分析" : "八字概览",
    summary: profile.summary,
    evidence: [`日主 ${profile.bazi.dayPillar[0]}`, `主导身份 ${profile.archetype}`, `十神主导 ${profile.tenGodAnalysis.slice().sort((a, b) => b.count - a.count)[0].members}`],
    suggestions: ["七杀是什么？", "为什么我的进取心高？", "为什么我容易没有新鲜感？"],
  };
  const assistantAnswer = assistantQuestion ? await askDeepSeek(assistantQuestion, assistantContext.title, assistantContext.summary, assistantContext.evidence) : undefined;
  const assistantHref = `/?${baseQuery}&view=${view}${partnerQuery}${detail ? `&detail=${detail}` : ""}`;
  const returnAnchor = selectedDeep ? `deep-card-${selectedDeep.key}` : selectedInteraction ? `match-card-${selectedInteraction.key}` : `view-${view}`;
  const assistantFields: Record<string, string> = {
    year: String(birth.year), month: String(birth.month), day: String(birth.day), hour: String(birth.hour),
    minute: String(birth.minute ?? 0), name: birth.name ?? "我",
    gender: birth.gender ?? "female", calendarType: birth.calendarType ?? "solar",
    isLeapMonth: birth.isLeapMonth ? "true" : "false", view, ...(detail ? { detail } : {}),
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
  const duoDimensions = partnerProfile ? [
    ["表达", profile.traitAnalysis[0].score, partnerProfile.traitAnalysis[0].score],
    ["稳定", profile.traitAnalysis[1].score, partnerProfile.traitAnalysis[1].score],
    ["边界", profile.traitAnalysis[2].score, partnerProfile.traitAnalysis[2].score],
    ["情感", profile.traitAnalysis[3].score, partnerProfile.traitAnalysis[3].score],
    ["主动", profile.traitAnalysis[6].score, partnerProfile.traitAnalysis[6].score],
    ["适应", profile.traitAnalysis[7].score, partnerProfile.traitAnalysis[7].score],
  ] as [string, number, number][] : [];
  const duoGrid = (radius: number) => duoDimensions.map((_, index) => polygonPoint(index, 6, radius)).join(" ");
  const duoMine = duoDimensions.map((item, index) => polygonPoint(index, 6, 112 * item[1] / 100)).join(" ");
  const duoTheirs = duoDimensions.map((item, index) => polygonPoint(index, 6, 112 * item[2] / 100)).join(" ");
  const elementColors = { wood: "#58a878", fire: "#e66e5e", earth: "#d6a64f", metal: "#86a3ad", water: "#5b83bd" };
  const elementRadar = (Object.entries(profile.bazi.elementStrength) as [keyof typeof elementLabels, number][]).map(([key, value]) => ({
    key, label: elementLabels[key], value, color: elementColors[key],
  }));
  const elementGrid = (radius: number) => elementRadar.map((_, index) => polygonPoint(index, 5, radius)).join(" ");
  const elementRadius = (value: number) => 24 + 88 * Math.min(value / 45, 1);
  const elementValues = elementRadar.map((item, index) => polygonPoint(index, 5, elementRadius(item.value))).join(" ");
  const elementRadarPanel = <section className="element-card element-radar-card overview-element-radar">
    <div className="element-radar-copy"><small>五行能量图谱</small><h3>月令优先的结构权重</h3><p>月支藏干占核心权重，其次读取时支、日支、年支与三处透干。图形展示加权占比，不再把八个字等量计数。</p><div className="element-weight-note"><span>月支 35</span><span>时支 20</span><span>日支 15</span><span>年支 15</span><span>透干 15</span></div></div>
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
  return (
    <main id={`view-${view}`} className={`result-page view-${view} day-theme-${dayTheme}`}>
      {!embedded && <nav>
        <Link className="brand" href="/"><i>缘</i>FATE<span>°</span></Link>
        <div className="nav-links"><span>关系档案 · 已生成</span><Link href="/">重新分析</Link></div>
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
            <p>{birth.name ?? "我"} · {birth.calendarType === "lunar" ? "农历" : "公历"} {birth.year} 年 {birth.month} 月 {birth.day} 日 · {String(birth.hour).padStart(2, "0")}:{String(birth.minute ?? 0).padStart(2, "0")} · {birth.gender === "male" ? "男" : "女"} · {zodiacLabels[profile.zodiac]}</p>
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
          <article><i>日</i><div><span>日主气质</span><h3>{profile.bazi.dayPillar[0]}日主 · {profile.archetype}</h3><p>{profile.deepAnalysis[2].summary}</p></div></article>
          <article><i>令</i><div><span>月令主轴</span><h3>{profile.bazi.pillars[1].zhi}月 · {profile.bazi.pillars[1].hiddenTenGods[0]}</h3><p>月令本气权重最高，是这张命盘最稳定、最容易反复出现的行为底色。</p></div></article>
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
                <div className="luck-age">{period.startAge}—{period.endAge} 岁</div>
              </article>;
            })}
          </div>
          <section className="annual-flow" id="annual-flow">
            <header><div><span>流年索引</span><h3>选择年份，查看当年五行样式</h3></div><small>仅标注干支与元素，不作吉凶推断</small></header>
            <div className="annual-year-strip">
              {annualYears.map((year) => {
                const ganZhi = annualGanZhi(year);
                return <Link className={`${year === safeFlowYear ? "active " : ""}annual-${annualTone(ganZhi[0])}`} href={`/?${baseQuery}&view=overview&flowYear=${year}#annual-flow`} key={year}><small>{year}</small><strong>{ganZhi}</strong></Link>;
              })}
            </div>
            <article className={`annual-detail annual-${annualTone(selectedAnnual[0])}`}>
              <div className="annual-seal"><small>{safeFlowYear}</small><strong>{selectedAnnual[0]}<b>{selectedAnnual[1]}</b></strong></div>
              <div><span>当年元素标记</span><h3>{selectedAnnual}流年</h3><p>天干为{annualElementNames[annualTone(selectedAnnual[0]) as keyof typeof annualElementNames]}，地支为{annualElementNames[annualTone(selectedAnnual[1]) as keyof typeof annualElementNames]}。此处仅作为时间视觉索引，后续可再加入流年与原局的合冲关系。</p></div>
              <div className="annual-element-pills"><span className={`tone-${annualTone(selectedAnnual[0])}`}>天干 · {annualElementNames[annualTone(selectedAnnual[0]) as keyof typeof annualElementNames]}</span><span className={`tone-${annualTone(selectedAnnual[1])}`}>地支 · {annualElementNames[annualTone(selectedAnnual[1]) as keyof typeof annualElementNames]}</span></div>
            </article>
          </section>
          <footer>年龄按传统排盘虚岁显示；起运时刻精确到分钟。</footer>
        </section>
        <section className="special-points">
          <header><div><span>命盘特殊点</span><h2>合、会、冲落到十神之后</h2></div><small>只提示结构张力，不单独判断吉凶</small></header>
          {profile.specialPoints.length > 0 ? <div className="special-point-list">
            {profile.specialPoints.map((point, index) => <article className={`special-${point.type}`} key={`${point.title}-${index}`}>
              <div className="special-symbol"><span>{point.type}</span><strong>{point.branches.join(" · ")}</strong></div>
              <div className="special-content"><div><small>结构强度</small><i><b style={{ width: `${point.strength}%` }} /></i></div><h3>{point.title}</h3><p>{point.summary}</p><aside>{point.relationshipImpact}</aside></div>
              <div className="special-gods">{point.tenGods.map((god) => <span key={god}>{god}</span>)}</div>
            </article>)}
          </div> : <div className="special-empty">这张命盘没有形成明显的三合、三会或六冲结构，关系倾向更多由单柱十神承担。</div>}
        </section>
      </header>

      <section className="report result-report">
        <div className="report-head">
          <div><div className="section-number">01 — 十神关系画像</div><h2>从十神出发，理解你<br />如何进入一段关系。</h2></div>
          <div className="signature"><small>西方星座</small><strong>{zodiacLabels[profile.zodiac]}</strong><span>作为辅助变量参与人格建模</span></div>
        </div>
        <section className="dominant-persona">
          <div className="persona-god"><span>主轴 · {profile.dominantPersona.weight}分</span><strong>{profile.dominantPersona.god}</strong><small>{profile.dominantPersona.name}</small></div>
          <div className="persona-god secondary"><span>副轴 · {profile.secondaryPersona.weight}分</span><strong>{profile.secondaryPersona.god}</strong><small>{profile.secondaryPersona.name}</small></div>
          <div className="persona-combined"><span>组合人格</span><h3>{profile.combinedPersona.name}</h3><p>{profile.combinedPersona.summary}</p></div>
          <div><span>行为特征</span><p>{profile.dominantPersona.behavior}；同时带有{profile.secondaryPersona.behavior}的副轴倾向。</p></div>
          <div><span>关系表现</span><p>{profile.dominantPersona.relationship}；副轴表现为{profile.secondaryPersona.relationship}。</p></div>
        </section>
        <section className="deep-radar-overview">
          <div><span>十二维人格图谱</span><h3>一张图，看见你的关系轮廓</h3><p>分数越靠近外圈，代表该倾向在关系中越容易被观察到。</p></div>
          <div className="deep-radar-chart">
            <svg viewBox="0 0 320 320" role="img" aria-label="十二维人格多边形图">
              <defs>
                <linearGradient id="deepRadarFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#72e0bd" /><stop offset=".52" stopColor="#779ddd" /><stop offset="1" stopColor="#f0a0ba" /></linearGradient>
                <filter id="deepRadarGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              {[112, 84, 56, 28].map((radius) => <polygon key={radius} points={deepGrid(radius)} className="radar-grid-line" />)}
              {profile.deepAnalysis.map((_, index) => { const [x, y] = polygonPoint(index, 12, 112).split(","); return <line key={index} x1="160" y1="160" x2={x} y2={y} />; })}
              <polygon points={deepValues} className="radar-value" />
              {profile.deepAnalysis.map((item, index) => { const [x, y] = polygonPoint(index, 12, 112 * item.score / 100).split(","); return <circle key={item.key} cx={x} cy={y} r="3" />; })}
            </svg>
            {profile.deepAnalysis.map((item, index) => {
              const angle = -Math.PI / 2 + index * Math.PI * 2 / 12;
              return <span key={item.key} style={{ left: `${50 + Math.cos(angle) * 39}%`, top: `${50 + Math.sin(angle) * 39}%` }}>{item.label}<b>{item.score}</b></span>;
            })}
          </div>
        </section>
        <div className="deep-profile">
          <div className="deep-profile-head">
            <div><span>关系人格侧写 · 四类十二项</span><h3>从命盘结构，观察具体关系情境</h3></div>
            <p>以月令、时支、日支、年支及透干十神构建量化参考，并分别观察其在亲密关系、日常协作与压力状态中的表现。结果用于描述倾向，不作确定性判断。</p>
          </div>
          <div className="deep-category-stack">
            {deepCategories.map((group, categoryIndex) => <section className="deep-category" key={group.category}>
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
                      <div className="axis-track"><i style={{ left: `${item.score}%` }}><b>{item.score}</b></i></div>
                      <p><strong>{band.label}</strong>{band.detail}</p>
                    </div>
                    <div className="deep-scene-preview">
                      {item.sceneInsights.slice(0, 2).map((scene) => <div key={scene.scene}><b>{scene.scene}</b><span>{scene.title}</span></div>)}
                    </div>
                    <p className="deep-note">{item.note}</p>
                    <Link className="logic-link" href={`/?${baseQuery}&view=deep&detail=${item.key}#deep-card-${item.key}`}>查看量化依据与三类场景 <span>→</span></Link>
                  </article>;
                })}
              </div>
            </section>)}
          </div>
        </div>
        <section className="specialty-analysis">
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
                  <div className="axis-track"><i style={{ left: `${item.score}%` }}><b>{item.score}</b></i></div>
                  <p><strong>{band.label}</strong>{band.detail}</p>
                </div>
                <div className="specialty-evidence">{item.evidence.map((evidence) => <span key={evidence}>{evidence}</span>)}</div>
                <small className="specialty-caution">{item.caution}</small>
              </article>;
            })}
          </div>
        </section>
        <div className="profile-grid">
          <section className="social-model-card">
            <header><div><small>社交行为模式</small><h3>你通常如何建立并维持连接</h3></div><p>由人格分布与关系倾向综合推导，描述更常出现的互动方式。</p></header>
            <div className="social-model-grid">
              {socialModelItems.map((item) => <article key={item.key}>
                <header><i>{item.symbol}</i><div><span>{item.label}</span><strong>{item.value}</strong></div></header>
                <div className="social-spectrum">{item.options.map((option, index) => <span className={index === item.active ? "active" : ""} key={option}>{option}</span>)}</div>
                <p>{item.description}</p>
              </article>)}
            </div>
          </section>
          <blockquote>“{profile.summary}”</blockquote>
        </div>
        <div className="relation-coordinate">
          <div className="coordinate-head">
            <div><span>双人五行关系坐标</span><h3>你与 {recommendations[0].name} 如何彼此影响</h3></div>
            <div className="people-key"><i className="me" />你 <i className="them" />{recommendations[0].name}</div>
          </div>
          <div className="coordinate-body">
            <div className="connection-orbit">
              <div className="person-node person-me"><strong>{profile.bazi.dayPillar[0]}</strong><span>你</span></div>
              <div className="relation-pulse"><b>{recommendations[0].result.score}</b><small>关系匹配</small></div>
              <div className="person-node person-them"><strong>{recommendations[0].candidateProfile.bazi.dayPillar[0]}</strong><span>{recommendations[0].name}</span></div>
            </div>
            <div className="element-relations">
              {(Object.keys(elementLabels) as (keyof typeof elementLabels)[]).map((key) => {
                const mine = profile.bazi.elements[key];
                const theirs = recommendations[0].candidateProfile.bazi.elements[key];
                const note = mine <= 1 && theirs >= 2 ? "对方补足你" : theirs <= 1 && mine >= 2 ? "你补足对方" : Math.abs(mine - theirs) <= 1 ? "能量同频" : "节奏差异";
                return <div className={`relation-row rel-${key}`} key={key}>
                  <span className="element-name">{elementLabels[key]}</span>
                  <div className="dual-bars"><i style={{ width: `${mine * 25}%` }} /><b style={{ width: `${theirs * 25}%` }} /></div>
                  <strong>{mine} : {theirs}</strong><small>{note}</small>
                </div>;
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="social-square">
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
      </section>

      <section className="match-workspace">
        <div className="match-intro">
          <div><span>RELATIONSHIP SCRIPT</span><h2>关系剧本<br />看你们会怎么发展。</h2></div>
          <p>输入对方出生时间，并选择真实关系场景。系统会同时读取双方十神、五行、情绪稳定与依恋节奏。</p>
        </div>
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
          <label className="relation-select"><span>你们的关系</span><select name="relationType" defaultValue={relationType}><option>恋爱</option><option>朋友</option><option>同事</option></select></label>
          <button type="submit">生成双人互动分析 <span>→</span></button>
        </form>

        {relationship && partnerProfile && <div className="relationship-result">
          <section className="duo-bazi-comparison">
            <header>
              <div><span>双人四柱命盘</span><h3>先看清两个人，再谈这段关系</h3></div>
              <small>双方均按节气交接排盘 · 合盘不展示大运</small>
            </header>
            <div className="duo-bazi-grid">
              {[
                { person: profile, name: birth.name ?? "我", tone: "mine" },
                { person: partnerProfile, name: partnerBirth?.name ?? "TA", tone: "theirs" },
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
          <div className="relationship-score">
            <div className="duo-avatars"><i>{profile.bazi.dayPillar[0]}</i><i>{partnerProfile.bazi.dayPillar[0]}</i></div>
            <span>{relationship.relationType}关系匹配</span>
            <strong>{relationship.score}<small>/100</small></strong>
            <h3>{relationship.headline}</h3>
            <p>{relationship.scoreSummary}</p>
          </div>
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
                  const [mineX, mineY] = polygonPoint(index, 6, 112 * item[1] / 100).split(",");
                  const [theirX, theirY] = polygonPoint(index, 6, 112 * item[2] / 100).split(",");
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
            <header><div><span>和谐分构成</span><h3>不是“像不像”，而是相处成本落在哪里</h3></div><small>六项场景加权 · 合冲克进入对应分项</small></header>
            <p className="score-method-intro">{relationship.scoreSummary}</p>
            <div className="score-breakdown-grid">
              {relationship.scoreBreakdown.map((item) => <article key={item.key}>
                <div><span>{item.label}<small>权重 {item.weight}%</small></span><strong>{item.score}</strong></div>
                <i><b style={{ width: `${item.score}%` }} /></i>
                <p>{item.summary}</p>
                <div className="score-basis">{item.basis.map((basis) => <span key={basis}>{basis}</span>)}</div>
                <small>计入总分 {item.contribution.toFixed(1)}</small>
              </article>)}
            </div>
          </section>
          <section className="duo-branch-script">
            <header><div><span>合盘特殊结构</span><h3>两张命盘放在一起，新发生了什么</h3></div><small>六合 · 六冲 · 三合 · 三会</small></header>
            {relationship.branchDynamics.length ? <div>
              {relationship.branchDynamics.map((dynamic, index) => <article key={`${dynamic.title}-${index}`} className={`duo-dynamic-${dynamic.type}`}>
                <div className="dynamic-mark"><span>{dynamic.type}</span><strong>{dynamic.branches.join(" · ")}</strong></div>
                <div className="dynamic-body">
                  <h4>{dynamic.title}</h4>
                  <div className="dynamic-roles"><span>{birth.name ?? "你"} · {dynamic.userRole}</span><i>×</i><span>{partnerBirth?.name ?? "TA"} · {dynamic.partnerRole}</span></div>
                  <div className="dynamic-source"><span>{birth.name ?? "你"}：{dynamic.userPillars.join("、")}</span><span>{partnerBirth?.name ?? "TA"}：{dynamic.partnerPillars.join("、")}</span><b>{dynamic.scoreImpact > 0 ? "+" : ""}{dynamic.scoreImpact} 分修正</b></div>
                  <div className="dynamic-strength"><small>结构强度 {dynamic.strength}</small><i><b style={{ width: `${dynamic.strength}%` }} /></i></div>
                  <p>{dynamic.summary}</p><p className="dynamic-scene">{dynamic.scenarioImpact}</p>
                  <aside><b>怎么相处</b>{dynamic.advice}</aside>
                </div>
              </article>)}
            </div> : <p className="duo-dynamic-empty">两张命盘之间没有形成明显的六合、六冲、三合、三会或天干相克，互动重点更多落在双方十神与行为维度。</p>}
          </section>
          <div className="interaction-grid">
            {relationship.cards.map((card, index) => <article id={`match-card-${card.key}`} key={card.key}>
              <header><span>0{index + 1}</span><h4>{card.label}</h4></header>
              <p>{card.summary}</p>
              <div className="interaction-why"><b>为什么会这样</b>{card.why}</div>
              <div className="interaction-advice"><b>相处建议</b>{card.advice}</div>
              <Link className="logic-link" href={`/?${baseQuery}&view=match${partnerQuery}&detail=${card.key}#match-card-${card.key}`}>查看双方推理 <span>→</span></Link>
            </article>)}
          </div>
        </div>}
      </section>

      <section className="recommendation-results">
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
      </section>

      <footer><div className="brand">FATE<span>°</span></div><p>Fate is a social matching system based on birth data and personality modeling.</p><small>不是算命，而是一种理解关系的新语言。</small></footer>
      {(selectedDeep || selectedInteraction) && <div className="logic-overlay">
        <Link className="logic-backdrop" href={`/?${baseQuery}&view=${view}${view === "match" ? partnerQuery : ""}#${returnAnchor}`} aria-label="关闭推理详情" />
        <section className="logic-sheet">
          <header><div><span>FATE / 推理详情</span><h2>{selectedDeep?.label ?? selectedInteraction?.label}</h2></div><Link href={`/?${baseQuery}&view=${view}${view === "match" ? partnerQuery : ""}#${returnAnchor}`}>×</Link></header>
          {selectedDeep && <>
            <div className="logic-result"><strong>{selectedDeep.score}</strong><div><span>{selectedDeep.category} · {selectedDeep.level}</span><h3>{selectedDeep.descriptor}</h3><p>{selectedDeep.summary}</p></div></div>
            <div className="logic-keywords">{selectedDeep.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
            <div className="logic-factor-panel"><h3>01 · 结构信号</h3><div className="deep-factor-tags">{factorTagsFor(selectedDeep.key).map((factor) => <span className={`factor-${factor.tone}`} key={`${factor.label}-${factor.tone}`}><i style={{ "--factor": `${factor.value}%` } as CSSProperties} /><b>{factor.label}</b><small>{factor.value}%</small></span>)}</div><p>标签展示该维度调用的主要十神与五行占比；位置权重已在底层统一折算，不在阅读层重复堆叠算式。</p></div>
            <div className="logic-block"><span>02 · 倾向如何形成</span><p>{selectedDeep.logic.premise}</p></div>
            <div className="logic-block counter"><span>03 · 什么时候不会这样</span><p>{selectedDeep.logic.counterSignal}</p></div>
            <div className="logic-block verify"><span>04 · 可以如何验证</span><p>{selectedDeep.logic.realWorldCheck}</p></div>
            <div className="detail-duo">
              <div><i>✦</i><span>这项倾向的优势</span><p>{selectedDeep.logic.strength}</p></div>
              <div><i>!</i><span>容易忽略的盲点</span><p>{selectedDeep.logic.blindSpot}</p></div>
            </div>
            <div className="scene-analysis"><h3>05 · 三类真实场景</h3>{selectedDeep.sceneInsights.map((scene, index) => <article key={scene.scene}><i>{index + 1}</i><div><span>{scene.scene} · {scene.title}</span><p>{scene.text}</p></div></article>)}</div>
            <div className="scene-grid"><h3>可观察行为</h3>{selectedDeep.logic.scenes.map((scene, index) => <div key={scene}><i>{index + 1}</i><span>{scene}</span></div>)}</div>
            <p className="logic-disclaimer">{selectedDeep.note}</p>
          </>}
          {selectedInteraction && <>
            <div className="logic-result"><strong>{relationship?.score}</strong><div><span>双人关系</span><p>{selectedInteraction.summary}</p></div></div>
            <div className="logic-steps"><h3>双方推导步骤</h3>{selectedInteraction.logic.map((step) => <div key={step}>{step}</div>)}</div>
            <div className="logic-block"><span>量化证据</span><p>{selectedInteraction.evidence}</p></div>
            <div className="logic-block counter"><span>关系原因</span><p>{selectedInteraction.why}</p></div>
            <div className="logic-block verify"><span>建议如何验证</span><p>{selectedInteraction.advice}</p></div>
          </>}
        </section>
      </div>}
      <nav className="mobile-bottom-nav" aria-label="移动端主导航">
        <Link className={view === "overview" ? "active" : ""} href={`/?${baseQuery}&view=overview`}><i>⌂</i><span>首页</span></Link>
        <Link className={view === "deep" ? "active" : ""} href={`/?${baseQuery}&view=deep`}><i>≋</i><span>深度</span></Link>
        <Link className={view === "match" ? "active" : ""} href={`/?${baseQuery}&view=match`}><i>◇</i><span>剧本</span></Link>
        <Link className={view === "square" ? "active" : ""} href={`/?${baseQuery}&view=square`}><i>◉</i><span>广场</span></Link>
      </nav>
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
  return <ResultContent birth={birth} view={view} partnerBirth={partnerBirth} relationType={String(query.relationType ?? "恋爱")} detail={String(query.detail ?? "")} assistantQuestion={String(query.ask ?? "")} flowYear={Number(query.flowYear ?? new Date().getFullYear())} />;
}
