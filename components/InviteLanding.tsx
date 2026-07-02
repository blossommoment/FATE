"use client";

import { useState } from "react";
import type { BirthInput } from "@/lib/types";

// 被邀请方落地页：对方生辰已在链接里，这里只收集 TA 自己的出生信息。
export default function InviteLanding({ inviter, relationType }: { inviter: BirthInput; relationType: string }) {
  const [calendarType, setCalendarType] = useState<"solar" | "lunar">("solar");
  const inviterName = inviter.name?.trim() || "TA";

  return (
    <main className="invite-landing">
      <nav>
        <a className="brand" href="/"><i>缘</i>FATE<span>°</span></a>
        <div className="nav-links"><span>合盘邀请 · SYNASTRY</span></div>
      </nav>
      <section className="invite-hero">
        <div className="eyebrow">FATE 合盘邀请 / 一条链接，两张命盘</div>
        <h1>「{inviterName}」<br /><em>想和你合一盘。</em></h1>
        <p>
          {inviterName} 已经填好了自己的出生时间。补上你的，两个人的关系剧本会同时展开：
          你们怎么沟通、如何升温、冲突从哪里开始、吵架后怎么修复。
        </p>
        <small>不需要注册 · 你的信息只用于本次合盘计算</small>
      </section>
      <section className="entry invite-entry">
        <div>
          <div className="section-number">你的出生信息</div>
          <h2>轮到<br />你了。</h2>
          <p>提交后你将以自己的视角查看这份双人分析，也可以把结果链接发回给 {inviterName}。</p>
        </div>
        <form action="/" method="get">
          <input type="hidden" name="partnerYear" value={inviter.year} />
          <input type="hidden" name="partnerMonth" value={inviter.month} />
          <input type="hidden" name="partnerDay" value={inviter.day} />
          <input type="hidden" name="partnerHour" value={inviter.hour} />
          <input type="hidden" name="partnerMinute" value={inviter.minute ?? 0} />
          <input type="hidden" name="partnerName" value={inviterName} />
          <input type="hidden" name="partnerGender" value={inviter.gender ?? "female"} />
          <input type="hidden" name="partnerCalendarType" value={inviter.calendarType ?? "solar"} />
          <input type="hidden" name="partnerIsLeapMonth" value={inviter.isLeapMonth ? "true" : "false"} />
          <input type="hidden" name="view" value="match" />
          <input type="hidden" name="relationType" value={relationType} />
          <fieldset className="calendar-switch">
            <legend>日期类型</legend>
            <label className={calendarType === "solar" ? "active" : ""}>
              <input type="radio" name="calendarType" value="solar" checked={calendarType === "solar"} onChange={() => setCalendarType("solar")} />
              <span>公历</span><small>阳历生日</small>
            </label>
            <label className={calendarType === "lunar" ? "active" : ""}>
              <input type="radio" name="calendarType" value="lunar" checked={calendarType === "lunar"} onChange={() => setCalendarType("lunar")} />
              <span>农历</span><small>阴历生日</small>
            </label>
          </fieldset>
          <label><span>怎么称呼你</span><input name="name" type="text" defaultValue="我" required /></label>
          <label><span>出生年份</span><input name="year" type="number" min="1900" max="2100" defaultValue={2000} required /></label>
          <label><span>出生月份</span><input name="month" type="number" min="1" max="12" defaultValue={6} required /></label>
          <label><span>出生日期</span><input name="day" type="number" min="1" max="31" defaultValue={15} required /></label>
          <label><span>出生时辰（24小时）</span><input name="hour" type="number" min="0" max="23" defaultValue={12} required /></label>
          <label><span>出生分钟</span><input name="minute" type="number" min="0" max="59" defaultValue={0} required /></label>
          {calendarType === "lunar" && <label className="leap-field"><span>农历月份</span><span className="check-row"><input type="checkbox" name="isLeapMonth" value="true" />这是闰月</span></label>}
          <label className="gender-field"><span>性别</span><select name="gender" defaultValue="female"><option value="female">女</option><option value="male">男</option></select></label>
          <button type="submit">生成我们的合盘<span>↗</span></button>
        </form>
      </section>
      <footer>
        <div className="brand">FATE<span>°</span></div>
        <p>Fate is a social matching system based on birth data and personality modeling.</p>
        <small>不是算命，而是一种理解关系的新语言。</small>
      </footer>
    </main>
  );
}
