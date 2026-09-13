"use client";

import { useState } from "react";
import { EvidenceList } from "./EvidenceCard";

// 岗位导航结果：按轮次 → 主题 → 考点，每条考点挂证据链。
// 一份真实结果有 6-7 轮、约 50 条考点，单列平铺滑起来很累：
// 结构性改法是让每轮默认展开但可折叠，并在顶部给一份可点跳转的轮次索引，
// 让用户先看到「一共几轮、现在在哪」，而不是盲目往下滑。
export function NavResult({ data }: { data: any }) {
  const rounds = data.rounds || [];
  const [openMap, setOpenMap] = useState<Record<number, boolean>>(
    () => Object.fromEntries(rounds.map((_: any, i: number) => [i, true]))
  );

  function toggle(i: number) {
    setOpenMap((m) => ({ ...m, [i]: !m[i] }));
  }

  function jumpTo(i: number) {
    setOpenMap((m) => ({ ...m, [i]: true }));
    document.getElementById(`round-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75 }}>{data.jobSummary}</p>
      </div>

      {rounds.length === 0 ? (
        <p className="empty-hint">这次没有整理出面试轮次。</p>
      ) : (
        <>
          {rounds.length > 1 && (
            <div className="round-index" role="navigation" aria-label="跳转到轮次">
              {rounds.map((r: any, i: number) => (
                <button key={i} className="round-index-item btn-tap" onClick={() => jumpTo(i)}>
                  {r.round}
                </button>
              ))}
            </div>
          )}

          {rounds.map((r: any, ri: number) => {
            const open = openMap[ri] !== false;
            const pointCount = (r.topics || []).reduce((n: number, t: any) => n + (t.points?.length || 0), 0);
            return (
              <section key={ri} id={`round-${ri}`} className="round-section">
                <button className="round-head" onClick={() => toggle(ri)} aria-expanded={open}>
                  <span className="round-dot" aria-hidden="true" />
                  <span>{r.round}</span>
                  <span className="round-count">{pointCount} 条</span>
                  <span className="round-chevron" aria-hidden="true">▸</span>
                </button>

                <div className={`collapse ${open ? "is-open" : ""}`}>
                  <div>
                    {(r.topics || []).length === 0 ? (
                      <p className="empty-hint">这轮没有整理出具体考点。</p>
                    ) : (
                      r.topics.map((t: any, ti: number) => (
                        <div className="card" key={ti} style={{ marginBottom: 10 }}>
                          <h3 className="topic-head">{t.topic}</h3>
                          {(t.points || []).map((p: any, pi: number) => (
                            <div key={pi} className="point">
                              <div className="point-text">{p.text}</div>
                              <EvidenceList cards={p.evidence} />
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
