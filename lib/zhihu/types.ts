// 知乎搜索返回的内容项。字段名与 /api/v1/content/zhihu_search 响应保持一致。
// ⚠️ AuthorityLevel 是字符串（实测），比较前必须转型。
export type ZhihuItem = {
  Title: string;
  ContentType: string;
  ContentID: string;
  ContentText: string;
  Url: string;
  AuthorName: string;
  AuthorSignature: string;
  AuthorAvatar: string;
  AuthorBadge: string;
  AuthorBadgeText: string;
  CommentCount: number;
  VoteUpCount: number;
  EditTime: number;
  AuthorityLevel: string;
  RankingScore: number;
};

export type SearchResult = {
  items: ZhihuItem[];
  errors: string[];
};
