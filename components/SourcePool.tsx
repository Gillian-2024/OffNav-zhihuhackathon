"use client";

import { useState } from "react";
import { AuthorityBadge } from "./AuthorityBadge";
import { cleanTitle } from "@/lib/display";

export type PoolItem = {
  contentId: string;
  title: string;
  url: string;
  authorName: string;
  authorityLevel: number;
  voteUpCount: number;
};

// 来源池：始终可见的「本次检索 N 篇原文」是反黑箱的核心——
// 用户永远知道结论出自多少篇真实内容，随时能翻。
//
// 面板始终渲染在 DOM 里（不做条件渲染），可见性完全交给 `hidden`：
// - 手机上默认 `open=false` → `hidden` 生效，面板不可见，只有底部 tab 可点开；
// - ≥1024px 时 CSS 把 `.pool-panel` 变成 sticky 常驻栏，视觉上一直可见，
//   与 `open` 状态无关（Task 9 的页面可传入初始 `open=true` 让宽屏下默认展开，
//   但即使不传，CSS 布局本身已经保证宽屏是常驻栏）。
export function SourcePool({ items, usedIds }: { items: PoolItem[]; usedIds: Set<string> }) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;

  const usedCount = items.filter((i) => usedIds.has(i.contentId)).length;

  return (
    <>
      <button className="pool-tab" onClick={() => setOpen(true)}>
        本次检索 {items.length} 篇原文（{usedCount} 篇被引用）›
      </button>

      <aside className="pool-panel" data-open={open ? "1" : "0"} data-desktop-always>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>
            来源池 · {items.length} 篇
          </strong>
          <button onClick={() => setOpen(false)} style={{ background: "none", border: 0, color: "var(--text-dim)", cursor: "pointer" }}>
            收起
          </button>
        </div>
        {items.map((it) => (
          <div className="pool-row" key={it.contentId}>
            <AuthorityBadge level={it.authorityLevel} />
            <a href={it.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text)", flex: 1 }}>
              {cleanTitle(it.title)}
            </a>
            {usedIds.has(it.contentId) && <span className="pool-used">已引用</span>}
          </div>
        ))}
      </aside>
    </>
  );
}
