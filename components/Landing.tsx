"use client";

import { useState } from "react";
import type { BirthInput, MatchResult, UserProfile } from "@/lib/types";

const candidates: { name: string; role: string; birth: BirthInput }[] = [
  { name: "林知遥", role: "安静的观察者", birth: { year: 1997, month: 11, day: 8, hour: 22 } },
  { name: "陈弥", role: "好奇的连接者", birth: { year: 1999, month: 6, day: 17, hour: 10 } },
  { name: "周屿", role: "稳定的建设者", birth: { year: 1995, month: 4, day: 28, hour: 16 } },
];

const labels = {
  extroversion: "外向表达",
  stability: "情绪稳定",
  control: "边界控制",
  emotion: "情感感知",
};

const elementLabels = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
const zodiacLabels: Record<string, string> = {
  Aries: "白羊座", Taurus: "金牛座", Gemini: "双子座", Cancer: "巨蟹座",
  Leo: "狮子座", Virgo: "处女座", Libra: "天秤座", Scorpio: "天蝎座",
  Sagittarius: "射手座", Capricorn: "摩羯座", Aquarius: "水瓶座", Pisces: "双鱼座",
};
const socialLabels: Record<string, string> = {
  low: "低", medium: "中等", high: "高", slow: "慢热", fast: "快速",
  secure: "安全型", anxious: "焦虑型", avoidant: "回避型",
};
const initialBirth: BirthInput = { year: 1998, month: 8, day: 24, hour: 14, minute: 0, gender: "female", name: "我", calendarType: "solar", isLeapMonth: false };

