// 岗位导航：SSE 推进度 + 证据链校验后的结果。
import { NextRequest } from "next/server";
import { createSSEResponse } from "@/lib/ai/sse";
import { failSSE } from "@/lib/ai/harness";
import { runPipeline } from "@/lib/core/pipeline";
import { expandJobQueries } from "@/lib/core/expand";
import { attachEvidence } from "@/lib/core/evidence";
import { NavSchema } from "@/lib/core/schemas";
import { buildNavPrompt } from "@/lib/prompts/nav";
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

  const queries = expandJobQueries(input);
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
        headers, queries, schema: NavSchema, send, endpoint: "nav",
        buildPrompt: (p) => buildNavPrompt(input, p),
      });

      // 逐主题回填证据链，核不上来源的考点丢弃。
      let droppedTotal = 0;
      const rounds = raw.rounds.map((r: any) => ({
        round: r.round,
        topics: r.topics
          .map((t: any) => {
            const { kept, dropped } = attachEvidence(t.points, pool);
            droppedTotal += dropped;
            return { topic: t.topic, points: kept };
          })
          .filter((t: any) => t.points.length > 0),
      })).filter((r: any) => r.topics.length > 0);

      const result = { kind: "nav", input, jobSummary: raw.jobSummary, rounds, poolSize: pool.length, dropped: droppedTotal, cached };

      const id = randomUUID();
      await getStore().putNavResult({ id, userId: null, kind: "nav", input, result, createdAt: Date.now() });

      send({ type: "result", id, result });
      end();
    } catch (e) {
      failSSE(send, end, e as Error, "nav", "job-navigation");
    }
  });
}
