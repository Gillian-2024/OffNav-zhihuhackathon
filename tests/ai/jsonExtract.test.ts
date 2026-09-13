import { describe, it, expect } from "vitest";
import { z } from "zod";
import { extractAndParse } from "@/lib/ai/jsonExtract";
import { wrapUserContent } from "@/lib/ai/contentBoundary";

const S = z.object({ title: z.string(), items: z.array(z.string()) });

describe("extractAndParse", () => {
  it("剥掉 markdown 围栏后解析", () => {
    const raw = '```json\n{"title":"考点","items":["a","b"]}\n```';
    expect(extractAndParse(raw, S)).toEqual({ title: "考点", items: ["a", "b"] });
  });

  it("去掉 JSON 前后的解释性文字", () => {
    const raw = '好的，结果如下：{"title":"考点","items":[]} 希望有帮助';
    expect(extractAndParse(raw, S)).toEqual({ title: "考点", items: [] });
  });

  it("容忍尾随逗号", () => {
    expect(extractAndParse('{"title":"t","items":["a",],}', S)).toEqual({ title: "t", items: ["a"] });
  });

  it("空文本抛错", () => {
    expect(() => extractAndParse("", S)).toThrow(/空文本/);
  });

  it("schema 不匹配抛错并带原始输出", () => {
    expect(() => extractAndParse('{"title":123,"items":[]}', S)).toThrow(/Schema 校验失败/);
  });
});

describe("wrapUserContent", () => {
  it("包裹用户内容", () => {
    expect(wrapUserContent("hi")).toBe("\n<user-content>\nhi\n</user-content>");
  });

  it("空字符串返回空", () => {
    expect(wrapUserContent("   ")).toBe("");
  });
});
