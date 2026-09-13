// 知乎开放平台搜索客户端。
// ⚠️ 实测约束：并发请求会被限流（5 并发中 3 个返回 Code=30001），
//    所以多关键词取材必须串行 + 间隔。日额度 5000 不是瓶颈，瞬时频率才是。
import type { ZhihuItem, SearchResult } from "./types";
import { dedupeItems } from "./rank";

const BASE = "https://developer.zhihu.com";
const MAX_COUNT = 10; // 实测上限，无分页
const DEFAULT_GAP_MS = 400;

function authHeaders(): Record<string, string> {
  const secret = process.env.ZHIHU_ACCESS_SECRET;
  if (!secret) throw new Error("缺少 ZHIHU_ACCESS_SECRET，请配置环境变量");
  return {
    Authorization: `Bearer ${secret}`,
    "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
    Accept: "application/json",
  };
}

// 单次搜索。业务错误不抛出，收进 errors 让上层决定——
// 单个关键词失败不该让整次导航失败。
export async function searchZhihu(query: string, count = MAX_COUNT): Promise<SearchResult> {
  const headers = authHeaders();
  const n = Math.min(Math.max(1, count), MAX_COUNT);
  const url = `${BASE}/api/v1/content/zhihu_search?Query=${encodeURIComponent(query)}&Count=${n}`;

  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store" });
  } catch (e) {
    return { items: [], errors: [`[${query}] 网络失败: ${(e as Error).message}`] };
  }

  if (!res.ok) {
    return { items: [], errors: [`[${query}] HTTP ${res.status}`] };
    }

  let body: any;
  try {
    body = await res.json();
  } catch {
    return { items: [], errors: [`[${query}] 响应不是合法 JSON`] };
  }

  if (body?.Code !== 0) {
    return { items: [], errors: [`[${query}] Code=${body?.Code} ${body?.Message ?? ""}`.trim()] };
  }

  const items: ZhihuItem[] = Array.isArray(body?.Data?.Items) ? body.Data.Items : [];
  return { items, errors: [] };
}

// 多关键词串行取材并合池去重——突破单次 10 条上限的正解。
// gapMs 为两次请求之间的间隔，默认 400ms 规避限流。
export async function searchZhihuPool(
  queries: string[],
  opts: { count?: number; gapMs?: number } = {}
): Promise<SearchResult> {
  const { count = MAX_COUNT, gapMs = DEFAULT_GAP_MS } = opts;
  const all: ZhihuItem[] = [];
  const errors: string[] = [];

  for (let i = 0; i < queries.length; i++) {
    const r = await searchZhihu(queries[i], count);
    all.push(...r.items);
    errors.push(...r.errors);
    if (gapMs > 0 && i < queries.length - 1) {
      await new Promise((r) => setTimeout(r, gapMs));
    }
  }

  return { items: dedupeItems(all), errors };
}
