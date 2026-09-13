// 权威度加权排序：OffNav 的核心主张——用知乎自己的信号重排内容。
import type { ZhihuItem } from "./types";

// AuthorityLevel 是字符串，非法值归零（不能产生 NaN 污染排序）。
export function authorityNum(item: ZhihuItem): number {
  const n = Number(item.AuthorityLevel);
  return Number.isFinite(n) ? n : 0;
}

// 先权威度降序，同级按赞同数降序。返回新数组，不修改入参。
export function rankItems(items: ZhihuItem[]): ZhihuItem[] {
  return [...items].sort((a, b) => {
    const d = authorityNum(b) - authorityNum(a);
    if (d !== 0) return d;
    return (b.VoteUpCount || 0) - (a.VoteUpCount || 0);
  });
}

// 多关键词合池后去重：优先 ContentID，缺失时回退 Url。保留首次出现。
export function dedupeItems(items: ZhihuItem[]): ZhihuItem[] {
  const seen = new Set<string>();
  const out: ZhihuItem[] = [];
  for (const it of items) {
    const key = it.ContentID || it.Url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

// 证据链卡片里展示的原文摘录。
export function excerpt(text: string, maxLen = 120): string {
  const flat = (text || "").replace(/\s+/g, " ").trim();
  if (flat.length <= maxLen) return flat;
  return flat.slice(0, maxLen) + "…";
}
