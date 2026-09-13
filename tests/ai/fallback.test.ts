import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isQuotaError } from "@/lib/ai/fallback";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("ZHIHU_ACCESS_SECRET", "zhihu-key");
  vi.stubEnv("ZHIPU_API_KEY", "zhipu-key");
  vi.stubEnv("ZHIPU_MODEL", "glm-5.2");
  vi.stubEnv("DEFAULT_PROVIDER", "zhihu");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("isQuotaError", () => {
  it("认得知乎额度码 30001 与 30002", () => {
    expect(isQuotaError(new Error('{"Code":30001,"Message":"rate limit exceeded"}'))).toBe(true);
    expect(isQuotaError(new Error('{"Code":30002}'))).toBe(true);
  });

  it("认得 HTTP 429", () => {
    expect(isQuotaError(new Error("Request failed with status 429"))).toBe(true);
  });

  it("不把普通错误当成额度错误", () => {
    expect(isQuotaError(new Error("connect ECONNREFUSED"))).toBe(false);
    expect(isQuotaError(new Error("Schema 校验失败"))).toBe(false);
  });
});

describe("generateWithFallback", () => {
  it("直答成功时不降级", async () => {
    vi.doMock("ai", () => ({ generateText: async () => ({ text: "ok" }) }));
    const { generateWithFallback: run } = await import("@/lib/ai/fallback");
    const r = await run({ headers: {}, system: "s", prompt: "p" });
    expect(r.degraded).toBe(false);
    expect(r.provider).toBe("zhihu");
    expect(r.text).toBe("ok");
  });

  it("直答撞额度时降级到 zhipu 并标记 degraded", async () => {
    let call = 0;
    vi.doMock("ai", () => ({
      generateText: async () => {
        call += 1;
        if (call === 1) throw new Error('{"Code":30002,"Message":"quota exceeded"}');
        return { text: "backup-ok" };
      },
    }));
    const { generateWithFallback: run } = await import("@/lib/ai/fallback");
    const r = await run({ headers: {}, system: "s", prompt: "p" });
    expect(call).toBe(2);
    expect(r.degraded).toBe(true);
    expect(r.provider).toBe("zhipu");
    expect(r.text).toBe("backup-ok");
  });

  it("非额度错误直接抛出，不掩盖真问题", async () => {
    let call = 0;
    vi.doMock("ai", () => ({
      generateText: async () => {
        call += 1;
        throw new Error("connect ECONNREFUSED");
      },
    }));
    const { generateWithFallback: run } = await import("@/lib/ai/fallback");
    await expect(run({ headers: {}, system: "s", prompt: "p" })).rejects.toThrow(/ECONNREFUSED/);
    expect(call).toBe(1);
  });

  it("已经是 zhipu 时不再降级（避免自我重试）", async () => {
    let call = 0;
    vi.doMock("ai", () => ({
      generateText: async () => {
        call += 1;
        throw new Error('{"Code":30001}');
      },
    }));
    const { generateWithFallback: run } = await import("@/lib/ai/fallback");
    await expect(run({ headers: { "x-provider": "zhipu" }, system: "s", prompt: "p" })).rejects.toThrow();
    expect(call).toBe(1);
  });
});
