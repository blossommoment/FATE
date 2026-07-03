import { describe, expect, it } from "vitest";
import { analyzeBirth } from "../lib/fate";
import {
  JARGON_RE, TAG_EXPLAIN, buildDigestPrompt, buildFallbackDigest,
  buildPersonaTags, buildPersonalFacts, buildRecommendations, validateDigestPayload,
} from "../lib/digest";
import type { BirthInput } from "../lib/types";

// 深度解读报告（成册四章）黄金用例：标签与推荐是规则表映射，必须确定、
// 零命理黑话、每个标签带判定指标；正文（评述/建议）不得引用指标数字。

const alice: BirthInput = { year: 1998, month: 8, day: 24, hour: 14, minute: 0, name: "Alice", gender: "female", calendarType: "solar" };
const owner: BirthInput = { year: 2003, month: 8, day: 9, hour: 16, minute: 0, name: "阿主", gender: "male", calendarType: "solar" };

const JARGON = JARGON_RE;
const DIGIT = /[0-9０-９]/;

describe("人话标签（四域）", () => {
  it("确定性：同盘同标签", () => {
    const p = analyzeBirth(alice);
    expect(buildPersonaTags(p)).toEqual(buildPersonaTags(analyzeBirth(alice)));
  });

  it("四域各有标签，标签零黑话，且每个标签都带判定指标", () => {
    for (const birth of [alice, owner]) {
      const tags = buildPersonaTags(analyzeBirth(birth));
      expect(tags.love.length).toBeGreaterThanOrEqual(2);
      expect(tags.career.length).toBeGreaterThanOrEqual(1);
      expect(tags.social.length).toBeGreaterThanOrEqual(2);
      expect(tags.energy.length).toBeGreaterThanOrEqual(2);
      [...tags.love, ...tags.career, ...tags.social, ...tags.energy].forEach((hit) => {
        expect(JARGON.test(hit.tag), `标签「${hit.tag}」含命理黑话`).toBe(false);
        expect(hit.metrics.length, `标签「${hit.tag}」缺判定指标`).toBeGreaterThanOrEqual(1);
        hit.metrics.forEach((m) => expect(typeof m.value).toBe("number"));
      });
    }
  });

  it("命中规则的标签必须带触发阈值（图表刻度线）", () => {
    const tags = buildPersonaTags(analyzeBirth(owner));
    const ruleHits = [...tags.love, ...tags.social].filter((h) => !["顺其自然派"].includes(h.tag));
    expect(ruleHits.some((h) => h.metrics.some((m) => typeof m.t === "number"))).toBe(true);
  });

  it("锚点盘（2003-08-09 16时男）：官杀主轴高韧性 → 抗压执行型", () => {
    const tags = buildPersonaTags(analyzeBirth(owner));
    expect(tags.career.map((h) => h.tag)).toContain("抗压执行型");
    expect(tags.energy.map((h) => h.tag)).toContain("压力转化者");
  });
});

describe("推荐候选池", () => {
  it("职业 ≥3 且每条有 why；行业按喜用取，中和盘走十神池", () => {
    const weakOwner = buildRecommendations(analyzeBirth(owner)); // 身弱：喜水木
    expect(weakOwner.vocations.length).toBeGreaterThanOrEqual(3);
    weakOwner.vocations.forEach((v) => expect(v.why.length).toBeGreaterThan(4));
    expect(weakOwner.industries.some((i) => i.why.includes("水") || i.why.includes("木"))).toBe(true);

    const neutral = buildRecommendations(analyzeBirth(alice)); // 中和：喜忌为空
    expect(neutral.industries.length).toBeGreaterThanOrEqual(2);
    expect(neutral.environments[0]).toContain("节奏");
  });
});

describe("叙述层（成册四章）：提示词契约、校验器、兜底", () => {
  const facts = buildPersonalFacts(analyzeBirth(owner));

  it("提示词：FATE 模型口径、四章结构、正文禁数字禁术语", () => {
    const { system, user } = buildDigestPrompt(facts);
    expect(system).toContain("FATE 模型 2.0");
    expect(system).toContain("pages");
    expect(system).toContain("禁止出现任何数字");
    expect(system).toContain("禁止命理术语");
    expect(user).toContain("事实清单");
  });

  it("兜底成册：确定性、四章齐全、正文零黑话零数字（时运章放行数字）", () => {
    const fb = buildFallbackDigest(facts);
    expect(fb).toEqual(buildFallbackDigest(buildPersonalFacts(analyzeBirth(owner))));
    expect(fb.headline.length).toBeGreaterThan(0);
    (["love", "career", "social", "season"] as const).forEach((key) => {
      expect(fb.pages[key].essay.length).toBeGreaterThanOrEqual(90);
      expect(fb.pages[key].advice.length).toBeGreaterThanOrEqual(15);
      expect(JARGON.test(fb.pages[key].essay + fb.pages[key].advice), `${key} 章含黑话`).toBe(false);
      if (key !== "season") expect(DIGIT.test(fb.pages[key].essay + fb.pages[key].advice), `${key} 章正文含数字`).toBe(false);
    });
    expect(validateDigestPayload(fb, facts)).not.toBeNull(); // 兜底自身必须过校验
  });

  it("校验器：拒绝正文数字、拒绝黑话、拒绝缺章", () => {
    const good = buildFallbackDigest(facts);
    const withDigit = { ...good, pages: { ...good.pages, love: { ...good.pages.love, essay: `${good.pages.love.essay}你的信任速度是34。` } } };
    expect(validateDigestPayload(withDigit, facts)).toBeNull();
    const withJargon = { ...good, pages: { ...good.pages, career: { ...good.pages.career, essay: `${good.pages.career.essay}因为你七杀旺。` } } };
    expect(validateDigestPayload(withJargon, facts)).toBeNull();
    const missing = { headline: good.headline, pages: { love: good.pages.love } };
    expect(validateDigestPayload(missing, facts)).toBeNull();
    expect(validateDigestPayload("not an object", facts)).toBeNull();
  });

  it("标签解释表覆盖：四域标签与时运章印都有人话解释", () => {
    for (const birth of [alice, owner]) {
      const f = buildPersonalFacts(analyzeBirth(birth));
      [...f.tags.love, ...f.tags.career, ...f.tags.social, ...f.tags.energy].forEach((hit) => {
        expect(TAG_EXPLAIN[hit.tag], `标签「${hit.tag}」缺解释`).toBeTruthy();
      });
      expect(f.seasonStamps.environment.note.length).toBeGreaterThan(0);
    }
  });
});

describe("个人事实清单（叙述层唯一输入）", () => {
  it("结构完整且确定：强弱、喜忌、四域标签、时运章印、大运线", () => {
    const facts = buildPersonalFacts(analyzeBirth(owner));
    expect(facts.strength.level).toBe("身弱");
    expect(facts.favorable).toEqual(["水", "木"]);
    expect(facts.tags.social.length).toBeGreaterThanOrEqual(2);
    expect(facts.seasonStamps.phase.tag).toContain("期");
    expect(facts.luckLine.length).toBeGreaterThanOrEqual(4);
    expect(facts.luckLine.some((step) => step.current)).toBe(true);
    expect(facts.dayPillar).toBe("甲寅");
    expect(buildPersonalFacts(analyzeBirth(owner))).toEqual(facts);
  });
});
