import { describe, expect, it } from "vitest";
import {
  computeEnergy,
  findBestRoot,
  preprocessInteractions,
  seasonCoefficient,
  type PillarGZ,
} from "../lib/energy";

// 五行能量引擎 v2 黄金用例 —— 对应 docs/REQ_ENERGY_REPORT_V2.md 2.3
// 用例多为「性质断言」（相对比较、档位归属），初始系数校准时数值可变，
// 但这些性质是模型的底线承诺，破坏即回归失败。

const gz = (s: string): PillarGZ => ({ gan: s[0], zhi: s[1] });
const chart = (...pillars: string[]) => pillars.map(gz);

// 历法有效性（五虎遁定月干、五鼠遁定时干）——判定级黄金用例必须真实存在，
// 否则可能锁定历法根本不会产生的结构（如甲日申时必为壬申，戊申不存在）。
// 纯机制单测（preprocessInteractions 等）允许合成干支，不受此约束。
const STEM_SEQ = "甲乙丙丁戊己庚辛壬癸";
const BRANCH_SEQ = "子丑寅卯辰巳午未申酉戌亥";
const TIGER_BASE: Record<string, number> = { 甲: 2, 己: 2, 乙: 4, 庚: 4, 丙: 6, 辛: 6, 丁: 8, 壬: 8, 戊: 0, 癸: 0 };
const RAT_BASE: Record<string, number> = { 甲: 0, 己: 0, 乙: 2, 庚: 2, 丙: 4, 辛: 4, 丁: 6, 壬: 6, 戊: 8, 癸: 8 };
const isCalendarValid = (pillars: string[]): boolean => {
  const [y, mo, d, h] = pillars;
  const monthOk = mo[0] === STEM_SEQ[(TIGER_BASE[y[0]] + ((BRANCH_SEQ.indexOf(mo[1]) - 2 + 12) % 12)) % 10];
  const hourOk = h[0] === STEM_SEQ[(RAT_BASE[d[0]] + BRANCH_SEQ.indexOf(h[1])) % 10];
  return monthOk && hourOk;
};

describe("判定级黄金用例的历法有效性守卫", () => {
  it("所有判定级用例必须是真实历法可产生的盘", () => {
    const verdictCharts = [
      ["癸卯", "乙卯", "丁丑", "甲辰"],
      ["戊子", "丁巳", "庚辰", "丙子"],
      ["丙寅", "甲午", "庚寅", "丁亥"],
      ["癸未", "庚申", "甲寅", "壬申"],
      ["辛酉", "丁酉", "乙酉", "己卯"],
      ["甲午", "丙寅", "甲辰", "乙亥"],
      ["癸丑", "庚申", "壬寅", "壬寅"],
      ["己卯", "辛未", "壬午", "丁未"],
      ["己卯", "戊辰", "己丑", "甲子"],
      ["癸未", "丁巳", "丙午", "辛卯"],
      ["庚午", "辛巳", "壬寅", "壬寅"],
    ];
    verdictCharts.forEach((c) => {
      expect(isCalendarValid(c), `${c.join(" ")} 历法无效`).toBe(true);
    });
  });
});

describe("旺相休囚死季节系数", () => {
  it("卯月（木令）：火处相位，得生", () => {
    expect(seasonCoefficient("wood", "fire")).toBe(1.2);
  });
  it("巳月（火令）：金处死位", () => {
    expect(seasonCoefficient("fire", "metal")).toBe(0.6);
  });
  it("子月（水令）：火处死位、金处休位、土处囚位", () => {
    expect(seasonCoefficient("water", "fire")).toBe(0.6);
    expect(seasonCoefficient("water", "metal")).toBe(0.9);
    expect(seasonCoefficient("water", "earth")).toBe(0.7);
  });
});

