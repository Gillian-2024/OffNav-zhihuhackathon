import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import type { ZhihuItem } from "@/lib/zhihu/types";
import { createMemoryStore } from "@/lib/db/memory";

const Schema = z.object({
  points: z.array(z.object({ text: z.string(), sourceIds: z.array(z.string()) })),
});

const okBody = (ids: string[]) => ({
  Code: 0,
  Message: "success",
  Data: {
    Items: ids.map((id) => ({
      Title: `标题${id}`, ContentType: "Answer", ContentID: id, ContentText: "正文",
      Url: `https://www.zhihu.com/answer/${id}`, AuthorName: "作者", AuthorSignature: "",
      AuthorAvatar: "", AuthorBadge: "", AuthorBadgeText: "", CommentCount: 1,
      VoteUpCount: 10, EditTime: 0, AuthorityLevel: "3", RankingScore: 1,
    })),
  },
});

beforeEach(() => {
  process.env.ZHIHU_ACCESS_SECRET = "test-secret";
  process.env.DEFAULT_PROVIDER = "claude";
  process.env.ANTHROPIC_AUTH_TOKEN = "test-key";
  process.env.ANTHROPIC_MODEL = "claude-sonnet-5";
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("runPipeline", () => {
  it("推送 step 进度事件，顺序为 search → rank → generate", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(okBody(["a"])), { status: 200 }));
    vi.doMock("ai", () => ({
      generateText: async () => ({ text: JSON.stringify({ points: [{ text: "t", sourceIds: ["a"] }] }) }),
    }));
    const { runPipeline: run } = await import("@/lib/core/pipeline");

    const events: any[] = [];
    await run({
      headers: {},
      queries: ["q"],
      buildPrompt: () => "prompt",
      schema: Schema,
      send: (d) => events.push(d),
      endpoint: "test",
      store: createMemoryStore(),
      gapMs: 0,
    });

    const steps = events.filter((e) => e.type === "step").map((e) => e.name);
    expect(steps).toEqual(["search", "rank", "generate"]);
  });

  it("检索池为空时抛错并说明原因", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ Code: 30001, Message: "rate limit exceeded" }), { status: 200 })
    );
    const { runPipeline: run } = await import("@/lib/core/pipeline");
    await expect(
      run({
        headers: {},
        queries: ["q"],
        buildPrompt: () => "p",
        schema: Schema,
        send: () => {},
        endpoint: "test",
        store: createMemoryStore(),
        gapMs: 0,
      })
    ).rejects.toThrow(/没有检索到/);
  });

  it("送进 buildPrompt 的池已按权威度降序", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          Code: 0,
          Message: "success",
          Data: {
            Items: [
              { ...okBody(["low"]).Data.Items[0], ContentID: "low", AuthorityLevel: "1" },
              { ...okBody(["high"]).Data.Items[0], ContentID: "high", AuthorityLevel: "4" },
            ],
          },
        }),
        { status: 200 }
      )
    );
    vi.doMock("ai", () => ({
      generateText: async () => ({ text: JSON.stringify({ points: [] }) }),
    }));
    const { runPipeline: run } = await import("@/lib/core/pipeline");

    let seen: ZhihuItem[] = [];
    await run({
      headers: {},
      queries: ["q"],
      buildPrompt: (pool) => {
        seen = pool;
        return "p";
      },
      schema: Schema,
      send: () => {},
      endpoint: "test",
      store: createMemoryStore(),
      gapMs: 0,
    });
    expect(seen[0].ContentID).toBe("high");
  });
});
