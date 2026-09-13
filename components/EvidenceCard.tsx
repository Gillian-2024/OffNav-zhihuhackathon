"use client";

import { useState } from "react";
import { AuthorityBadge } from "./AuthorityBadge";
import { cleanTitle } from "@/lib/display";

// 本地声明类型，故意与 lib/core/evidence.ts 的 EvidenceCard 重复：
// 客户端组件若从 lib/core 导入会把服务端专用模块（及其 node 依赖）
// 带入浏览器 bundle，因此这里不从 lib/core 引用。
export type EvidenceCard = {
  title: string;
  url: string;
  authorName: string;
  authorityLevel: number;
  voteUpCount: number;
  commentCount: number;
  excerpt: string;
};

// 默认折叠成一行，点开展开原文摘录 + 看原文。
// 折叠是手机优先的必然选择：一条结论可能挂三四张卡，全展开就没法读了。
export function EvidenceCardView({ card }: { card: EvidenceCard }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ev">
      <button className="ev-head btn-tap" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="ev-title">{cleanTitle(card.title)}</span>
        <span className="ev-meta">@{card.authorName || "知乎用户"}</span>
        <AuthorityBadge level={card.authorityLevel} />
        <span className="ev-meta ev-votes">{card.voteUpCount} 赞</span>
      </button>

      {open && (
        <div className="ev-body">
          {card.excerpt}
          <div>
            <a className="ev-link" href={card.url} target="_blank" rel="noopener noreferrer">
              看知乎原文 ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export function EvidenceList({ cards }: { cards: EvidenceCard[] }) {
  if (!cards || cards.length === 0) return null;
  return (
    <>
      {cards.map((c, i) => (
        <EvidenceCardView key={`${c.url}-${i}`} card={c} />
      ))}
    </>
  );
}
