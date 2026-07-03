import { describe, expect, it } from "vitest";
import { analyzeBirth } from "../lib/fate";
import {
  JARGON_RE, TAG_EXPLAIN, buildDigestPrompt, buildFallbackDigest,
  buildPersonaTags, buildPersonalFacts, buildRecommendations, validateDigestPayload,
} from "../lib/digest";
import type { BirthInput } from "../lib/types";

// AI 读你 · A1 黄金用例：标签与推荐是规则表映射，必须确定且零命理黑话。
// AI 只在这些确定性产物之上做挑选与措辞——本文件锁定的是"账本到人话"的翻译层。

const alice: BirthInput = { year: 1998, month: 8, day: 24, hour: 14, minute: 0, name: "Alice", gender: "female", calendarType: "solar" };
const owner: BirthInput = { year: 2003, month: 8, day: 9, hour: 16, minute: 0, name: "阿主", gender: "male", calendarType: "solar" };

const JARGON = JARGON_RE;

describe("人话标签", () => {
  it("确定性：同盘同标签", () => {
    const p = analyzeBirth(alice);
    expect(buildPersonaTags(p)).toEqual(buildPersonaTags(analyzeBirth(alice)));
  });

  it("三域各至少 2 个标签，标签零黑话，且每个标签都带判定指标（依据可视化）", () => {
    for (const birth of [alice, owner]) {
      const tags = buildPersonaTags(analyzeBirth(birth));
      expect(tags.love.length).toBeGreaterThanOrEqual(2);
      expect(tags.career.length).toBeGreaterThanOrEqual(1);
      expect(tags.energy.length).toBeGreaterThanOrEqual(2);
      [...tags.love, ...tags.career, ...tags.energy].forEach((hit) => {
        expect(JARGON.test(hit.tag), `标签「${hit.tag}」含命理黑话`).toBe(false);
        expect(hit.metrics.length, `标签「${hit.tag}」缺判定指标`).toBeGreaterThanOrEqual(1);
        hit.metrics.forEach((m) => expect(typeof m.value).toBe("number"));
      });
    }
  });

  it("锚点盘（2003-08-09 16时男）：官杀主轴高韧性 → 抗压执行型", () => {
    const tags = buildPersonaTags(analyzeBirth(owner));
    expect(tags.career.map((h) => h.tag)).toContain("抗压执行型");
    expect(tags.energy.map((h) => h.tag)).toContain("压力转化者");
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

describe("AI 叙述层（A2）：提示词契约、校验器、兜底", () => {
  const facts = buildPersonalFacts(analyzeBirth(owner));

  it("提示词包含硬性契约与输出结构", () => {
    const { system, user } = buildDigestPrompt(facts);
    expect(system).toContain("禁用命理术语");
    expect(system).toContain("headline");
    expect(user).toContain("事实清单");
  });

  it("兜底成品：确定性、结构完整、正文零黑话、每个标签都有解释", () => {
    const fb = buildFallbackDigest(facts);
    expect(fb).toEqual(buildFallbackDigest(buildPersonalFacts(analyzeBirth(owner))));
    expect(fb.headline.length).toBeGreaterThan(0);
    expect(fb.tagReads.every((t) => t.note.length > 0)).toBe(true);
    const everything = [fb.headline, fb.summary, ...Object.values(fb.advice), ...fb.tagReads.map((t) => t.note)].join("");
    // 契约：术语只许进括号依据——括号外正文零黑话
    expect(JARGON.test(everything.replace(/（[^）]*）|\([^)]*\)/g, ""))).toBe(false);
    expect(validateDigestPayload(fb, facts)).not.toBeNull(); // 兜底自身必须过校验
  });

  it("校验器：拒绝自创标签、拒绝黑话正文、拒绝缺字段", () => {
    const good = buildFallbackDigest(facts);
    expect(validateDigestPayload({ ...good, tagReads: [{ tag: "天选打工人", note: "x" }, ...good.tagReads] }, facts)).toBeNull();
    expect(validateDigestPayload({ ...good, summary: `${good.summary}你的七杀很旺。` }, facts)).toBeNull();
    expect(validateDigestPayload({ ...good, advice: { ...good.advice, phase: "" } }, facts)).toBeNull();
    expect(validateDigestPayload("not an object", facts)).toBeNull();
  });

  it("标签解释表覆盖全库：任何可能出现的标签都有人话解释", () => {
    for (const birth of [alice, owner]) {
      const tags = buildPersonaTags(analyzeBirth(birth));
      [...tags.love, ...tags.career, ...tags.energy].forEach((hit) => {
        expect(TAG_EXPLAIN[hit.tag], `标签「${hit.tag}」缺解释`).toBeTruthy();
      });
    }
  });

  it("兜底 tagReads 覆盖全部标签（校验器的逐条覆盖要求）", () => {
    const fb = buildFallbackDigest(facts);
    const all = [...facts.tags.love, ...facts.tags.career, ...facts.tags.energy].map((h) => h.tag);
    all.forEach((tag) => expect(fb.tagReads.some((t) => t.tag === tag)).toBe(true));
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
