"use client";

import { useState, type FormEvent } from "react";
import type { BirthInput } from "@/lib/types";

type Props = {
  birth: BirthInput;
  partnerBirth?: BirthInput;
  relationType: string;
};

export default function PartnerForm({ birth, partnerBirth, relationType }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const partner: BirthInput = {
      name: String(form.get("partnerName") ?? "TA").trim() || "TA",
      year: Number(form.get("partnerYear")),
      month: Number(form.get("partnerMonth")),
      day: Number(form.get("partnerDay")),
      hour: Number(form.get("partnerHour")),
      minute: Number(form.get("partnerMinute")),
      gender: form.get("partnerGender") === "female" ? "female" : "male",
      calendarType: form.get("partnerCalendarType") === "lunar" ? "lunar" : "solar",
      isLeapMonth: form.get("partnerIsLeapMonth") === "true",
    };

    try {
      const response = await fetch("/api/report-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birth, partnerBirth: partner, relationType: String(form.get("relationType") ?? "恋爱") }),
      });
      const data = await response.json() as { state?: string; error?: string };
      if (!response.ok || !data.state) throw new Error(data.error || "无法创建双人报告");
      window.location.assign(`/?state=${encodeURIComponent(data.state)}&view=match`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法创建双人报告");
      setSubmitting(false);
    }
  };

  return (
    <form className="partner-form" onSubmit={submit}>
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
      <button type="submit" disabled={submitting}>{submitting ? "正在创建私密报告..." : <>生成双人互动分析 <span>→</span></>}</button>
      {error && <p className="partner-form-error">{error}</p>}
    </form>
  );
}
