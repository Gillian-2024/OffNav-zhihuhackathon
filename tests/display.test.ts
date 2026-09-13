import { describe, it, expect } from "vitest";
import { cleanTitle } from "@/lib/display";

describe("cleanTitle", () => {
  it("去掉结尾的 - 知乎", () => {
    expect(cleanTitle("字节跳动产品经理面经 - 知乎")).toBe("字节跳动产品经理面经");
  });

  it("兼容不同破折号", () => {
    expect(cleanTitle("标题 — 知乎")).toBe("标题");
    expect(cleanTitle("标题 – 知乎")).toBe("标题");
  });

  it("不动标题中间出现的知乎", () => {
    expect(cleanTitle("知乎是个好平台 - 知乎")).toBe("知乎是个好平台");
  });

  it("没有后缀时原样返回", () => {
    expect(cleanTitle("普通标题")).toBe("普通标题");
  });

  it("空值安全", () => {
    expect(cleanTitle("")).toBe("");
  });
});
