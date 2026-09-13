import { EvidenceList } from "./EvidenceCard";

// 背景匹配：差距 → 该看什么。产出物是阅读清单，不是评分。
// 标签只是背景的索引，克制成小字灰底；差距（gap）才是主体，
// 给带编号的标题把层级立起来。
export function MatchResult({ data }: { data: any }) {
  const tags: string[] = data.tags || [];
  const gaps = data.gaps || [];

  return (
    <div>
      <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.75, margin: "0 0 12px" }}>{data.profileSummary}</p>

      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
          {tags.map((t: string, i: number) => (
            <span key={i} className="match-tag">
              {t}
            </span>
          ))}
        </div>
      )}

      {gaps.length === 0 ? (
        <p className="empty-hint">这次没有找到明显的背景差距。</p>
      ) : (
        gaps.map((g: any, i: number) => (
          <div className="card" key={i} style={{ marginBottom: 12 }}>
            <div className="gap-head">
              <span className="gap-index">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="gap-title">{g.gap}</h3>
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>{g.why}</div>
            {(g.points || []).length === 0 ? (
              <p className="empty-hint">没有对应的阅读建议。</p>
            ) : (
              g.points.map((p: any, pi: number) => (
                <div key={pi} className="point">
                  <div className="point-text">{p.text}</div>
                  <EvidenceList cards={p.evidence} />
                </div>
              ))
            )}
          </div>
        ))
      )}
    </div>
  );
}
