import Link from "next/link";
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
  birth, embedded = false, view = "overview", partnerBirth, relationType = "恋爱", detail, assistantQuestion,
}: {
  birth: BirthInput;
  embedded?: boolean;
  view?: "overview" | "deep" | "match" | "square";
  partnerBirth?: BirthInput;
  relationType?: string;
  detail?: string;
  assistantQuestion?: string;
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
  const baseQuery = `year=${birth.year}&month=${birth.month}&day=${birth.day}&hour=${birth.hour}&minute=${birth.minute ?? 0}&gender=${birth.gender ?? "female"}&name=${encodeURIComponent(birth.name ?? "我")}`;
  const partnerQuery = partnerBirth ? `&partnerYear=${partnerBirth.year}&partnerMonth=${partnerBirth.month}&partnerDay=${partnerBirth.day}&partnerHour=${partnerBirth.hour}&partnerMinute=${partnerBirth.minute ?? 0}&partnerGender=${partnerBirth.gender ?? "male"}&partnerName=${encodeURIComponent(partnerBirth.name ?? "TA")}&relationType=${encodeURIComponent(relationType)}` : "";
  const selectedDeep = view === "deep" ? profile.deepAnalysis.find((item) => item.key === detail) : null;
  const selectedInteraction = view === "match" ? relationship?.cards.find((item) => item.key === detail) : null;
  const selectedSources = selectedDeep ? profile.tenGodSources.filter((source) => selectedDeep.evidence.some((item) => item.includes(source.god))) : [];
  const assistantContext = selectedDeep ? {
    title: selectedDeep.label, summary: selectedDeep.summary, evidence: [...selectedDeep.evidence, ...selectedSources.map((source) => `${source.pillar}${source.layer}${source.god}，权重 ${source.weight.toFixed(2)}`)],
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
  const assistantFields: Record<string, string> = {
    year: String(birth.year), month: String(birth.month), day: String(birth.day), hour: String(birth.hour),
    minute: String(birth.minute ?? 0), name: birth.name ?? "我",
    gender: birth.gender ?? "female", view, ...(detail ? { detail } : {}),
    ...(partnerBirth ? {
      partnerYear: String(partnerBirth.year), partnerMonth: String(partnerBirth.month),
      partnerDay: String(partnerBirth.day), partnerHour: String(partnerBirth.hour),
      partnerMinute: String(partnerBirth.minute ?? 0), partnerName: partnerBirth.name ?? "TA",
      partnerGender: partnerBirth.gender ?? "male", relationType,
    } : {}),
    ...(assistantQuestion ? { ask: assistantQuestion } : {}),
  };
  const polygonPoint = (index: number, count: number, radius: number, center = 160) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
  };
  const deepGrid = (radius: number) => profile.deepAnalysis.map((_, index) => polygonPoint(index, 12, radius)).join(" ");
  const deepValues = profile.deepAnalysis.map((item, index) => polygonPoint(index, 12, 112 * item.score / 100)).join(" ");
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
  return (
    <main className={`result-page view-${view}`}>
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
            <p>{birth.name ?? "我"} · {birth.year} 年 {birth.month} 月 {birth.day} 日 · {String(birth.hour).padStart(2, "0")}:{String(birth.minute ?? 0).padStart(2, "0")} · {birth.gender === "male" ? "男" : birth.gender === "female" ? "女" : "未透露"} · {zodiacLabels[profile.zodiac]}</p>
          </div>
          <div className="identity-tags">{profile.identityTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </div>
        <div className="chart-heading">
          <div><div className="section-number">四柱命盘 · 按节气交接</div><h2>你的底层能量结构</h2></div>
          <div className="term-context"><span>生于 {profile.bazi.previousSolarTerm.name} 后</span><small>{profile.bazi.previousSolarTerm.at}</small><i /><span>下一个节气 · {profile.bazi.nextSolarTerm.name}</span><small>{profile.bazi.nextSolarTerm.at}</small></div>
        </div>
        <div className="bazi-chart">
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
        <section className="luck-cycles">
          <header>
            <div><span>基础大运 · 阶段主题</span><h2>人生节奏，不是一条直线</h2></div>
            <div className="luck-start"><strong>{profile.luckCycles.direction}</strong><span>{profile.luckCycles.startAgeText}起运</span><small>{profile.luckCycles.startDate}</small></div>
          </header>
          <div className="luck-current">
            <i>{profile.luckCycles.currentYear}</i>
            <div><span>此刻所在阶段</span><p>{profile.luckCycles.currentAnalysis}</p></div>
          </div>
          <div className="luck-track" aria-label="八步大运时间轴">
            {profile.luckCycles.periods.map((period) => {
              const tone = ({ 甲: "wood", 乙: "wood", 丙: "fire", 丁: "fire", 戊: "earth", 己: "earth", 庚: "metal", 辛: "metal", 壬: "water", 癸: "water" } as Record<string, string>)[period.ganZhi[0]];
              return <article className={`${period.isCurrent ? "current " : ""}luck-${tone}`} key={`${period.ganZhi}-${period.startYear}`}>
                <div className="luck-node"><i /><span>{period.isCurrent ? "当下" : `${period.startAge}岁`}</span></div>
                <div className="luck-glyph"><strong>{period.ganZhi[0]}</strong><strong>{period.ganZhi[1]}</strong></div>
                <div className="luck-years">{period.startYear}<i />{period.endYear}</div>
                <div className="luck-gods"><span>{period.stemTenGod}</span><span>{period.branchTenGod}</span></div>
                <h3>{period.theme}</h3>
                <p>{period.analysis}</p>
              </article>;
            })}
          </div>
          <footer>大运用于观察十年阶段的关注重心，不把具体事件写成确定结论。</footer>
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
            <div><span>深度侧写 · 12 个关系倾向</span><h3>关系里的你，比一个标签复杂得多</h3></div>
            <p>月令权重最高、时柱次之；地支本气高于天干，中气与余气递减。每项均可查看具体来源。</p>
          </div>
          <div className="deep-card-grid">
            {profile.deepAnalysis.map((item, index) => {
              return <article className={`deep-card deep-tone-${index % 4}`} key={item.key}>
                <header>
                  <div><small>0{index + 1}</small><h4>{item.label}</h4></div>
                  <div className="deep-score"><strong>{item.score}</strong><span>{item.level}</span></div>
                </header>
                <p className="deep-summary">{item.summary}</p>
                <p className="deep-note">{item.note}</p>
                <Link className="logic-link" href={`/?${baseQuery}&view=deep&detail=${item.key}`}>查看完整推理逻辑 <span>→</span></Link>
              </article>;
            })}
          </div>
        </div>
        <div className="profile-grid">
          <div className="element-card"><small>五行能量分布 / 共 8 个字</small><div className="elements">
            {Object.entries(profile.bazi.elements).map(([key, value]) => <div key={key}><b>{value}</b><span>{elementLabels[key as keyof typeof elementLabels]}</span></div>)}
          </div></div>
          <div className="social-card"><small>社交行为模型</small><dl>
            <div><dt>沟通需求</dt><dd>{socialLabels[profile.socialProfile.communication_need]}</dd></div>
            <div><dt>冲突耐受</dt><dd>{socialLabels[profile.socialProfile.conflict_tolerance]}</dd></div>
            <div><dt>关系节奏</dt><dd>{socialLabels[profile.socialProfile.relationship_speed]}</dd></div>
            <div><dt>依恋倾向</dt><dd>{socialLabels[profile.socialProfile.attachment_style]}</dd></div>
          </dl></div>
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
          <input type="hidden" name="view" value="match" />
          <label><span>对方昵称</span><input name="partnerName" type="text" defaultValue={partnerBirth?.name ?? "TA"} required /></label>
          <label><span>对方出生年份</span><input name="partnerYear" type="number" min="1900" max="2100" defaultValue={partnerBirth?.year ?? 2001} required /></label>
          <label><span>月份</span><input name="partnerMonth" type="number" min="1" max="12" defaultValue={partnerBirth?.month ?? 6} required /></label>
          <label><span>日期</span><input name="partnerDay" type="number" min="1" max="31" defaultValue={partnerBirth?.day ?? 18} required /></label>
          <label><span>时辰</span><input name="partnerHour" type="number" min="0" max="23" defaultValue={partnerBirth?.hour ?? 10} required /></label>
          <label><span>分钟</span><input name="partnerMinute" type="number" min="0" max="59" defaultValue={partnerBirth?.minute ?? 0} required /></label>
          <label className="relation-select"><span>对方性别</span><select name="partnerGender" defaultValue={partnerBirth?.gender ?? "male"}><option value="female">女</option><option value="male">男</option><option value="other">其他／不透露</option></select></label>
          <label className="relation-select"><span>你们的关系</span><select name="relationType" defaultValue={relationType}><option>恋爱</option><option>朋友</option><option>同事</option></select></label>
          <button type="submit">生成双人互动分析 <span>→</span></button>
        </form>

        {relationship && partnerProfile && <div className="relationship-result">
          <div className="relationship-score">
            <div className="duo-avatars"><i>{profile.bazi.dayPillar[0]}</i><i>{partnerProfile.bazi.dayPillar[0]}</i></div>
            <span>{relationship.relationType}关系匹配</span>
            <strong>{relationship.score}<small>/100</small></strong>
            <h3>{relationship.headline}</h3>
          </div>
          <section className="duo-radar-panel">
            <header><div><span>双人六维关系图</span><h3>你们在哪些地方相似，哪里互补</h3></div><div className="duo-legend"><i />你 <b />对方</div></header>
            <div className="duo-radar-chart">
              <svg viewBox="0 0 320 320" role="img" aria-label="双方六维重叠关系图">
                {[112, 84, 56, 28].map((radius) => <polygon key={radius} points={duoGrid(radius)} className="radar-grid-line" />)}
                {duoDimensions.map((_, index) => { const [x, y] = polygonPoint(index, 6, 112).split(","); return <line key={index} x1="160" y1="160" x2={x} y2={y} />; })}
                <polygon points={duoMine} className="duo-mine" />
                <polygon points={duoTheirs} className="duo-theirs" />
              </svg>
              {duoDimensions.map(([label], index) => {
                const angle = -Math.PI / 2 + index * Math.PI * 2 / 6;
                return <span key={label} style={{ left: `${50 + Math.cos(angle) * 38}%`, top: `${50 + Math.sin(angle) * 38}%` }}>{label}</span>;
              })}
            </div>
          </section>
          <section className="duo-branch-script">
            <header><div><span>合盘特殊结构</span><h3>两张命盘放在一起，新发生了什么</h3></div><small>六合 · 六冲 · 三合 · 三会</small></header>
            {relationship.branchDynamics.length ? <div>
              {relationship.branchDynamics.map((dynamic, index) => <article key={`${dynamic.title}-${index}`} className={`duo-dynamic-${dynamic.type}`}>
                <div className="dynamic-mark"><span>{dynamic.type}</span><strong>{dynamic.branches.join(" · ")}</strong></div>
                <div className="dynamic-body"><h4>{dynamic.title}</h4><div className="dynamic-roles"><span>{birth.name ?? "你"} · {dynamic.userRole}</span><i>×</i><span>{partnerBirth?.name ?? "TA"} · {dynamic.partnerRole}</span></div><p>{dynamic.summary}</p><aside><b>怎么相处</b>{dynamic.advice}</aside></div>
              </article>)}
            </div> : <p className="duo-dynamic-empty">两张命盘之间没有形成完整的六合、六冲、三合或三会，互动重点更多落在六维关系轮廓。</p>}
          </section>
          <div className="interaction-grid">
            {relationship.cards.map((card, index) => <article key={card.key}>
              <header><span>0{index + 1}</span><h4>{card.label}</h4></header>
              <p>{card.summary}</p>
              <div className="interaction-why"><b>为什么会这样</b>{card.why}</div>
              <div className="interaction-advice"><b>相处建议</b>{card.advice}</div>
              <Link className="logic-link" href={`/?${baseQuery}&view=match${partnerQuery}&detail=${card.key}`}>查看双方推理 <span>→</span></Link>
            </article>)}
          </div>
          <section className="social-conversion">
            <header><span>现在，去聊一下</span><small>只给行动，不讲道理</small></header>
            <div className="conversion-atmosphere"><b>你们的社交氛围</b><p>{relationship.socialConversion.atmosphere}</p></div>
            <div className="conversion-icebreakers"><b>第一句话可以这样发</b>{relationship.socialConversion.icebreakers.map((line) => <button key={line}>“{line}” <span>复制</span></button>)}</div>
            <div className="conversion-trigger"><b>关系触发点</b><p>{relationship.socialConversion.trigger}</p></div>
          </section>
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
        <Link className="logic-backdrop" href={`/?${baseQuery}&view=${view}${view === "match" ? partnerQuery : ""}`} aria-label="关闭推理详情" />
        <section className="logic-sheet">
          <header><div><span>FATE / 推理详情</span><h2>{selectedDeep?.label ?? selectedInteraction?.label}</h2></div><Link href={`/?${baseQuery}&view=${view}${view === "match" ? partnerQuery : ""}`}>×</Link></header>
          {selectedDeep && <>
            <div className="logic-result"><strong>{selectedDeep.score}</strong><div><span>{selectedDeep.level}</span><p>{selectedDeep.summary}</p></div></div>
            <div className="logic-steps"><h3>01 · 读取本命位置与权重</h3>
              {selectedSources.map((source, index) => <div key={`${source.pillar}-${source.layer}-${source.god}-${index}`}><b>{source.pillar} · {source.layer}</b><span>{source.god}</span><strong>{source.weight.toFixed(2)}</strong></div>)}
              {selectedSources.length === 0 && selectedDeep.evidence.map((item) => <div key={item}>{item}</div>)}
            </div>
            <div className="logic-block"><span>02 · 组合规则</span><p>{selectedDeep.logic.premise}</p></div>
            <div className="logic-block counter"><span>03 · 反向信号</span><p>{selectedDeep.logic.counterSignal}</p></div>
            <div className="logic-block verify"><span>04 · 现实验证</span><p>{selectedDeep.logic.realWorldCheck}</p></div>
            <div className="detail-duo">
              <div><i>✦</i><span>这项倾向的优势</span><p>{selectedDeep.logic.strength}</p></div>
              <div><i>!</i><span>容易忽略的盲点</span><p>{selectedDeep.logic.blindSpot}</p></div>
            </div>
            <div className="scene-grid"><h3>它会在哪些场景出现</h3>{selectedDeep.logic.scenes.map((scene, index) => <div key={scene}><i>{index + 1}</i><span>{scene}</span></div>)}</div>
            <p className="logic-disclaimer">{selectedDeep.note}</p>
          </>}
          {selectedInteraction && <>
            <div className="logic-result"><strong>{relationship?.score}</strong><div><span>双人关系</span><p>{selectedInteraction.summary}</p></div></div>
            <div className="logic-steps"><h3>双方推导步骤</h3><div>分别读取两人的关系轮廓</div><div>比较重合、互补与容易错位的区域</div><div>{selectedInteraction.summary}</div></div>
            <div className="logic-block"><span>关系原因</span><p>{selectedInteraction.summary}</p></div>
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
      <ChatAssistant contextTitle={assistantContext.title} contextSummary={assistantContext.summary} evidence={assistantContext.evidence} suggestions={assistantContext.suggestions} answer={assistantAnswer} baseHref={assistantHref} hiddenFields={assistantFields} />
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
    gender: query.gender === "male" || query.gender === "other" ? query.gender : "female",
  };
  const partnerBirth: BirthInput | undefined = query.partnerYear ? {
    year: Number(query.partnerYear), month: Number(query.partnerMonth),
    day: Number(query.partnerDay), hour: Number(query.partnerHour),
    minute: Number(query.partnerMinute ?? 0), name: String(query.partnerName ?? "TA"),
    gender: query.partnerGender === "female" || query.partnerGender === "other" ? query.partnerGender : "male",
  } : undefined;
  const view = query.view === "deep" || query.view === "match" || query.view === "square" ? query.view : "overview";
  return <ResultContent birth={birth} view={view} partnerBirth={partnerBirth} relationType={String(query.relationType ?? "恋爱")} detail={String(query.detail ?? "")} assistantQuestion={String(query.ask ?? "")} />;
}
