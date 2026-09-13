// 关键词扩展：单次搜索上限 10 条且无分页，靠多组关键词串行取材扩大内容池。
// 实测：5 组关键词去重后 19 条唯一，重复率仅 5%——扩展确实有效。
const JOB_ASPECTS = ["面经", "一面 二面", "笔试 真题", "终面 HR面", "准备 攻略"];
const QUESTION_ASPECTS = ["怎么回答", "面试官视角", "案例 实例"];

function clean(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

// 岗位导航：原词 + 各面试环节维度。
export function expandJobQueries(input: string): string[] {
  const base = clean(input);
  if (!base) return [];
  const out = JOB_ASPECTS.map((a) => `${base} ${a}`);
  return [...new Set(out)].slice(0, 5);
}

// 问题对照：原问题优先（保证命中原始意图），再加视角维度。
export function expandQuestionQueries(input: string): string[] {
  const base = clean(input);
  if (!base) return [];
  const out = [base, ...QUESTION_ASPECTS.map((a) => `${base} ${a}`)];
  return [...new Set(out)].slice(0, 5);
}

// 背景匹配：拿简历抽出的标签两两组合，附上求职语境。
export function expandProfileQueries(tags: string[]): string[] {
  const valid = tags.map(clean).filter(Boolean);
  if (valid.length === 0) return [];
  const out: string[] = [];
  for (const t of valid.slice(0, 3)) {
    out.push(`${t} 校招 求职`);
    out.push(`${t} 面经`);
  }
  return [...new Set(out)].slice(0, 5);
}
