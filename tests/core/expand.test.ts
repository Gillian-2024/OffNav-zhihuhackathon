import { describe, it, expect } from "vitest";
import { expandJobQueries, expandQuestionQueries, expandProfileQueries } from "@/lib/core/expand";

describe("expandJobQueries", () => {
  it("产出 3 到 5 个查询", () => {
    const qs = expandJobQueries("字节跳动 产品经理");
    expect(qs.length).toBeGreaterThanOrEqual(3);
    expect(qs.length).toBeLessThanOrEqual(5);
  });

  it("每个查询都含原始输入词", () => {
    for (const q of expandJobQueries("字节跳动 产品经理")) {
      expect(q).toContain("字节跳动 产品经理");
    }
  });

  it("查询互不重复", () => {
    const qs = expandJobQueries("腾讯 后端");
    expect(new Set(qs).size).toBe(qs.length);
  });

  it("空输入返回空数组", () => {
    expect(expandJobQueries("   ")).toEqual([]);
  });
});

describe("expandQuestionQueries", () => {
  it("保留原问题作为首个查询", () => {
    const qs = expandQuestionQueries("产品经理怎么答产品分析题");
    expect(qs[0]).toBe("产品经理怎么答产品分析题");
  });

  it("产出 3 到 5 个查询且不重复", () => {
    const qs = expandQuestionQueries("如何准备产品面试");
    expect(qs.length).toBeGreaterThanOrEqual(3);
    expect(qs.length).toBeLessThanOrEqual(5);
    expect(new Set(qs).size).toBe(qs.length);
  });
});

describe("expandProfileQueries", () => {
  it("按标签组合出查询，上限 5 个", () => {
    const qs = expandProfileQueries(["计算机专业", "字节实习", "推荐算法", "本科", "双非"]);
    expect(qs.length).toBeLessThanOrEqual(5);
    expect(qs.length).toBeGreaterThan(0);
  });

  it("标签为空返回空数组", () => {
    expect(expandProfileQueries([])).toEqual([]);
  });

  it("过滤空白标签", () => {
    const qs = expandProfileQueries(["  ", "产品经理"]);
    expect(qs.every((q) => q.trim().length > 0)).toBe(true);
  });
});
