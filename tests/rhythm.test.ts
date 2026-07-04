import { describe, expect, it } from "vitest";
import { analyzeBirth, analyzeDuoRhythm } from "../lib/fate";

// 双人流年节律（倾向制）：规则确定性 + 倾向必有可视化原因 + 合规口径
const A = analyzeBirth({ year: 2003, month: 8, day: 9, hour: 16, minute: 0, name: "阿主", gender: "male" });
const B = analyzeBirth({ year: 1998, month: 8, day: 24, hour: 14, minute: 0, name: "小雨", gender: "female" });

describe("analyzeDuoRhythm", () => {
  it("产出跨度正确且完全确定", () => {
    const first = analyzeDuoRhythm(A, B, "恋爱", 2026, 3);
    const second = analyzeDuoRhythm(A, B, "恋爱", 2026, 3);
    expect(first).toHaveLength(3);
    expect(first).toEqual(second);
    expect(first.map((y) => y.year)).toEqual([2026, 2027, 2028]);
    expect(first[0].ganZhi).toBe("丙午");
  });

  it("倾向值在界内、按值降序、每条倾向都有原因标签", () => {
    const years = analyzeDuoRhythm(A, B, "恋爱", 2026, 6);
    const labels = ["变动", "动荡", "推进", "外缘", "耗损"];
    for (const y of years) {
      for (let i = 0; i < y.tendencies.length; i++) {
        const t = y.tendencies[i];
        expect(labels).toContain(t.label);
        expect(t.value).toBeGreaterThanOrEqual(30);
        expect(t.value).toBeLessThanOrEqual(94);
        expect(t.causes.length).toBeGreaterThan(0); // 倾向必须可溯源：无因不出
        for (const c of t.causes) {
          expect(["阿主", "小雨"]).toContain(c.who);
          expect(c.label.length).toBeGreaterThan(1);
        }
        if (i > 0) expect(t.value).toBeLessThanOrEqual(y.tendencies[i - 1].value);
      }
    }
  });

  it("评述零数字、无吉凶断言词、恋爱盘冲的是婚姻宫", () => {
    const years = analyzeDuoRhythm(A, B, "恋爱", 2026, 6);
    const allCauseLabels = years.flatMap((y) => y.tendencies.flatMap((t) => t.causes.map((c) => c.label)));
    expect(allCauseLabels).toContain("婚姻宫被冲"); // 2028 戊申冲阿主日支寅
    expect(allCauseLabels).toContain("驿马动");
    for (const y of years) {
      expect(/[0-9０-９]/.test(y.reading)).toBe(false);
      expect(/[0-9０-９]/.test(y.advice)).toBe(false);
      expect(/离婚|分手命|破财|血光|灾|凶|克死|注定/.test(y.reading + y.advice)).toBe(false);
      expect(y.reading.length).toBeGreaterThan(40);
    }
    // 非恋爱盘不使用婚姻宫措辞
    const friendYears = analyzeDuoRhythm(A, B, "朋友", 2026, 6);
    const friendLabels = friendYears.flatMap((y) => y.tendencies.flatMap((t) => t.causes.map((c) => c.label)));
    expect(friendLabels.some((label) => label.includes("婚姻宫"))).toBe(false);
  });
});
