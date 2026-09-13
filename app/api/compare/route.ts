// 问题对照：多方观点按权威度并排 + 共识与分歧。
import { NextRequest } from "next/server";
import { createSSEResponse } from "@/lib/ai/sse";
import { failSSE } from "@/lib/ai/harness";
import { runPipeline } from "@/lib/core/pipeline";
import { expandQuestionQueries } from "@/lib/core/expand";
import { attachEvidence } from "@/lib/core/evidence";
import { CompareSchema } from "@/lib/core/schemas";
import { buildComparePrompt } from "@/lib/prompts/compare";
import { getStore } from "@/lib/db/store";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const input = String(body?.input ?? "").trim();
  if (!input) return Response.json({ error: "缺少 input" }, { status: 400 });

  const queries = expandQuestionQueries(input);
  if (queries.length === 0) return Response.json({ error: "input 无有效内容" }, { status: 400 });

  const headers = {
    "x-provider": req.headers.get("x-provider"),
    "x-api-key": req.headers.get("x-api-key"),
    "x-base-url": req.headers.get("x-base-url"),
    "x-model": req.headers.get("x-model"),
  };

  return createSSEResponse(async (send, end) => {
    try {
      const { raw, pool, cached } = await runPipeline({
        headers, queries, schema: CompareSchema, send, endpoint: "compare",
        buildPrompt: (p) => buildComparePrompt(input, p),
      });

      const v = attachEvidence(raw.views, pool);
      const c = attachEvidence(raw.consensus, pool);
      const d = attachEvidence(raw.divergence, pool);

      const result = {
        kind: "compare",
        question: raw.question || input,
        views: v.kept,
        consensus: c.kept,
        divergence: d.kept,
        poolSize: pool.length,
        dropped: v.dropped + c.dropped + d.dropped,
        cached,
      };

      const id = randomUUID();
      await getStore().putNavResult({ id, userId: null, kind: "compare", input, result, createdAt: Date.now() });

      send({ type: "result", id, result });
      end();
    } catch (e) {
      failSSE(send, end, e as Error, "compare", "question-compare");
    }
  });
}
