// 三条分析链的输出 schema。每个 point 都强制 sourceIds——
// 这是让模型必须交出引用来源的语法约束，配合 evidence.ts 的运行时校验。
import { z } from "zod";

const SourcedPoint = z.object({
  text: z.string().describe("一条结论，一句话说清，不超过 60 字"),
  sourceIds: z.array(z.string()).describe("这条结论引用的来源 ContentID，必须来自给定素材，至少一个"),
});

export const NavSchema = z.object({
  jobSummary: z.string().describe("这个岗位面试的整体特点，两三句"),
  rounds: z.array(
    z.object({
      round: z.string().describe("面试轮次名，如 一面、二面、终面、HR面"),
      topics: z.array(
        z.object({
          topic: z.string().describe("考点主题，如 指标设计、项目深挖"),
          points: z.array(SourcedPoint).describe("该主题下的具体考点"),
        })
      ),
    })
  ),
});

export const CompareSchema = z.object({
  question: z.string().describe("被对照的问题，原样回显"),
  views: z.array(
    z.object({
      stance: z.string().describe("该来源的核心观点，一句话"),
      detail: z.string().describe("观点展开，不超过 120 字"),
      sourceIds: z.array(z.string()).describe("该观点的来源 ContentID，至少一个"),
    })
  ),
  consensus: z.array(SourcedPoint).describe("三个以上来源都提到的共识点"),
  divergence: z.array(SourcedPoint).describe("来源之间互相矛盾的点"),
});

export const MatchSchema = z.object({
  profileSummary: z.string().describe("对候选人背景的概括，两三句"),
  tags: z.array(z.string()).describe("从背景抽出的标签，如 计算机专业、字节实习、推荐算法"),
  gaps: z.array(
    z.object({
      gap: z.string().describe("相对目标岗位缺什么"),
      why: z.string().describe("为什么这是差距，不超过 80 字"),
      points: z.array(SourcedPoint).describe("针对这个差距该看的内容"),
    })
  ),
});

export type NavRaw = z.infer<typeof NavSchema>;
export type CompareRaw = z.infer<typeof CompareSchema>;
export type MatchRaw = z.infer<typeof MatchSchema>;