describe("通根层级", () => {
  it("禄刃根 > 长生根 > 中余气根 > 墓库根 > 虚浮", () => {
    expect(findBestRoot("甲", [{ zhi: "寅", availability: 1 }]).tier).toBe("禄刃");
    expect(findBestRoot("庚", [{ zhi: "巳", availability: 1 }]).tier).toBe("长生");
    expect(findBestRoot("壬", [{ zhi: "丑", availability: 1 }]).tier).toBe("中余气");
    expect(findBestRoot("甲", [{ zhi: "未", availability: 1 }]).tier).toBe("中余气"); // 未藏乙，优于墓库
    expect(findBestRoot("丙", [{ zhi: "戌", availability: 1 }]).tier).toBe("中余气"); // 戌藏丁
    expect(findBestRoot("甲", [{ zhi: "子", availability: 1 }]).tier).toBeNull();
    expect(findBestRoot("甲", [{ zhi: "子", availability: 1 }]).multiplier).toBe(0.3);
  });

  it("巳月庚金：巳既是长生地又藏中气庚，庚金有根非虚浮", () => {
    const root = findBestRoot("庚", [{ zhi: "巳", availability: 1 }]);
    expect(root.tier).toBe("长生");
    expect(root.multiplier).toBeCloseTo(1.15, 5);
  });

  it("根被冲伤时乘数打折", () => {
    const intact = findBestRoot("甲", [{ zhi: "寅", availability: 1 }]);
    const damaged = findBestRoot("甲", [{ zhi: "寅", availability: 0.6 }]);
    expect(damaged.multiplier).toBeLessThan(intact.multiplier);
    expect(damaged.multiplier).toBeGreaterThan(1); // 伤而未拔
  });

  it("阴干无长生根：丁在卯按病地不取根（卯中乙木非火）", () => {
    expect(findBestRoot("丁", [{ zhi: "卯", availability: 1 }]).tier).toBeNull();
  });
});

describe("黄金用例：卯月丁火（弱而有源，非从弱）", () => {
  const ding = computeEnergy(chart("癸卯", "乙卯", "丁丑", "甲辰"));

  it("火得月令生（相位），日主得令标记为真", () => {
    expect(ding.dayMaster.gotSeason).toBe(true);
  });

  it("满盘皆木、日主虚浮，仍不判从弱——印星当令有源", () => {
    expect(ding.dayMaster.rooted).toBe(false);
    expect(ding.dayMaster.level).not.toBe("从弱");
    expect(ding.dayMaster.score).toBeGreaterThan(30);
  });

  it("无根不言强：印重身轻也不判身强", () => {
    expect(ding.dayMaster.level).not.toBe("身强");
  });

  it("母旺子衰上限生效：印超比劫两倍的部分传导降档", () => {
    expect(ding.dayMaster.reasons.join("")).toContain("母旺子衰已封顶");
  });

  it("同一盘火能量：卯月高于子月（相位 vs 死位）", () => {
    const inMao = computeEnergy(chart("癸卯", "乙卯", "丁丑", "甲辰"));
    const inZi = computeEnergy(chart("癸卯", "乙子", "丁丑", "甲辰"));
    expect(inMao.raw.fire).toBeGreaterThan(inZi.raw.fire);
  });
});

describe("黄金用例：巳月庚金（偏弱、进气、有根，非从弱）", () => {
  const geng = computeEnergy(chart("戊子", "丁巳", "庚辰", "丙子"));

  it("日主有根（长生于巳兼月令藏中气庚）", () => {
    expect(geng.dayMaster.rooted).toBe(true);
  });

  it("判身弱而非从弱", () => {
    expect(geng.dayMaster.level).toBe("身弱");
  });

  it("身弱喜印比：喜用为土金", () => {
    expect(geng.dayMaster.favorable).toEqual(["earth", "metal"]);
  });
});

describe("黄金用例：得三天干不如一地支", () => {
  it("三个虚浮木干的能量 < 一个卯根（同为丑月控制变量）", () => {
    const threeStems = computeEnergy(chart("甲子", "乙丑", "壬申", "甲午"));
    const oneBranch = computeEnergy(chart("庚子", "辛丑", "壬午", "癸卯"));
    expect(oneBranch.raw.wood).toBeGreaterThan(threeStems.raw.wood);
  });
});

