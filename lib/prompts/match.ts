// 背景匹配 prompt。产出物不是「评估你」，是把差距翻译成具体的知乎阅读清单。
import type { ZhihuItem } from "../zhihu/types";
import { wrapUserContent } from "../ai/contentBoundary";
import { formatPool } from "./nav";

export function buildMatchPrompt(profileText: string, pool: ZhihuItem[]): string {
  return `任务：读候选人背景，指出相对求职目标的差距，并为每个差距给出该看的知乎内容。

候选人背景：${wrapUserContent(profileText)}

要求：
- tags：从背景里抽出关键标签（学校层次、专业、实习、项目方向等），只抽背景里写了的
- gaps：每条差距必须能从素材里找到依据——素材提到某项要求而背景里没有，才算差距
- 不要给出素材里没依据的建议，不要写励志话
- 每条 points 的 sourceIds 填写依据来自哪几段素材

素材（每段以 [编号] 开头，sourceIds 就填这些编号）：

${formatPool(pool)}`;
}
