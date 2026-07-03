import { describe, expect, it } from "vitest";
import { analyzeBirth, analyzeRelationship, buildRelationshipFacts, matchProfiles, validateBirth } from "../lib/fate";
import type { BirthInput } from "../lib/types";

// 产品核心承诺：同一八字在任何设备、任何时间得出相同结果。
// 这些黄金用例锁定当前算法输出；若有意调整算法，需同步更新快照并知晓
// 已有用户的报告会随之改变。

const alice: BirthInput = { year: 1998, month: 8, day: 24, hour: 14, minute: 0, name: "Alice", gender: "female", calendarType: "solar" };
const bob: BirthInput = { year: 1997, month: 11, day: 8, hour: 22, minute: 0, name: "Bob", gender: "male", calendarType: "solar" };
const lunarUser: BirthInput = { year: 2000, month: 5, day: 12, hour: 8, minute: 0, gender: "male", calendarType: "lunar" };

describe("determinism", () => {
  it("analyzeBirth returns identical output for identical input", () => {
    expect(analyzeBirth(alice)).toEqual(analyzeBirth(alice));
    expect(analyzeBirth(lunarUser)).toEqual(analyzeBirth(lunarUser));
  });

  it("profile id is derived from birth data, not random", () => {
    expect(analyzeBirth(alice).id).toBe("199808241400");
  });

  it("matchProfiles is deterministic and symmetric in score", () => {
    const a = analyzeBirth(alice);
    const b = analyzeBirth(bob);
    const first = matchProfiles(a, b);
    const second = matchProfiles(a, b);
    expect(first.score).toBe(second.score);
    expect(first.reasons).toEqual(second.reasons);
  });
});

describe("golden cases", () => {
  it("solar birth pillars", () => {
    const p = analyzeBirth(alice);
    expect({
      yearPillar: p.bazi.yearPillar,
      monthPillar: p.bazi.monthPillar,
      dayPillar: p.bazi.dayPillar,
      hourPillar: p.bazi.hourPillar,
      zodiac: p.zodiac,
      elements: p.bazi.elements,
    }).toMatchInlineSnapshot(`
      {
        "dayPillar": "癸卯",
        "elements": {
          "earth": 3,
          "fire": 0,
          "metal": 2,
          "water": 1,
          "wood": 2,
        },
        "hourPillar": "己未",
        "monthPillar": "庚申",
        "yearPillar": "戊寅",
        "zodiac": "Virgo",
      }
    `);
  });

  it("lunar birth converts to solar before charting", () => {
    const p = analyzeBirth(lunarUser);
    expect({
      solarDate: p.bazi.solarDate,
      lunarDate: p.bazi.lunarDate,
      dayPillar: p.bazi.dayPillar,
    }).toMatchInlineSnapshot(`
      {
        "dayPillar": "壬寅",
        "lunarDate": "二〇〇〇年五月十二",
        "solarDate": "2000-06-13 08:00:00",
      }
    `);
  });

  it("match score is stable", () => {
    const result = matchProfiles(analyzeBirth(alice), analyzeBirth(bob));
    expect(result.score).toMatchInlineSnapshot(`67`);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("relationship spine & facts contract", () => {
  it("spine 主线确定性：主要资源=六维最高，主要矛盾=六维最低", () => {
    const a = analyzeBirth(alice);
    const b = analyzeBirth(bob);
    const rel = analyzeRelationship(a, b);
    const sorted = [...rel.scoreBreakdown].sort((x, y) => y.score - x.score);
    expect(rel.spine.primaryResource.key).toBe(sorted[0].key);
    expect(rel.spine.primaryTension.key).toBe(sorted[sorted.length - 1].key);
    expect(rel.spine.thesis).toContain(rel.spine.primaryResource.label);
    expect(rel.spine.elementSynergy.sides).toHaveLength(2);
    expect(analyzeRelationship(a, b).spine).toEqual(rel.spine);
  });

  it("事实清单含 spine 与所有权契约", () => {
    const a = analyzeBirth(alice);
    const b = analyzeBirth(bob);
    const facts = buildRelationshipFacts(a, b, analyzeRelationship(a, b));
    expect(facts.spine.thesis.length).toBeGreaterThan(0);
    expect(facts.contract.ownership.behaviors).toContain("肆");
    expect(facts.contract.rule).toContain("主场章节");
    expect(facts.initiator.name.length).toBeGreaterThan(0);
  });
});

describe("validateBirth", () => {
  it("accepts valid input", () => {
    expect(validateBirth(alice)).toBeNull();
  });

  it("rejects non-integer fields", () => {
    expect(validateBirth({ ...alice, month: 8.5 })).not.toBeNull();
  });
});