export default function Landing({ embeddedResult = false }: { embeddedResult?: boolean }) {
  const [birth, setBirth] = useState<BirthInput>(initialBirth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [match, setMatch] = useState<(MatchResult & { name: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    setLoading(true); setError(""); setMatch(null);
    const response = await fetch("/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(birth),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.error);
    setProfile(data);
    setTimeout(() => document.querySelector("#report")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function findMatch(candidate: typeof candidates[number]) {
    if (!profile) return;
    setLoading(true); setError("");
    const response = await fetch("/api/match", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userA: profile, userB: candidate.birth }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.error);
    setMatch({ ...data, name: candidate.name });
    setTimeout(() => document.querySelector("#match-result")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const update = (key: keyof BirthInput, value: string) => setBirth((old) => ({ ...old, [key]: Number(value) }));
  const updateGender = (value: string) => setBirth((old) => ({ ...old, gender: value as BirthInput["gender"] }));
  const updateCalendar = (value: "solar" | "lunar") => setBirth((old) => ({ ...old, calendarType: value, isLeapMonth: value === "lunar" ? old.isLeapMonth : false }));
  const updateName = (value: string) => setBirth((old) => ({ ...old, name: value }));

  return (
    <main>
      <nav>
        <a className="brand" href="#"><i>缘</i>FATE<span>°</span></a>
        <div className="nav-links"><a href="#method">分析方法</a><a href="#report">我的画像</a><span>V1 / 关系模型</span></div>
      </nav>

      <section className="hero">
        <div className="fate-display">
          <span>FATE<i>°</i></span>
          <small>缘分不是注定<br />是理解之后的选择</small>
        </div>
        <div className="eyebrow">关系人格建模系统 / SOCIAL MATCHING</div>
        <h1>遇见与你<br /><em>相互成全的人。</em></h1>
        <p className="hero-copy">出生数据不是答案。它是一组坐标，用来理解你如何靠近、表达，以及与谁产生真正的张力。</p>
        <div className="five-orbit" aria-hidden="true">
          <span className="wood">木</span><span className="fire">火</span><span className="earth">土</span><span className="metal">金</span><span className="water">水</span>
          <b>你</b>
        </div>
      </section>

      <section className="entry" id="method">
        <div>
          <div className="section-number">01 — 出生信息</div>
          <h2>从一个时间点<br />开始认识你。</h2>
          <p>我们将出生信息转译为结构化人格信号。没有预言，只有可解释的关系模型。</p>
        </div>
        <form action="/" method="get">
          <fieldset className="calendar-switch">
            <legend>日期类型</legend>
            <label className={birth.calendarType !== "lunar" ? "active" : ""}><input type="radio" name="calendarType" value="solar" checked={birth.calendarType !== "lunar"} onChange={() => updateCalendar("solar")} /><span>公历</span><small>阳历生日</small></label>
            <label className={birth.calendarType === "lunar" ? "active" : ""}><input type="radio" name="calendarType" value="lunar" checked={birth.calendarType === "lunar"} onChange={() => updateCalendar("lunar")} /><span>农历</span><small>阴历生日</small></label>
          </fieldset>
          <label><span>怎么称呼你</span><input name="name" aria-label="怎么称呼你" type="text" value={birth.name} onChange={(e) => updateName(e.target.value)} /></label>
          <label><span>出生年份</span><input name="year" aria-label="出生年份" type="number" value={birth.year} min="1900" max="2100" onChange={(e) => update("year", e.target.value)} /></label>
          <label><span>出生月份</span><input name="month" aria-label="出生月份" type="number" value={birth.month} min="1" max="12" onChange={(e) => update("month", e.target.value)} /></label>
          <label><span>出生日期</span><input name="day" aria-label="出生日期" type="number" value={birth.day} min="1" max="31" onChange={(e) => update("day", e.target.value)} /></label>
          <label><span>出生时辰（24小时）</span><input name="hour" aria-label="出生时辰" type="number" value={birth.hour} min="0" max="23" onChange={(e) => update("hour", e.target.value)} /></label>
          <label><span>出生分钟</span><input name="minute" aria-label="出生分钟" type="number" value={birth.minute ?? 0} min="0" max="59" onChange={(e) => update("minute", e.target.value)} /></label>
          {birth.calendarType === "lunar" && <label className="leap-field"><span>农历月份</span><span className="check-row"><input type="checkbox" name="isLeapMonth" value="true" checked={birth.isLeapMonth ?? false} onChange={(event) => setBirth((old) => ({ ...old, isLeapMonth: event.target.checked }))} />这是闰月</span></label>}
          <label className="gender-field"><span>性别</span><select name="gender" aria-label="性别" value={birth.gender} onChange={(e) => updateGender(e.target.value)}><option value="female">女</option><option value="male">男</option></select></label>
          <button type="submit">生成我的八字与人格画像<span>↗</span></button>
          {error && <p className="error">{error}</p>}
        </form>
      </section>

      {profile && (
        <section className="report" id="report">
          <div className="report-head">
            <div><div className="section-number">02 — 你的关系画像</div><h2>四个维度，<br />看见真实的你。</h2></div>
            <div className="signature"><small>西方星座</small><strong>{zodiacLabels[profile.zodiac]}</strong><span>年柱 {profile.bazi.yearPillar} · 月柱 {profile.bazi.monthPillar} · 日柱 {profile.bazi.dayPillar} · 时柱 {profile.bazi.hourPillar}</span></div>
          </div>

          <div className="metrics">
            {(Object.entries(profile.personality) as [keyof typeof labels, number][]).map(([key, value]) => (
              <div className="metric" key={key}>
                <div><span>{labels[key]}</span><strong>{value}</strong></div>
                <div className="track"><i style={{ width: `${value}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="profile-grid">
            <div className="element-card">
              <small>五行能量分布 / 共 8 个字</small>
              <div className="elements">{Object.entries(profile.bazi.elements).map(([key, value]) => <div key={key}><b>{value}</b><span>{elementLabels[key as keyof typeof elementLabels]}</span></div>)}</div>
            </div>
            <div className="social-card">
              <small>社交行为模型</small>
              <dl>
                <div><dt>沟通需求</dt><dd>{socialLabels[profile.socialProfile.communication_need]}</dd></div>
                <div><dt>冲突耐受</dt><dd>{socialLabels[profile.socialProfile.conflict_tolerance]}</dd></div>
                <div><dt>关系节奏</dt><dd>{socialLabels[profile.socialProfile.relationship_speed]}</dd></div>
                <div><dt>依恋倾向</dt><dd>{socialLabels[profile.socialProfile.attachment_style]}</dd></div>
              </dl>
            </div>
            <blockquote>“{profile.summary}”</blockquote>
          </div>
        </section>
      )}

      {profile && (
        <section className="matches">
          <div className="section-number">03 — 推荐匹配</div>
          <h2>也许有人，<br /><em>刚好与你不同。</em></h2>
          <div className="candidate-list">
            {candidates.map((candidate, index) => (
              <button className="candidate" key={candidate.name} onClick={() => findMatch(candidate)}>
                <span className="index">0{index + 1}</span>
                <span><strong>{candidate.name}</strong><small>{candidate.role}</small></span>
                <span className="date">{candidate.birth.year}.{candidate.birth.month}.{candidate.birth.day}</span>
                <span className="arrow">↗</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {match && (
        <section className="match-result" id="match-result">
          <div className="score"><small>与 {match.name} 的匹配度</small><strong>{match.score}<sup>/100</sup></strong></div>
          <div>
            <div className="section-number">匹配解释</div>
            <h2>{match.score >= 75 ? "差异，恰好成为引力。" : "一段值得慢慢验证的关系。"}</h2>
            <p className="analysis">{match.analysis}</p>
            <ul>{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </div>
        </section>
      )}

      {!embeddedResult && <footer>
        <div className="brand">FATE<span>°</span></div>
        <p>Fate is a social matching system based on birth data and personality modeling.</p>
        <small>不是算命，而是一种理解关系的新语言。</small>
      </footer>}
    </main>
  );
}
