const definitions: Record<string, string> = {
  七杀: "七杀是十神之一，描述面对压力、竞争、风险和快速决断时的行为动力。它强不等于凶，而是更容易被挑战激活；是否表现得健康，要看官印、食神等反向信号。",
  正官: "正官偏向秩序、责任、边界与稳定兑现。关系里常表现为重承诺、希望规则清楚，但过强时也可能担心失控。",
  偏印: "偏印偏向独立理解、内部消化和非标准思考。关系中可能先观察、自己推演，再决定是否表达。",
  正印: "正印代表接受支持、稳定照顾和安全感建立。它常让人重视被理解，也更愿意照顾他人的状态。",
  偏财: "偏财代表流动连接、机会感与社交慷慨。关系里可能表现为愿意创造体验、接触新人或主动制造惊喜。",
  正财: "正财代表持续投入、现实兑现和稳定经营。它更像按时出现、记得约定、把喜欢落实到行动。",
  比肩: "比肩代表平等、自主和清晰的自我立场。关系里通常需要被当作独立个体尊重。",
  劫财: "劫财代表同伴参与、竞争与行动联盟。它会增强一起做事的冲劲，也可能放大比较和胜负心。",
  食神: "食神代表温和表达、分享、享受和松弛感。关系中常对应舒服交流与共同体验。",
  伤官: "伤官代表直接表达、质疑和打破惯例。它能带来真诚与创造，也需要注意冲突时的锋利度。",
};

export function explainQuestion(question: string, contextTitle: string, contextSummary: string, evidence: string[]) {
  const term = Object.keys(definitions).find((key) => question.includes(key));
  const evidenceText = evidence.length ? `这张卡实际读取到的依据是：${evidence.join("；")}。` : "";
  if (/进取|野心|上进/.test(question)) return `进取心主要读取七杀的挑战驱动、偏财的机会敏感和伤官的突破倾向。分数高表示遇到目标或难题时更容易被激活，不等于现实成就一定更高。${evidenceText}`;
  if (/新鲜|无聊|厌倦/.test(question)) return `新鲜感需求主要由偏财、伤官、食神与木火能量推动，正官则提供稳定约束。高分表示关系进入重复阶段后，需要共同体验或成长来维持投入，并不等于容易变心。${evidenceText}`;
  if (/猜疑|警觉|多想/.test(question)) return `这里分析的是关系警觉，不是病理性猜疑。偏印提高独立推演，七杀提高风险扫描，水元素增强细微信号感知；食神会提供更松弛的解释，因此作为反向信号。${evidenceText}`;
  if (/为什么|依据|怎么算|逻辑/.test(question)) return `${contextSummary} ${evidenceText}系统先按月令、时柱、日柱、年柱区分位置，再按地支本气、天干、中气、余气分层加权；最后加入五行修正并检查反向信号。`;
  if (term) return `${definitions[term]} ${evidenceText}`;
  return `「${contextTitle}」的结论不是单看一个字，而是组合显性天干、藏干十神和五行修正。${contextSummary} ${evidenceText}`;
}
