import { describe, expect, it } from "vitest";
import { analyzeBirth, analyzeDuoRhythm, analyzeRelationship } from "../lib/fate";

// 话术合规规范（用户拍板）：不断言现实、不预言事件、不碰「准」话术、不绝对化。
// 本测试扫描双人报告全部面向读者的字符串，违例词一律不得出现。
const BANNED = /大概率|必然|十有[八九]|一定会|肯定会|注定|命中注定|被说中|准不准|保准|包你|第一战场|离婚|分手命|破财|血光|克死/;

const A = analyzeBirth({ year: 2003, month: 8, day: 9, hour: 16, minute: 0, name: "阿主", gender: "male" });
const B = analyzeBirth({ year: 1998, month: 8, day: 24, hour: 14, minute: 0, name: "小雨", gender: "female" });

describe("copy compliance", () => {
  it("关系报告全部文案无违例话术", () => {
    for (const relationType of ["恋爱", "朋友", "同事", "家人"]) {
      const rel = analyzeRelationship(A, B, relationType);
      const texts: string[] = [
        rel.headline, rel.scoreSummary, rel.spine.thesis,
        rel.spine.primaryResource.why, rel.spine.primaryTension.why,
        ...rel.spine.elementSynergy.sides,
        ...rel.scoreBreakdown.map((d) => d.summary),
        ...rel.cards.flatMap((c) => [c.summary, c.why, c.advice, ...c.logic]),
        ...rel.branchDynamics.flatMap((d) => [d.summary, d.scenarioImpact, d.advice]),
        rel.guide.verdict.quip, rel.guide.verdict.tagline, rel.guide.verdict.basis,
        rel.guide.philosophy, rel.guide.initiator.why, rel.guide.initiator.firstMove,
        ...rel.guide.behaviors.flatMap((b) => [b.conclusion, b.basis]),
        ...rel.guide.dispositions.flatMap((d) => [d.reading, d.approach]),
        ...rel.guide.manuals.flatMap((m) => [...m.dos, ...m.donts]),
        ...rel.guide.hotspots.flatMap((h) => [h.risk, h.playbook, h.source]),
        rel.guide.longRun,
      ];
      for (const text of texts) {
        const hit = text.match(BANNED);
        expect(hit, `违例「${hit?.[0]}」出自: ${text.slice(0, 60)}`).toBeNull();
      }
    }
  });

  it("流年节律文案无违例话术", () => {
    const years = analyzeDuoRhythm(A, B, "恋爱", 2026, 8);
    for (const y of years) {
      for (const text of [y.reading, y.advice, ...y.tendencies.flatMap((t) => t.causes.map((c) => c.detail))]) {
        const hit = text.match(BANNED);
        expect(hit, `违例「${hit?.[0]}」出自: ${text.slice(0, 60)}`).toBeNull();
      }
    }
  });

  it("使用说明书每人三条 Do 三条 Don't 且确定", () => {
    const rel = analyzeRelationship(A, B, "恋爱");
    expect(rel.guide.manuals).toHaveLength(2);
    for (const manual of rel.guide.manuals) {
      expect(manual.dos).toHaveLength(3);
      expect(manual.donts).toHaveLength(3);
    }
    expect(rel.guide.manuals).toEqual(analyzeRelationship(A, B, "恋爱").guide.manuals);
  });
});
