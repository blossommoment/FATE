import { describe, expect, it } from "vitest";
import { analyzeBirth, analyzeRelationship } from "../lib/fate";
import { JARGON_RE } from "../lib/digest";
import { DUO_TAG_EXPLAIN, buildDuoComparisons, buildDuoFacts, buildDuoTags } from "../lib/duo";
import type { BirthInput } from "../lib/types";

// 双人深度解读 B1 黄金用例：五域双人标签（组合规则触发）与对比数据，
// 必须确定、零命理黑话、每个标签带双人指标；总分永不进入事实清单正文契约。

const owner: BirthInput = { year: 2003, month: 8, day: 9, hour: 16, minute: 0, name: "阿主", gender: "male", calendarType: "solar" };
const alice: BirthInput = { year: 1998, month: 8, day: 24, hour: 14, minute: 0, name: "小雨", gender: "female", calendarType: "solar" };
const bob: BirthInput = { year: 1997, month: 11, day: 8, hour: 22, minute: 0, name: "阿泽", gender: "male", calendarType: "solar" };

const DOMAINS = ["origin", "daily", "friction", "longrun", "season"] as const;

describe("双人标签（五域）", () => {
  it("确定性：同一对盘同标签", () => {
    const t1 = buildDuoTags(analyzeBirth(owner), analyzeBirth(alice));
    const t2 = buildDuoTags(analyzeBirth(owner), analyzeBirth(alice));
    expect(t1).toEqual(t2);
  });

  it("五域各 ≥2 个标签，零黑话，且每个标签带双人指标", () => {
    for (const pair of [[owner, alice], [owner, bob], [alice, bob]] as const) {
      const tags = buildDuoTags(analyzeBirth(pair[0]), analyzeBirth(pair[1]));
      for (const domain of DOMAINS) {
        expect(tags[domain].length, `${domain} 域不足 2 个`).toBeGreaterThanOrEqual(2);
        tags[domain].forEach((hit) => {
          expect(JARGON_RE.test(hit.tag), `标签「${hit.tag}」含黑话`).toBe(false);
          expect(hit.metrics.length, `标签「${hit.tag}」缺指标`).toBeGreaterThanOrEqual(1);
          hit.metrics.forEach((m) => {
            expect(typeof m.a).toBe("number");
            expect(typeof m.b).toBe("number");
          });
        });
      }
    }
  });

  it("解释表覆盖：所有可能出现的双人标签都有人话解释", () => {
    for (const pair of [[owner, alice], [owner, bob], [alice, bob]] as const) {
      const tags = buildDuoTags(analyzeBirth(pair[0]), analyzeBirth(pair[1]));
      DOMAINS.flatMap((domain) => tags[domain]).forEach((hit) => {
        expect(DUO_TAG_EXPLAIN[hit.tag], `标签「${hit.tag}」缺解释`).toBeTruthy();
      });
    }
  });
});

describe("对比数据表征", () => {
  it("四域各三条对比（值+差值+档位），时运为双人大运线", () => {
    const c = buildDuoComparisons(analyzeBirth(owner), analyzeBirth(bob));
    (["origin", "daily", "friction", "longrun"] as const).forEach((domain) => {
      expect(c[domain]).toHaveLength(3);
      c[domain].forEach((row) => {
        expect(row.gap).toBe(Math.abs(row.a - row.b));
        expect(["同步", "有差", "显著"]).toContain(row.level);
      });
    });
    expect(c.season.a.length).toBeGreaterThanOrEqual(4);
    expect(c.season.a.some((s) => s.current)).toBe(true);
    expect(c.season.b.some((s) => s.current)).toBe(true);
  });
});

describe("双人事实清单", () => {
  it("结构完整且确定；契约禁分数外显；判词在、总分数字不在", () => {
    const a = analyzeBirth(owner);
    const b = analyzeBirth(alice);
    const facts = buildDuoFacts(a, b, analyzeRelationship(a, b));
    expect(facts.persons[0].name).toBe("阿主");
    expect(facts.verdict.title.length).toBeGreaterThan(0);
    expect(facts.contract.rule).toContain("总分");
    expect(facts.contract.output).toContain("五章");
    expect(Object.keys(facts.duoTags)).toEqual([...DOMAINS]);
    expect(buildDuoFacts(a, b, analyzeRelationship(a, b))).toEqual(facts);
    // 事实清单里不携带 score 字段（总分永不外显，拍板#3）
    expect(JSON.stringify(facts)).not.toContain("\"score\"");
  });
});
