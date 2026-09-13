// 背景匹配：先用输入文本扩词取材，再把差距翻译成阅读清单。
import { NextRequest } from "next/server";
import { createSSEResponse } from "@/lib/ai/sse";
import { failSSE } from "@/lib/ai/harness";
import { runPipeline } from "@/lib/core/pipeline";
import { expandProfileQueries } from "@/lib/core/expand";
import { attachEvidence } from "@/lib/core/evidence";
import { MatchSchema } from "@/lib/core/schemas";
import { buildMatchPrompt } from "@/lib/prompts/match";
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

  const profileText = String(body?.profileText ?? "").trim();
  const target = String(body?.target ?? "").trim();
  if (!profileText) return Response.json({ error: "缺少 profileText" }, { status: 400 });

  // 取材关键词：目标岗位优先，附加背景里的显式关键词。
  const seeds = [target, ...profileText.split(/[\s,，、；;]+/).filter((w) => w.length >= 2).slice(0, 4)].filter(Boolean);
  const queries = expandProfileQueries(seeds);
  if (queries.length === 0) return Response.json({ error: "无法从输入提取检索词" }, { status: 400 });

  const headers = {
    "x-provider": req.headers.get("x-provider"),
    "x-api-key": req.headers.get("x-api-key"),
    "x-base-url": req.headers.get("x-base-url"),
    "x-model": req.headers.get("x-model"),
  };

  return createSSEResponse(async (send, end) => {
    try {
      const { raw, pool, cached } = await runPipeline({
        headers, queries, schema: MatchSchema, send, endpoint: "match",
        buildPrompt: (p) => buildMatchPrompt(target ? `目标岗位：${target}\n\n${profileText}` : profileText, p),
      });

      let droppedTotal = 0;
      const gaps = raw.gaps
        .map((g: any) => {
          const { kept, dropped } = attachEvidence(g.points, pool);
          droppedTotal += dropped;
          return { gap: g.gap, why: g.why, points: kept };
        })
        .filter((g: any) => g.points.length > 0);

      const result = {
        kind: "match",
        target,
        profileSummary: raw.profileSummary,
        tags: raw.tags,
        gaps,
        poolSize: pool.length,
        dropped: droppedTotal,
        cached,
      };

      const id = randomUUID();
      await getStore().putNavResult({ id, userId: null, kind: "match", input: profileText.slice(0, 200), result, createdAt: Date.now() });

      send({ type: "result", id, result });
      end();
    } catch (e) {
      failSSE(send, end, e as Error, "match", "profile-match");
    }
  });
}
