// 岗位导航 prompt。素材编号用 ContentID，让模型能在 sourceIds 里回填。
import type { ZhihuItem } from "../zhihu/types";
import { authorityNum } from "../zhihu/rank";
import { wrapUserContent } from "../ai/contentBoundary";

const MAX_POOL_CHARS = 24000;

// 把检索池渲染成带编号的素材清单。总量超限时按序截断（池已按权威度排好）。
export function formatPool(pool: ZhihuItem[], maxChars = MAX_POOL_CHARS): string {
  const blocks: string[] = [];
  let used = 0;
  for (const it of pool) {
    const body = (it.ContentText || "").replace(/\s+/g, " ").trim();
    const head = `[${it.ContentID}] 《${it.Title}》 by ${it.AuthorName} · L${authorityNum(it)} · ${it.VoteUpCount} 赞同 · ${it.CommentCount} 评论`;
    const block = `${head}\n${body}`;
    if (used + block.length > maxChars) break;
    blocks.push(block);
    used += block.length;
  }
  return blocks.join("\n\n---\n\n");
}

export function buildNavPrompt(input: string, pool: ZhihuItem[]): string {
  return `任务：为下面这个求职目标，从知乎素材里整理出一张面试考点地图。

求职目标：${wrapUserContent(input)}

要求：
- 按面试轮次分组（只写素材里真实提到的轮次，素材没提到的轮次不要凭空造）
- 每轮下面按考点主题聚合，每个主题给出具体考点
- 考点要具体到「会被问什么」，不要写成「考察沟通能力」这类抽象标签
- 每条考点的 sourceIds 填写它出自哪几段素材

素材（每段以 [编号] 开头，sourceIds 就填这些编号）：

${formatPool(pool)}`;
}
