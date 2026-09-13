// 三链共用的五步内核：扩词已在调用方完成 → 取材 → 排序 → 模型 → 由调用方回填校验。
// 每步向 SSE 推 step 事件，前端据此显示进度（demo 时的体验分靠这个）。
import { buildSchemaSection } from "../ai/harness";
import { generateWithFallback } from "../ai/fallback";
import { extractAndParse } from "../ai/jsonExtract";
import { BASE_SYSTEM } from "../prompts/base";
import { searchZhihuPoolCached } from "../zhihu/cached";
import { rankItems } from "../zhihu/rank";
import type { ZhihuItem } from "../zhihu/types";
import type { SendFn } from "../ai/types";
import type { OffNavStore } from "../db/types";

export async function runPipeline(args: {
  headers: Record<string, string | null>;
  queries: string[];
  buildPrompt: (pool: ZhihuItem[]) => string;
  schema: any;
  send: SendFn;
  endpoint: string;
  store?: OffNavStore;
  gapMs?: number;
}): Promise<{ raw: any; pool: ZhihuItem[]; cached: boolean }> {
  const { headers, queries, buildPrompt, schema, send, store, gapMs } = args;

  send({ type: "step", name: "search", message: `正在检索知乎（${queries.length} 组关键词）` });
  const found = await searchZhihuPoolCached(queries, { store, gapMs });
  if (found.items.length === 0) {
    const why = found.errors.length > 0 ? `：${found.errors.join("；")}` : "";
    throw new Error(`没有检索到相关内容${why}`);
  }

  send({ type: "step", name: "rank", message: `按权威度整理 ${found.items.length} 篇原文`, count: found.items.length, cached: found.cached });
  const pool = rankItems(found.items);
  send({ type: "pool", items: pool.map((i) => ({ contentId: i.ContentID, title: i.Title, url: i.Url, authorName: i.AuthorName, authorityLevel: Number(i.AuthorityLevel) || 0, voteUpCount: i.VoteUpCount })) });

  send({ type: "step", name: "generate", message: "正在结构化" });
  const gen = await generateWithFallback({
    headers,
    system: BASE_SYSTEM,
    prompt: `${buildPrompt(pool)}\n\n${buildSchemaSection(schema)}`,
  });
  if (gen.degraded) {
    send({ type: "notice", message: "知乎直答今日额度已用尽，本次由备用模型生成" });
  }
  const text = gen.text;

  const raw = extractAndParse(text, schema);
  return { raw, pool, cached: found.cached };
}
