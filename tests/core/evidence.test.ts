import { describe, it, expect } from "vitest";
import { toEvidenceCard, attachEvidence } from "@/lib/core/evidence";
import type { ZhihuItem } from "@/lib/zhihu/types";

function mk(id: string, over: Partial<ZhihuItem> = {}): ZhihuItem {
  return {
    Title: `标题${id}`, ContentType: "Answer", ContentID: id,
    ContentText: "正文内容", Url: `https://www.zhihu.com/answer/${id}`,
    AuthorName: "作者", AuthorSignature: "", AuthorAvatar: "",
    AuthorBadge: "", AuthorBadgeText: "", CommentCount: 3,
    VoteUpCount: 57, EditTime: 0, AuthorityLevel: "4", RankingScore: 1, ...over,
  };
}

describe("toEvidenceCard", () => {
  it("四要素齐全", () => {
    const c = toEvidenceCard(mk("1"));
    expect(c.title).toBe("标题1");
    expect(c.url).toBe("https://www.zhihu.com/answer/1");
    expect(c.authorName).toBe("作者");
    expect(c.authorityLevel).toBe(4);
    expect(c.voteUpCount).toBe(57);
    expect(c.excerpt).toBe("正文内容");
  });

  it("权威度非法值归零", () => {
    expect(toEvidenceCard(mk("1", { AuthorityLevel: "" })).authorityLevel).toBe(0);
  });
});

describe("attachEvidence", () => {
  const pool = [mk("a"), mk("b"), mk("c")];

  it("回填得上的结论保留，并挂上证据卡", () => {
    const r = attachEvidence([{ text: "会问指标设计", sourceIds: ["a"] }], pool);
    expect(r.kept).toHaveLength(1);
    expect(r.dropped).toBe(0);
    expect(r.kept[0].evidence).toHaveLength(1);
    expect(r.kept[0].evidence[0].title).toBe("标题a");
  });

  it("回填不上的结论被丢弃——这是反编造的闸口", () => {
    const r = attachEvidence([{ text: "我编的", sourceIds: ["ghost"] }], pool);
    expect(r.kept).toHaveLength(0);
    expect(r.dropped).toBe(1);
  });

  it("sourceIds 为空的结论被丢弃", () => {
    const r = attachEvidence([{ text: "无来源", sourceIds: [] }], pool);
    expect(r.kept).toHaveLength(0);
    expect(r.dropped).toBe(1);
  });

  it("部分 ID 有效时保留，只挂有效的那些", () => {
    const r = attachEvidence([{ text: "半真", sourceIds: ["a", "ghost", "b"] }], pool);
    expect(r.kept).toHaveLength(1);
    expect(r.kept[0].evidence).toHaveLength(2);
  });

  it("输出里不再含 sourceIds（已转成 evidence）", () => {
    const r = attachEvidence([{ text: "t", sourceIds: ["a"] }], pool);
    expect("sourceIds" in r.kept[0]).toBe(false);
  });

  it("证据卡按权威度降序排列", () => {
    const p = [mk("low", { AuthorityLevel: "1" }), mk("high", { AuthorityLevel: "4" })];
    const r = attachEvidence([{ text: "t", sourceIds: ["low", "high"] }], p);
    expect(r.kept[0].evidence[0].authorityLevel).toBe(4);
  });

  it("同一 ID 重复引用只挂一张卡", () => {
    const r = attachEvidence([{ text: "t", sourceIds: ["a", "a"] }], pool);
    expect(r.kept[0].evidence).toHaveLength(1);
  });

  it("空结论数组返回空结果", () => {
    const r = attachEvidence([], pool);
    expect(r.kept).toEqual([]);
    expect(r.dropped).toBe(0);
  });
});
