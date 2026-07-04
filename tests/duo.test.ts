import { describe, expect, it } from "vitest";
import { analyzeBirth, analyzeDuoRhythm, analyzeRelationship } from "../lib/fate";
import { JARGON_RE } from "../lib/digest";
import {
  DUO_TAG_EXPLAIN, buildDuoComparisons, buildDuoFacts, buildDuoFallback,
  buildDuoPrompt, buildDuoTags, validateDuoPayload,
} from "../lib/duo";
import type { BirthInput } from "../lib/types";

// 双人深度解读 B1 黄金用例：五域双人标签（组合规则触发）与对比数据，
// 必须确定、零命理黑话、每个标签带双人指标；总分永不进入事实清单正文契约。

const owner: BirthInput = { year: 2003, month: 8, day: 9, hour: 16, minute: 0, name: "阿主", gender: "male", calendarType: "solar" };
const alice: BirthInput = { year: 1998, month: 8, day: 24, hour: 14, minute: 0, name: "小雨", gender: "female", calendarType: "solar" };
const bob: BirthInput = { year: 1997, month: 11, day: 8, hour: 22, minute: 0, name: "阿泽", gender: "male", calendarType: "solar" };

const DOMAINS = ["origin", "daily", "friction", "longrun", "season"] as const;

describe("双人标签（五域）", () => {
  const tagsFor = (x: BirthInput, y: BirthInput) => {
    const px = analyzeBirth(x);
    const py = analyzeBirth(y);
    return buildDuoTags(px, py, analyzeDuoRhythm(px, py, "恋爱", 2026, 5));
  };

  it("确定性：同一对盘同标签", () => {
    expect(tagsFor(owner, alice)).toEqual(tagsFor(owner, alice));
  });

  it("五域各有标签，零黑话；非时运域每个标签带双人指标，时运域指标为倾向峰值", () => {
    for (const pair of [[owner, alice], [owner, bob], [alice, bob]] as const) {
      const tags = tagsFor(pair[0], pair[1]);
      for (const domain of DOMAINS) {
        expect(tags[domain].length, `${domain} 域为空`).toBeGreaterThanOrEqual(1);
        tags[domain].forEach((hit) => {
          expect(JARGON_RE.test(hit.tag), `标签「${hit.tag}」含黑话`).toBe(false);
          if (domain !== "season") {
            expect(hit.metrics.length, `标签「${hit.tag}」缺指标`).toBeGreaterThanOrEqual(1);
            hit.metrics.forEach((m) => {
              expect(typeof m.a).toBe("number");
              expect(typeof m.b).toBe("number");
            });
          } else {
            hit.metrics.forEach((m) => expect(typeof m.a).toBe("number"));
          }
        });
      }
    }
  });

  it("解释表覆盖：所有可能出现的双人标签都有人话解释", () => {
    for (const pair of [[owner, alice], [owner, bob], [alice, bob]] as const) {
      const tags = tagsFor(pair[0], pair[1]);
      DOMAINS.flatMap((domain) => tags[domain]).forEach((hit) => {
        expect(DUO_TAG_EXPLAIN[hit.tag], `标签「${hit.tag}」缺解释`).toBeTruthy();
      });
    }
  });
});

describe("对比数据表征", () => {
  it("四域各三条对比（值+差值+档位）；时运走 facts.rhythm 未来五年", () => {
    const c = buildDuoComparisons(analyzeBirth(owner), analyzeBirth(bob));
    (["origin", "daily", "friction", "longrun"] as const).forEach((domain) => {
      expect(c[domain]).toHaveLength(3);
      c[domain].forEach((row) => {
        expect(row.gap).toBe(Math.abs(row.a - row.b));
        expect(["同步", "有差", "显著"]).toContain(row.level);
      });
    });
    const pa = analyzeBirth(owner);
    const pb = analyzeBirth(bob);
    const facts = buildDuoFacts(pa, pb, analyzeRelationship(pa, pb, "恋爱"));
    expect(facts.rhythm).toHaveLength(5);
    for (const yearItem of facts.rhythm) {
      expect(yearItem.ganZhi).toHaveLength(2);
      yearItem.tendencies.forEach((t) => { expect(t.value).toBeGreaterThanOrEqual(30); expect(t.causes.length).toBeGreaterThan(0); });
    }
  });
});

describe("叙述层（B2）：五章 prompt、校验器、兜底", () => {
  const a = analyzeBirth(owner);
  const b = analyzeBirth(alice);
  const facts = buildDuoFacts(a, b, analyzeRelationship(a, b, "恋爱"));

  it("提示词：FATE 模型口径、五章结构、名字互称、禁数字禁术语", () => {
    const { system, user } = buildDuoPrompt(facts);
    expect(system).toContain("FATE 模型 2.0");
    expect(system).toContain("season");
    expect(system).toContain("禁止出现任何数字");
    expect(system).toContain("阿主");
    expect(system).toContain("小雨");
    expect(user).toContain("双人事实清单");
  });

  it("兜底成册：确定性、五章齐全、正文零黑话零数字（时运章放行）、自身过校验", () => {
    const fb = buildDuoFallback(facts);
    expect(fb).toEqual(buildDuoFallback(buildDuoFacts(a, b, analyzeRelationship(a, b, "恋爱"))));
    (["origin", "daily", "friction", "longrun", "season"] as const).forEach((key) => {
      expect(fb.pages[key].essay.length, `${key} 章过短`).toBeGreaterThanOrEqual(90);
      expect(fb.pages[key].advice.length).toBeGreaterThanOrEqual(15);
      expect(JARGON_RE.test(fb.pages[key].essay + fb.pages[key].advice), `${key} 章含黑话`).toBe(false);
      if (key !== "season") expect(/[0-9]/.test(fb.pages[key].essay + fb.pages[key].advice), `${key} 章含数字`).toBe(false);
      expect(fb.pages[key].essay.includes("阿主") || fb.pages[key].essay.includes("小雨") || fb.pages[key].essay.includes("你们"), `${key} 章缺称呼`).toBe(true);
    });
    expect(validateDuoPayload(fb)).not.toBeNull();
  });

  it("校验器：拒绝正文数字、拒绝黑话、拒绝缺章", () => {
    const good = buildDuoFallback(facts);
    const withDigit = { ...good, pages: { ...good.pages, origin: { ...good.pages.origin, essay: `${good.pages.origin.essay}你们的默契度是87。` } } };
    expect(validateDuoPayload(withDigit)).toBeNull();
    const withJargon = { ...good, pages: { ...good.pages, daily: { ...good.pages.daily, essay: `${good.pages.daily.essay}因为你们的日主相合。` } } };
    expect(validateDuoPayload(withJargon)).toBeNull();
    expect(validateDuoPayload({ headline: good.headline, pages: { origin: good.pages.origin } })).toBeNull();
    expect(validateDuoPayload("nope")).toBeNull();
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
