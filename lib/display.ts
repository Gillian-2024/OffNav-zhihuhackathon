// 展示层的小清理。知乎搜索返回的标题一律带 " - 知乎" 后缀（实测 34/34），
// 手机单列里这段后缀没有信息量，只挤占宽度。
// 注意：URL 上的 utm_ 参数一律保留不动——那是知乎归因 OffNav 回流量的凭据，
// 而「给知乎导流」正是本产品的核心价值主张，去掉等于把自己的贡献抹掉。
export function cleanTitle(title: string): string {
  return (title || "").replace(/\s*[-–—]\s*知乎\s*$/, "").trim();
}