describe("合冲刑害预处理", () => {
  it("六冲距离衰减：紧贴伤重，遥冲伤轻", () => {
    const adjacent = preprocessInteractions(chart("甲巳", "丙午", "戊子", "庚酉"), "fire");
    const remote = preprocessInteractions(chart("甲巳", "丙午", "戊酉", "庚子"), "fire");
    const ziAdjacent = adjacent.branches[2].availability;
    const ziRemote = remote.branches[3].availability;
    expect(ziAdjacent).toBeLessThan(ziRemote);
  });

  it("六冲旺衰有别：当令一方伤轻，失令一方伤重", () => {
    const { branches } = preprocessInteractions(chart("甲巳", "丙午", "戊子", "庚酉"), "fire");
    const wu = branches[1].availability; // 午得令
    const zi = branches[2].availability; // 子失令
    expect(wu).toBeGreaterThan(zi);
  });

  it("六合化：化神得月令则化（丑月子丑合化土）", () => {
    const { branches, structures } = preprocessInteractions(chart("甲子", "乙丑", "丙寅", "丁卯"), "earth");
    expect(structures.some((s) => s.type === "六合化")).toBe(true);
    expect(branches[0].conversions.some((c) => c.to === "earth" && c.ratio > 0.5)).toBe(true);
  });

  it("六合绊：化神无月令无透干则只绊不化（寅月子丑合）", () => {
    const { branches, structures } = preprocessInteractions(chart("甲子", "乙寅", "丙丑", "庚寅"), "wood");
    expect(structures.some((s) => s.type === "六合绊")).toBe(true);
    expect(branches[0].conversions).toHaveLength(0);
    expect(branches[0].availability).toBeLessThan(1);
  });

  it("亥卯未三合成局：含月令转化率 70%，且成员支不再参与六合", () => {
    const { branches, structures } = preprocessInteractions(chart("壬亥", "乙卯", "丁未", "甲午"), "wood");
    const trio = structures.find((s) => s.type === "三合");
    expect(trio).toBeDefined();
    expect(trio!.effect).toContain("70%");
    expect(branches[2].conversions.some((c) => c.to === "wood" && c.ratio === 0.7)).toBe(true);
    // 未已入木局，午未六合不再成立
    expect(structures.some((s) => s.type === "六合化" || s.type === "六合绊")).toBe(false);
  });

  it("众冲全额叠加：双申夹冲一寅，伤势累乘（已拍板：不采「双冲不冲」）", () => {
    const { branches } = preprocessInteractions(chart("甲申", "庚申", "甲寅", "庚辰"), "metal");
    // 月申紧贴 ×0.6，年申隔位 ×(1-0.4×0.5)=0.8 → 0.48
    expect(branches[2].availability).toBeCloseTo(0.48, 2);
  });

  it("冲刑同对不叠罚：寅申首论冲，刑降级为叙事标签", () => {
    const { branches, structures } = preprocessInteractions(chart("甲申", "庚申", "甲寅", "庚辰"), "metal");
    const xing = structures.filter((s) => s.type === "三刑");
    expect(xing.length).toBeGreaterThan(0);
    expect(xing.every((s) => s.effect.includes("不另折损"))).toBe(true);
    // 若刑再叠罚，寅应低于 0.48
    expect(branches[2].availability).toBeCloseTo(0.48, 2);
  });

  it("天干五合合绊：丁壬相邻无化条件则互相牵绊", () => {
    const { stems, structures } = preprocessInteractions(chart("丁丑", "壬戌", "庚戌", "辛巳"), "earth");
    expect(structures.some((s) => s.type === "干合绊")).toBe(true);
    expect(stems[0].availability).toBeLessThan(1);
  });
});

describe("黄金用例：身强档", () => {
  it("锚点案（真实历法盘 1954-02-17 亥时）：甲木寅月建禄、比劫并透、印有根、丙火泄秀——教科书身强，扶抑调候同向喜火", () => {
    const result = computeEnergy(chart("甲午", "丙寅", "甲辰", "乙亥"));
    expect(result.dayMaster.level).toBe("身强");
    expect(result.dayMaster.gotSeason).toBe(true);
    expect(result.dayMaster.favorable).toEqual(["fire", "earth", "metal"]);
  });

  it("边界案（用户 2026-07-03 裁定）：壬水申月长生得令、庚印坐禄、双寅食神被冲——身强成立但带泄，非极端案", () => {
    const result = computeEnergy(chart("癸丑", "庚申", "壬寅", "壬寅"));
    expect(result.dayMaster.level).toBe("身强");
    expect(result.dayMaster.favorable).toEqual(["wood", "fire", "earth"]);
    // 注：调候派（申月壬水专用戊土）会以土为先——favorable 顺序不代表重要性，调候留 v2.1
  });
});

