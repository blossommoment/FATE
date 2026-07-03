# 双人报告标准化规范

目标：让后端接入的 AI 基于**人格建模数据**（而非八字原文）生成双人报告，做到"大差不差"——同一对人多次生成，**事实与结论完全一致，措辞允许小幅变化**。

## 架构：三层分工

```
规则引擎 (lib/fate.ts)  →  事实清单 (JSON)  →  AI 叙述层
     算分、定性              唯一事实源            只负责把事实写成文
```

- **规则引擎**产出所有判断：分数、判词、行为断语、依恋倾向、摩擦点。八字只是引擎内部的解释来源之一，AI 不接触排盘细节。
- **事实清单**由 `buildRelationshipFacts(a, b, analysis)` 生成（见 `lib/fate.ts` 末尾），是 AI 的唯一输入。
- **AI 叙述层**按固定模板把清单写成报告。它没有权限计算、没有权限下新结论。

## 事实清单结构（buildRelationshipFacts 输出）

```jsonc
{
  "relationType": "恋爱",
  "score": 68,
  "spine": {                       // 2026-07-03 新增：整份报告的论点，各章须回扣
    "thesis": "一段由「表达译码」驱动、被「主导权协商」考验的恋爱",
    "primaryResource": { "key": "expression", "label": "表达译码", "why": "六维最高（82 分）：…" },
    "primaryTension": { "key": "power", "label": "主导权协商", "why": "六维最低（54 分）：…命盘结构上「子午冲」加重此题。" },
    "elementSynergy": { "tone": "oneway", "sides": ["TA最旺的水恰是你的喜用——相处本身对你是补给。", "…"] }
  },
  "verdict": { "title": "相爱相杀", "quip": "…", "tagline": "…", "basis": "…" },
  "persons": [{
    "name": "小雨", "dayPillar": "癸卯", "archetype": "…", "persona": "…",
    "dominantGod": "正印", "attachmentTendency": "偏焦虑型",
    "personality": { "extroversion": 55, "stability": 62, "control": 48, "emotion": 73 },
    "keyScores": { "initiative": 22, "conflictExpression": 30, "vigilance": 26, "dependency": 58, "autonomy": 44, "novelty": 49, "romance": 39, "expressiveness": 41 },
    "identityTags": ["慢热关系", "感受细腻", "重视默契"]
  }, { /* 同结构 */ }],
  "dimensions": [{ "key": "expression", "label": "表达译码", "score": 74, "weight": 16, "summary": "…" }],
  "structures": [{ "type": "冲", "title": "…", "scoreImpact": -3, "summary": "…" }],
  "behaviors": [{ "label": "醋意浓度", "conclusion": "…", "basis": "…" }],
  "dispositions": [{ "person": "阿泽", "trait": "比劫立身，界限分明", "reading": "…", "approach": "…" }],
  "frictions": [{ "scene": "推进速度错位", "risk": "…", "playbook": "…" }],
  "initiator": { "name": "…", "why": "…", "firstMove": "…" },
  "longRun": "…",
  "contract": {                    // 2026-07-03 新增：事实所有权契约
    "ownership": { "spine": "壹·关系总览", "behaviors": "肆·相处样态", "…": "…" },
    "rule": "事实只在主场章节完整展开（结论+依据+数字）；其他章节只可短引名称，不得复述数字与依据；每章开头须回扣 spine 主线。"
  }
}
```

## AI 叙述层的四条铁律（写进 system prompt）

1. **只许转述，不许创作事实**：所有结论、分数、判词必须出自清单；清单里没有的判断一律不得出现。
2. **遵守 contract**：按 ownership 分章展开事实，主场之外只许短引；每章开头回扣 spine.thesis。
3. **每个结论带依据**：叙述任何一条结论时，引用清单中对应的数字或结构名（如"关系警觉 26:69"），依据放在句末括号或从句中，不打断阅读。
4. **语气规范**：
   - 依恋等心理标签一律用"更倾向 / 更接近"，不说死（"偏焦虑型依恋"，而非"是焦虑型"）；
   - 结论落在**互动情景与双方身份**上（谁先发消息、饭桌氛围、冷战谁先破冰），命盘数据退居佐证；
   - 判词部分允许幽默；建议部分书面克制；全文禁止吉凶断言。

## 为什么能"大差不差"

- 事实清单是确定性的（同输入同输出，有测试锁定）；
- 报告章节结构由模板固定（判词 → 样态 → 六维 → 摩擦 → 长线）；
- AI 温度建议 0.4~0.7：措辞有变化，但事实无从漂移——它手里只有这份清单。

## 后端接入姿势

```
POST 你的AI网关
system: <上面的四条铁律 + 章节模板>
user:   请基于以下事实清单撰写双人关系报告：\n<JSON.stringify(buildRelationshipFacts(a, b, analysis))>
```

可选校验层：AI 返回后，用正则抽出文中的所有数字与判词标题，与清单比对，不一致即重试——彻底杜绝幻觉。
