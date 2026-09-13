// 证据链回填校验——OffNav 的反编造闸口。
// AI 每条结论必须带 sourceIds；服务端逐条核对是否真在检索池里，
// 核不上的直接丢弃。这不是校验用户输入，是校验模型输出。
import type { ZhihuItem } from "../zhihu/types";
import { authorityNum, excerpt } from "../zhihu/rank";

export type EvidenceCard = {
  title: string;
  url: string;
  authorName: string;
  authorityLevel: number;
  voteUpCount: number;
  commentCount: number;
  excerpt: string;
};

export type VerifiedPoint<T> = T & { evidence: EvidenceCard[] };

export function toEvidenceCard(item: ZhihuItem): EvidenceCard {
  return {
    title: item.Title || "",
    url: item.Url || "",
    authorName: item.AuthorName || "",
    authorityLevel: authorityNum(item),
    voteUpCount: item.VoteUpCount || 0,
    commentCount: item.CommentCount || 0,
    excerpt: excerpt(item.ContentText || ""),
  };
}

// 把 sourceIds 换成真实证据卡；一条都换不出来的结论丢弃。
export function attachEvidence<T extends { sourceIds: string[] }>(
  points: T[],
  pool: ZhihuItem[]
): { kept: VerifiedPoint<Omit<T, "sourceIds">>[]; dropped: number } {
  const index = new Map<string, ZhihuItem>();
  for (const it of pool) {
    if (it.ContentID) index.set(it.ContentID, it);
    if (it.Url) index.set(it.Url, it);
  }

  const kept: VerifiedPoint<Omit<T, "sourceIds">>[] = [];
  let dropped = 0;

  for (const p of points) {
    const ids = Array.isArray(p.sourceIds) ? [...new Set(p.sourceIds)] : [];
    const cards = ids
      .map((id) => index.get(id))
      .filter((it): it is ZhihuItem => Boolean(it))
      .map(toEvidenceCard)
      .sort((a, b) => b.authorityLevel - a.authorityLevel || b.voteUpCount - a.voteUpCount);

    if (cards.length === 0) {
      dropped += 1;
      continue;
    }

    const { sourceIds: _omit, ...rest } = p;
    kept.push({ ...(rest as Omit<T, "sourceIds">), evidence: cards });
  }

  return { kept, dropped };
}