describe("黄金用例：从强边界", () => {
  it("炎上候选按实战判身强（用户 2026-07-03 终裁）：会局成员随局论（未随火局不作土论、否决闸放行），但从强线 90% 拦住 89%——趋近从强而未入", () => {
    const result = computeEnergy(chart("癸未", "丁巳", "丙午", "辛卯"));
    expect(result.dayMaster.level).toBe("身强");
    expect(result.dayMaster.score).toBeGreaterThan(80);
    expect(result.dayMaster.score).toBeLessThan(90); // 90 线是最后一道闸
    expect(result.dayMaster.confidence).not.toBe("high"); // 置信区间生效：趋近从强，措辞软化
    expect(result.dayMaster.favorable).toEqual(["earth", "metal", "water"]);
  });


  it("稼穑破格（用户 2026-07-03 裁定）：满盘土但甲官坐卯禄根，异党活本气根否决从强——明显不从，且否决使边界不确定性消失", () => {
    const result = computeEnergy(chart("己卯", "戊辰", "己丑", "甲子"));
    expect(result.dayMaster.level).toBe("身强");
    expect(result.dayMaster.confidence).toBe("high"); // 从强已被硬否决，80% 边界不构成不确定性
  });
});

describe("黄金用例：从弱格", () => {
  it("庚金无根、满盘木火：判从弱，喜财官食伤", () => {
    const result = computeEnergy(chart("丙寅", "甲午", "庚寅", "丁亥"));
    expect(result.dayMaster.rooted).toBe(false);
    expect(result.dayMaster.level).toBe("从弱");
    expect(result.dayMaster.favorable).toContain("wood");
    expect(result.dayMaster.favorable).toContain("fire");
  });

  it("合致从格（用户 2026-07-03 裁定）：壬水未月滴水无源、印星虚浮，午未双合化火卯未半合喂大财党，丁壬合身弃命从财", () => {
    const result = computeEnergy(chart("己卯", "辛未", "壬午", "丁未"));
    expect(result.dayMaster.rooted).toBe(false);
    expect(result.dayMaster.level).toBe("从弱");
    expect(result.dayMaster.favorable).toEqual(["fire", "earth", "wood"]);
  });

  it("冲致从格（真实历法盘 1921-09-19 卯时）：三酉夹冲卯根而拔，乙木无印相救顺势入从弱", () => {
    const result = computeEnergy(chart("辛酉", "丁酉", "乙酉", "己卯"));
    expect(result.dayMaster.rooted).toBe(false); // 根拔不作有根论
    expect(result.dayMaster.level).toBe("从弱");
    expect(result.dayMaster.reasons.join("")).toContain("被冲拔");
  });

  it("印透有根不从（用户 2026-07-03 裁定）：壬水巳月无根、火当令 7.5%，但庚辛双印透干且庚长生于巳——印透通根有救，判身弱不从", () => {
    const result = computeEnergy(chart("庚午", "辛巳", "壬寅", "壬寅"));
    expect(result.dayMaster.rooted).toBe(false);
    expect(result.dayMaster.level).toBe("身弱"); // 印比透干有活根即不从
  });

  it("根拔印救不从：同为双申夹冲拔根，双印透干通根则守住身弱（杀印相生）", () => {
    const result = computeEnergy(chart("癸未", "庚申", "甲寅", "壬申"));
    expect(result.dayMaster.level).toBe("身弱");
    expect(result.dayMaster.favorable).toEqual(["water", "wood"]);
  });
});

describe("输出结构完整性", () => {
  const result = computeEnergy(chart("癸卯", "乙卯", "丁丑", "甲辰"));

  it("elementPower 归一化为 100%", () => {
    const sum = Object.values(result.elementPower).reduce((s, v) => s + v, 0);
    expect(sum).toBeGreaterThan(99.5);
    expect(sum).toBeLessThan(100.5);
  });

  it("trace 可追溯：每笔能量有来源与说明", () => {
    expect(result.trace.length).toBeGreaterThan(8);
    expect(result.trace.every((t) => t.source && t.points >= 0)).toBe(true);
  });

  it("确定性：同输入同输出", () => {
    expect(computeEnergy(chart("癸卯", "乙卯", "丁丑", "甲辰"))).toEqual(result);
  });
});
