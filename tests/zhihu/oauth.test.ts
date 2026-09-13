import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildAuthorizeUrl, exchangeCodeForToken, fetchZhihuUser, parseUidLossless } from "@/lib/zhihu/oauth";

beforeEach(() => {
  process.env.ZHIHU_OAUTH_APP_ID = "app-123";
  process.env.ZHIHU_OAUTH_APP_KEY = "key-456";
  process.env.ZHIHU_OAUTH_REDIRECT_URI = "https://offnav.example.com/api/auth/zhihu/callback";
});
afterEach(() => vi.restoreAllMocks());

describe("buildAuthorizeUrl", () => {
  it("含 app_id、response_type、编码后的 redirect_uri 与 state", () => {
    const url = buildAuthorizeUrl("st-1");
    expect(url).toContain("https://openapi.zhihu.com/authorize?");
    expect(url).toContain("app_id=app-123");
    expect(url).toContain("response_type=code");
    expect(url).toContain("state=st-1");
    expect(url).toContain(`redirect_uri=${encodeURIComponent("https://offnav.example.com/api/auth/zhihu/callback")}`);
  });

  it("缺 APP_ID 时抛错", () => {
    delete process.env.ZHIHU_OAUTH_APP_ID;
    expect(() => buildAuthorizeUrl("s")).toThrow(/ZHIHU_OAUTH_APP_ID/);
  });
});

describe("parseUidLossless", () => {
  it("int64 uid 无损转成字符串（不经过 Number）", () => {
    const raw = '{"uid":969570047710216200,"fullname":"n"}';
    expect(parseUidLossless(raw)).toBe("969570047710216200");
  });

  it("uid 已是字符串时原样返回", () => {
    expect(parseUidLossless('{"uid":"123"}')).toBe("123");
  });

  it("缺 uid 时抛错", () => {
    expect(() => parseUidLossless('{"fullname":"n"}')).toThrow(/uid/);
  });
});

describe("exchangeCodeForToken", () => {
  it("成功返回 accessToken", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok-789" }), { status: 200 })
    );
    expect(await exchangeCodeForToken("code-1")).toEqual({ accessToken: "tok-789" });
  });

  it("响应无 access_token 时抛错", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "bad" }), { status: 200 }));
    await expect(exchangeCodeForToken("c")).rejects.toThrow(/access_token/);
  });
});

describe("fetchZhihuUser", () => {
  it("带 Bearer token 请求并返回字符串 uid", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        '{"uid":969570047710216200,"hash_id":"h1","fullname":"张三","avatar_path":"https://pic/a.jpg","email":"","phone_no":""}',
        { status: 200 }
      )
    );
    const u = await fetchZhihuUser("tok");
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openapi.zhihu.com/user");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(u.uid).toBe("969570047710216200");
    expect(u.fullname).toBe("张三");
  });

  it("HTTP 200 但 code 表示用户不存在时抛错（不能只看状态码）", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"code":404,"data":"User don\'t exist"}', { status: 200 })
    );
    await expect(fetchZhihuUser("tok")).rejects.toThrow();
  });
});
