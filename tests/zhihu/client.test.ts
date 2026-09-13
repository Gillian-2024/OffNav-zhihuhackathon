import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchZhihu, searchZhihuPool } from "@/lib/zhihu/client";

const okBody = (n: number) => ({
  Code: 0,
  Message: "success",
  Data: {
    Items: Array.from({ length: n }, (_, i) => ({
      Title: `t${i}`, ContentType: "Answer", ContentID: `id${i}`, ContentText: "body",
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

describe("searchZhihu", () => {
  it("带上 Bearer 与时间戳请求头", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(okBody(2)), { status: 200 })
    );
    await searchZhihu("字节 产品经理");
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/content/zhihu_search");
    expect(url).toContain("Query=");
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer test-secret");
    expect(Number(h["X-Request-Timestamp"])).toBeGreaterThan(1700000000);
  });

  it("Count 超过 10 时收敛到 10", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(okBody(10)), { status: 200 })
    );
    await searchZhihu("q", 50);
    expect(spy.mock.calls[0][0]).toContain("Count=10");
  });

  it("业务错误码记进 errors 而不抛出", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ Code: 30001, Message: "rate limit exceeded" }), { status: 200 })
    );
    const r = await searchZhihu("q");
    expect(r.items).toEqual([]);
    expect(r.errors[0]).toContain("30001");
  });

  it("缺少 ZHIHU_ACCESS_SECRET 时抛错", async () => {
    delete process.env.ZHIHU_ACCESS_SECRET;
    await expect(searchZhihu("q")).rejects.toThrow(/ZHIHU_ACCESS_SECRET/);
  });
});

describe("searchZhihuPool", () => {
  it("串行发送并合池去重", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 5));
      concurrent -= 1;
      return new Response(JSON.stringify(okBody(3)), { status: 200 });
    });
    const r = await searchZhihuPool(["q1", "q2", "q3"], { gapMs: 0 });
    // 三个查询返回相同 ContentID → 去重后仍是 3 条
    expect(r.items).toHaveLength(3);
    // 关键断言：绝不并发（实测并发会被限流打掉）
    expect(maxConcurrent).toBe(1);
  });

  it("单个查询失败不影响其余", async () => {
    let call = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      call += 1;
      if (call === 1) return new Response(JSON.stringify({ Code: 30001, Message: "rate limit exceeded" }), { status: 200 });
      return new Response(JSON.stringify(okBody(2)), { status: 200 });
    });
    const r = await searchZhihuPool(["a", "b"], { gapMs: 0 });
    expect(r.items).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
  });
});
