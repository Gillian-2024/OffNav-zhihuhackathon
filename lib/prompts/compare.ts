// 问题对照 prompt。有意不做 AI 立场分析，只按来源分列观点 + 抽共识与分歧。
import type { ZhihuItem } from "../zhihu/types";
import { wrapUserContent } from "../ai/contentBoundary";
import { formatPool } from "./nav";

export function buildComparePrompt(input: string, pool: ZhihuItem[]): string {
  return `任务：把下面这个问题在知乎上的多方说法整理成对照。

问题：${wrapUserContent(input)}

要求：
- views：按素材来源分列观点，一段素材一条（素材没有明确观点的跳过，不要凑数）
- consensus：三段以上素材都提到的说法才算共识；不足三段就留空数组
- divergence：素材之间互相矛盾的点，如实列出，不要调和
- 每条都要填 sourceIds

素材（每段以 [编号] 开头，sourceIds 就填这些编号）：

${formatPool(pool)}`;
}
