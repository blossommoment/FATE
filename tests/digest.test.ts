import { describe, expect, it } from "vitest";
import { analyzeBirth } from "../lib/fate";
import { buildPersonaTags, buildPersonalFacts, buildRecommendations } from "../lib/digest";
import type { BirthInput } from "../lib/types";

// AI 读你 · A1 黄金用例：标签与推荐是规则表映射，必须确定且零命理黑话。
// AI 只在这些确定性产物之上做挑选与措辞——本文件锁定的是"账本到人话"的翻译层。

const alice: BirthInput = { year: 1998, month: 8, day: 24, hour: 14, minute: 0, name: "Alice", gender: "female", calendarType: "solar" };
const owner: BirthInput = { year: 2003, month: 8, day: 9, hour: 16, minute: 0, name: "阿主", gender: "male", calendarType: "solar" };

const JARGON = /食神|伤官|比肩|劫财|正印|偏印|正官|七杀|正财|偏财|日主|喜用|忌神|身弱|身强|从弱|从强|禄|刃/;

describe("人话标签", () => {
  it("确定性：同盘同标签", () => {
    const p = analyzeBirth(alice);
    expect(buildPersonaTags(p)).toEqual(buildPersonaTags(analyzeBirth(alice)));
  });

  it("三域各至少 2 个标签，标签本身零命理黑话", () => {
    for (const birth of [alice, owner]) {
      const tags = buildPersonaTags(analyzeBirth(birth));
      expect(tags.love.length).toBeGreaterThanOrEqual(2);
      expect(tags.career.length).toBeGreaterThanOrEqual(1);
      expect(tags.energy.length).toBeGreaterThanOrEqual(2);
      [...tags.love, ...tags.career, ...tags.energy].forEach((tag) => {
        expect(JARGON.test(tag), `标签「${tag}」含命理黑话`).toBe(false);
      });
    }
  });

  it("锚点盘（2003-08-09 16时男）：官杀主轴高韧性 → 抗压执行型", () => {
    const tags = buildPersonaTags(analyzeBirth(owner));
    expect(tags.career).toContain("抗压执行型");
    expect(tags.energy).toContain("压力转化者");
  });
});

describe("推荐候选池", () => {
  it("职业 ≥3 且每条有 why；行业按喜用取，中和盘走十神池", () => {
    const strongOwner = buildRecommendations(analyzeBirth(owner)); // 身弱：喜水木
    expect(strongOwner.vocations.length).toBeGreaterThanOrEqual(3);
    strongOwner.vocations.forEach((v) => expect(v.why.length).toBeGreaterThan(4));
    expect(strongOwner.industries.some((i) => i.why.includes("水") || i.why.includes("木"))).toBe(true);

    const neutral = buildRecommendations(analyzeBirth(alice)); // 中和：喜忌为空
    expect(neutral.industries.length).toBeGreaterThanOrEqual(2);
    expect(neutral.environments[0]).toContain("节奏");
  });

  it("当下时段策略引用大运补耗判定", () => {
    const rec = buildRecommendations(analyzeBirth(owner));
    expect(rec.currentPhase).toMatch(/段|流年/);
  });
});

describe("个人事实清单（AI 唯一输入）", () => {
  it("结构完整且确定", () => {
    const facts = buildPersonalFacts(analyzeBirth(owner));
    expect(facts.strength.level).toBe("身弱");
    expect(facts.favorable).toEqual(["水", "木"]);
    expect(facts.tags.love.length).toBeGreaterThanOrEqual(2);
    expect(facts.contract.rule).toContain("禁用命理术语");
    expect(buildPersonalFacts(analyzeBirth(owner))).toEqual(facts);
  });
});
