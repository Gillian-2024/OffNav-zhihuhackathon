// 回调路由的 state 契约测试：state 缺失时放行登录，state 错误时仍必须拒绝。
// 依据：zhihu-hackathon skill 的 oauth-boundary.md / oauth-introduction.md ——
// 实测回调可能不返回 state，没有 PKCE/CSRF 保障；但"错误"的 state 不能被放行。
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as callbackGET } from "@/app/auth/callback/route";
import { GET as legacyCallbackGET } from "@/app/api/auth/zhihu/callback/route";
import { getStore, resetStoreForTests } from "@/lib/db/store";

beforeEach(() => {
  process.env.ZHIHU_OAUTH_APP_ID = "app-123";
  process.env.ZHIHU_OAUTH_APP_KEY = "key-456";
  process.env.ZHIHU_OAUTH_REDIRECT_URI = "https://offnav.example.com/auth/callback";
  delete process.env.CLOUDBASE_SERVER_API_KEY;
  delete process.env.CLOUDBASE_API_BASE;
  resetStoreForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetStoreForTests();
});

function mockTokenAndUser() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any) => {
    const url = String(input);
    if (url.includes("access_token")) {
      return new Response(JSON.stringify({ access_token: "tok-1" }), { status: 200 });
    }
    if (url.includes("/user")) {
      return new Response(
        JSON.stringify({ uid: 123, hash_id: "h1", fullname: "张三", avatar_path: "https://pic/a.jpg" }),
        { status: 200 }
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

describe("auth/callback：state 缺失时放行，错误 state 仍拒绝", () => {
  it("state 缺失时正常登录（已知协议缺口：回调可能不返回 state）", async () => {
    mockTokenAndUser();
    const req = new NextRequest("https://offnav.example.com/auth/callback?authorization_code=code-1");
    const res = await callbackGET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("login=ok");
    expect(res.headers.get("set-cookie")).toContain("offnav_session=");
  });

  it("state 存在但不匹配已存 hint 时仍拒绝（不能借口缺失分支放行错误 state）", async () => {
    mockTokenAndUser();
    await getStore().putOAuthState({ state: "st-1", sessionHint: "sess-abc", expiresAt: Date.now() + 60000 });
    const req = new NextRequest("https://offnav.example.com/auth/callback?authorization_code=code-1&state=st-1", {
      headers: { cookie: "offnav_hint=sess-xyz" },
    });
    const res = await callbackGET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("login_error");
  });

  it("state 存在且匹配时正常登录，且是单次消费", async () => {
    mockTokenAndUser();
    await getStore().putOAuthState({ state: "st-2", sessionHint: "sess-abc", expiresAt: Date.now() + 60000 });
    const req = new NextRequest("https://offnav.example.com/auth/callback?authorization_code=code-1&state=st-2", {
      headers: { cookie: "offnav_hint=sess-abc" },
    });
    const res = await callbackGET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("login=ok");

    // 单次消费：同一个 state 不能再用。
    expect(await getStore().consumeOAuthState("st-2")).toBeNull();
  });

  it("state 已过期/已消费时拒绝", async () => {
    mockTokenAndUser();
    await getStore().putOAuthState({ state: "st-3", sessionHint: "sess-abc", expiresAt: Date.now() - 1 });
    const req = new NextRequest("https://offnav.example.com/auth/callback?authorization_code=code-1&state=st-3", {
      headers: { cookie: "offnav_hint=sess-abc" },
    });
    const res = await callbackGET(req);
    expect(res.headers.get("location")).toContain("login_error");
  });

  it("接受 code 参数名（兼容旧协议），不要求必须是 authorization_code", async () => {
    mockTokenAndUser();
    const req = new NextRequest("https://offnav.example.com/auth/callback?code=code-1");
    const res = await callbackGET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("login=ok");
  });

  it("缺少 code 和 authorization_code 时拒绝", async () => {
    const req = new NextRequest("https://offnav.example.com/auth/callback");
    const res = await callbackGET(req);
    expect(res.headers.get("location")).toContain("login_error");
  });
});

describe("旧路径 /api/auth/zhihu/callback：兼容重定向", () => {
  it("302 转发到 /auth/callback，保留全部 query 参数", async () => {
    const req = new NextRequest(
      "https://offnav.example.com/api/auth/zhihu/callback?authorization_code=code-1&state=st-9"
    );
    const res = await legacyCallbackGET(req);
    expect(res.status).toBe(302);
    const loc = res.headers.get("location")!;
    expect(loc).toContain("/auth/callback");
    expect(loc).toContain("authorization_code=code-1");
    expect(loc).toContain("state=st-9");
  });
});
