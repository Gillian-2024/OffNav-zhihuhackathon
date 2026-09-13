import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hashQueries, searchZhihuPoolCached } from "@/lib/zhihu/cached";
import { createMemoryStore } from "@/lib/db/memory";

const okBody = (n: number) => ({
  Code: 0,
  Message: "success",
  Data: {
    Items: Array.from({ length: n }, (_, i) => ({
      Title: `t${i}`, ContentType: "Answer", ContentID: `id${i}`, ContentText: "b",
      Url: `https://www.zhihu.com/answer/${i}`, AuthorName: "a", AuthorSignature: "",
      AuthorAvatar: "", AuthorBadge: "", AuthorBadgeText: "", CommentCount: 0,
      VoteUpCount: 0, EditTime: 0, AuthorityLevel: "3", RankingScore: 1,
    })),
  },
});

beforeEach(() => {
  process.env.ZHIHU_ACCESS_SECRET = "test-secret";
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("hashQueries", () => {
  it("同一组查询顺序不同产生同一 hash", () => {
    expect(hashQueries(["a", "b"])).toBe(hashQueries(["b", "a"]));
  });

  it("不同查询组产生不同 hash", () => {
    expect(hashQueries(["a"])).not.toBe(hashQueries(["b"]));
  });
});

describe("searchZhihuPoolCached", () => {
  it("首次未命中则请求并写缓存", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(okBody(3)), { status: 200 })
    );
    const store = createMemoryStore();
    const r = await searchZhihuPoolCached(["q"], { store, gapMs: 0 });
    expect(r.cached).toBe(false);
    expect(r.items).toHaveLength(3);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await store.getCachedSearch(hashQueries(["q"]))).not.toBeNull();
  });

  it("二次调用命中缓存，不再发请求", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(okBody(3)), { status: 200 })
    );
    const store = createMemoryStore();
    await searchZhihuPoolCached(["q"], { store, gapMs: 0 });
    const r2 = await searchZhihuPoolCached(["q"], { store, gapMs: 0 });
    expect(r2.cached).toBe(true);
    expect(r2.items).toHaveLength(3);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("缓存超过 ttl 则重新请求", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(okBody(2)), { status: 200 })
    );
    const store = createMemoryStore();
    await store.putCachedSearch({
      queryHash: hashQueries(["q"]),
      query: "q",
      payload: { items: [], errors: [] },
      fetchedAt: Date.now() - 48 * 3600000,
    });
    const r = await searchZhihuPoolCached(["q"], { store, gapMs: 0, ttlMs: 24 * 3600000 });
    expect(r.cached).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("全部查询都失败时不写缓存，避免把错误固化 24 小时", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ Code: 30001, Message: "rate limit exceeded" }), { status: 200 })
    );
    const store = createMemoryStore();
    const r = await searchZhihuPoolCached(["q"], { store, gapMs: 0 });
    expect(r.items).toHaveLength(0);
    expect(await store.getCachedSearch(hashQueries(["q"]))).toBeNull();
  });
});
