// 搜索缓存包装。缓存不是优化项而是跑得起来的前提——
// 官方要求应用层缓存，且并发限流严格，demo 现场靠缓存兜住反复点击。
import { createHash } from "node:crypto";
import type { SearchResult } from "./types";
import { searchZhihuPool } from "./client";
import { getStore } from "../db/store";
import type { OffNavStore } from "../db/types";

const DEFAULT_TTL_MS = 24 * 3600000;

// 顺序无关：同一组关键词无论顺序都命中同一缓存。
// 已知可接受的权衡：排序后用空格拼接，["a b","c"] 和 ["a","b c"] 会碰撞成同一 hash
// （都拼成 "a b c"）。求职关键词场景短且罕见此类边界，接受不修。
export function hashQueries(queries: string[]): string {
  const norm = [...queries].map((q) => q.trim()).sort().join(" ");
  return createHash("sha256").update(norm).digest("hex").slice(0, 32);
}

export async function searchZhihuPoolCached(
  queries: string[],
  opts: { store?: OffNavStore; count?: number; gapMs?: number; ttlMs?: number } = {}
): Promise<SearchResult & { cached: boolean }> {
  const { store = getStore(), count, gapMs, ttlMs = DEFAULT_TTL_MS } = opts;
  const hash = hashQueries(queries);

  const hit = await store.getCachedSearch(hash);
  if (hit && Date.now() - hit.fetchedAt < ttlMs) {
    return { ...hit.payload, cached: true };
  }

  const fresh = await searchZhihuPool(queries, { count, gapMs });

  // 一条都没取到就不写缓存，否则把限流错误固化 24 小时。
  if (fresh.items.length > 0) {
    await store.putCachedSearch({
      queryHash: hash,
      query: queries.join(" | "),
      payload: fresh,
      fetchedAt: Date.now(),
    });
  }

  return { ...fresh, cached: false };
}
