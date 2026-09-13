import { describe, it, expect } from "vitest";
import { authorityNum, rankItems, dedupeItems, excerpt } from "@/lib/zhihu/rank";
import type { ZhihuItem } from "@/lib/zhihu/types";

function mk(over: Partial<ZhihuItem>): ZhihuItem {
  return {
    Title: "t", ContentType: "Answer", ContentID: "1", ContentText: "body",
    Url: "https://www.zhihu.com/answer/1", AuthorName: "a", AuthorSignature: "",
    AuthorAvatar: "", AuthorBadge: "", AuthorBadgeText: "", CommentCount: 0,
    VoteUpCount: 0, EditTime: 0, AuthorityLevel: "1", RankingScore: 0, ...over,
  };
}

describe("authorityNum", () => {
  it("字符串权威度转数字", () => {
    expect(authorityNum(mk({ AuthorityLevel: "4" }))).toBe(4);
  });

  it("非法值归零而非 NaN", () => {
    expect(authorityNum(mk({ AuthorityLevel: "" }))).toBe(0);
    expect(authorityNum(mk({ AuthorityLevel: "abc" }))).toBe(0);
  });
});

describe("rankItems", () => {
  it("先按权威度降序，同级按赞同降序", () => {
    const out = rankItems([
      mk({ ContentID: "a", AuthorityLevel: "3", VoteUpCount: 999 }),
      mk({ ContentID: "b", AuthorityLevel: "4", VoteUpCount: 1 }),
      mk({ ContentID: "c", AuthorityLevel: "4", VoteUpCount: 57 }),
    ]);
    expect(out.map((i) => i.ContentID)).toEqual(["c", "b", "a"]);
  });

  it("不修改入参数组", () => {
    const input = [mk({ ContentID: "x", AuthorityLevel: "1" }), mk({ ContentID: "y", AuthorityLevel: "4" })];
    rankItems(input);
    expect(input.map((i) => i.ContentID)).toEqual(["x", "y"]);
  });
});

describe("dedupeItems", () => {
  it("按 ContentID 去重，保留首次出现", () => {
    const out = dedupeItems([
      mk({ ContentID: "1", Title: "first" }),
      mk({ ContentID: "1", Title: "dup" }),
      mk({ ContentID: "2" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].Title).toBe("first");
  });

  it("ContentID 缺失时回退用 Url 去重", () => {
    const out = dedupeItems([
      mk({ ContentID: "", Url: "https://www.zhihu.com/answer/9" }),
      mk({ ContentID: "", Url: "https://www.zhihu.com/answer/9" }),
    ]);
    expect(out).toHaveLength(1);
  });
});

describe("excerpt", () => {
  it("超长截断并加省略号", () => {
    expect(excerpt("x".repeat(200), 50)).toHaveLength(51);
    expect(excerpt("x".repeat(200), 50).endsWith("…")).toBe(true);
  });

  it("短文本原样返回", () => {
    expect(excerpt("短句", 50)).toBe("短句");
  });

  it("压缩连续空白", () => {
    expect(excerpt("a\n\n  b", 50)).toBe("a b");
  });
});
