import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryStore } from "@/lib/db/memory";
import type { OffNavStore } from "@/lib/db/types";

let store: OffNavStore;

beforeEach(() => {
  store = createMemoryStore();
});

describe("搜索缓存", () => {
  it("未命中返回 null", async () => {
    expect(await store.getCachedSearch("nope")).toBeNull();
  });

  it("写入后可读回", async () => {
    await store.putCachedSearch({
      queryHash: "h1", query: "q",
      payload: { items: [], errors: [] }, fetchedAt: Date.now(),
    });
    expect((await store.getCachedSearch("h1"))?.query).toBe("q");
  });

  it("同 hash 重复写入覆盖而非重复", async () => {
    await store.putCachedSearch({ queryHash: "h", query: "old", payload: { items: [], errors: [] }, fetchedAt: 1 });
    await store.putCachedSearch({ queryHash: "h", query: "new", payload: { items: [], errors: [] }, fetchedAt: 2 });
    expect((await store.getCachedSearch("h"))?.query).toBe("new");
  });
});

describe("OAuth state 单次消费", () => {
  it("首次消费成功，第二次返回 null", async () => {
    await store.putOAuthState({ state: "s1", sessionHint: "sess", expiresAt: Date.now() + 60000 });
    expect(await store.consumeOAuthState("s1")).not.toBeNull();
    expect(await store.consumeOAuthState("s1")).toBeNull();
  });

  it("过期的 state 消费失败", async () => {
    await store.putOAuthState({ state: "s2", sessionHint: "sess", expiresAt: Date.now() - 1 });
    expect(await store.consumeOAuthState("s2")).toBeNull();
  });

  it("不存在的 state 返回 null", async () => {
    expect(await store.consumeOAuthState("ghost")).toBeNull();
  });
});

describe("会话", () => {
  it("创建后可读回，删除后读不到", async () => {
    await store.createSession({ id: "sid", userId: "u1", oauthToken: "tok", expiresAt: Date.now() + 60000 });
    expect((await store.getSession("sid"))?.userId).toBe("u1");
    await store.deleteSession("sid");
    expect(await store.getSession("sid")).toBeNull();
  });

  it("过期会话读不到", async () => {
    await store.createSession({ id: "old", userId: "u", oauthToken: "t", expiresAt: Date.now() - 1 });
    expect(await store.getSession("old")).toBeNull();
  });
});

describe("用户 upsert", () => {
  it("zhihu_uid 以字符串存储（int64 不可用 Number）", async () => {
    const uid = "969570047710216200";
    const u = await store.upsertUser({ zhihuUid: uid, hashId: "h", fullname: "n", avatar: "" });
    expect(u.zhihuUid).toBe(uid);
    expect(typeof u.zhihuUid).toBe("string");
  });

  it("同 uid 二次 upsert 返回同一 id 并更新字段", async () => {
    const a = await store.upsertUser({ zhihuUid: "1", hashId: "h", fullname: "n1", avatar: "" });
    const b = await store.upsertUser({ zhihuUid: "1", hashId: "h", fullname: "n2", avatar: "" });
    expect(b.id).toBe(a.id);
    expect(b.fullname).toBe("n2");
  });
});

describe("分析结果", () => {
  it("存取往返", async () => {
    await store.putNavResult({
      id: "r1", userId: null, kind: "nav",
      input: "字节 PM", result: { ok: 1 }, createdAt: Date.now(),
    });
    const got = await store.getNavResult("r1");
    expect(got?.kind).toBe("nav");
    expect(got?.result).toEqual({ ok: 1 });
  });
});
