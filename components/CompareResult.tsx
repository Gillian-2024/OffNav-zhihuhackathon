"use client";

import { useState } from "react";
import { EvidenceList } from "./EvidenceCard";

// 问题对照：多方观点按权威度排列 + 共识与分歧。
// 共识/分歧是已经算清楚的结论，理应先见；21 条各方说法是过程性素材，
// 结构性改法是结论先行——共识、分歧放最前，「各方说法」默认收起，
// 想看过程再展开。
export function CompareResult({ data }: { data: any }) {
  const views = data.views || [];
  const consensus = data.consensus || [];
  const divergence = data.divergence || [];
  const [viewsOpen, setViewsOpen] = useState(false);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>{data.question}</h2>

      <section className="round-section">
        <h3 style={{ fontSize: 14, fontWeight: 650, color: "var(--text)", margin: "0 0 4px" }}>共识</h3>
        {consensus.length === 0 ? (
          <p className="empty-hint">没有找到多方一致的共识点。</p>
        ) : (
          <div className="card">
            {consensus.map((c: any, i: number) => (
              <div className="consensus-item" key={i}>
                <span className="compare-tag">共识 {i + 1}</span>
                <div className="point-text">{c.text}</div>
                <EvidenceList cards={c.evidence} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="round-section">
        <h3 style={{ fontSize: 14, fontWeight: 650, color: "var(--text)", margin: "0 0 4px" }}>分歧</h3>
        {divergence.length === 0 ? (
          <p className="empty-hint">没有找到明显分歧的点。</p>
        ) : (
          <div className="card">
            {divergence.map((d: any, i: number) => (
              <div className="divergence-item" key={i}>
                <span className="compare-tag">分歧 {i + 1}</span>
                <div className="point-text">{d.text}</div>
                <EvidenceList cards={d.evidence} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="round-section">
        <button
          className="round-head btn-tap"
          onClick={() => setViewsOpen((v) => !v)}
          aria-expanded={viewsOpen}
        >
          <span className="round-dot" aria-hidden="true" />
          <span>各方说法</span>
          <span className="round-count">{views.length} 条</span>
          <span className="round-chevron" aria-hidden="true">▸</span>
        </button>

        <div className={`collapse ${viewsOpen ? "is-open" : ""}`}>
          <div>
            {views.length === 0 ? (
              <p className="empty-hint">没有检索到可展示的观点。</p>
            ) : (
              views.map((v: any, i: number) => (
                <div className="card" key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{v.stance}</div>
                  <div style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 4, lineHeight: 1.7 }}>{v.detail}</div>
                  <EvidenceList cards={v.evidence} />
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
