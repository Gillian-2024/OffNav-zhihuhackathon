import { describe, it, expect } from "vitest";
import { classifyRdbError } from "@/lib/db/postgrest";

describe("classifyRdbError", () => {
  it("表不存在（PGRST205）分类为 table_missing", () => {
    const msg = `CloudBase RDB 404: {"code":"DATABASE_PGRST205","message":"Could not find the table 'public.oauth_states' in the schema cache"}`;
    expect(classifyRdbError(msg)).toBe("table_missing");
  });

  it("无表名信息的普通 404 分类为 not_found", () => {
    const msg = `CloudBase RDB 404: {}`;
    expect(classifyRdbError(msg)).toBe("not_found");
  });

  it("500 等其它错误分类为 other，必须继续往外抛", () => {
    const msg = `CloudBase RDB 500: {"code":"INTERNAL"}`;
    expect(classifyRdbError(msg)).toBe("other");
  });
});
