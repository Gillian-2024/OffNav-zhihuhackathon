import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getStore, resetStoreForTests } from "@/lib/db/store";

const ENV_KEYS = ["CLOUDBASE_SERVER_API_KEY", "CLOUDBASE_API_BASE"] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  resetStoreForTests();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  resetStoreForTests();
  vi.restoreAllMocks();
});

describe("getStore 单例与 resetStoreForTests", () => {
  it("无 CloudBase 凭证时回退进程内存储，重置后按新环境变量重新判断", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // 第一次：无凭证，走 memory 分支（会打警告）。
    const memStore = getStore();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // 不 reset 直接再调一次：单例命中缓存，即使现在补上凭证也不会变。
    process.env.CLOUDBASE_SERVER_API_KEY = "k";
    process.env.CLOUDBASE_API_BASE = "https://example.invalid";
    const stillMemStore = getStore();
    expect(stillMemStore).toBe(memStore);
    expect(warnSpy).toHaveBeenCalledTimes(1); // 没有再走一次判断逻辑

    // reset 之后，getStore() 才会按当前环境变量重新选择——切到 PostgREST 分支。
    resetStoreForTests();
    const pgStore = getStore();
    expect(pgStore).not.toBe(memStore);
    expect(warnSpy).toHaveBeenCalledTimes(1); // PostgREST 分支不会打这条警告
  });
});
