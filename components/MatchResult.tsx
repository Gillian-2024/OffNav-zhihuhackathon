import { EvidenceList } from "./EvidenceCard";

// 背景匹配：差距 → 该看什么。产出物是阅读清单，不是评分。
export function MatchResult({ data }: { data: any }) {
  return (
    <div>
      <p style={{ color: "var(--text-dim)" }}>{data.profileSummary}</p>

      {data.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 18px" }}>
          {data.tags.map((t: string, i: number) => (
            <span key={i} style={{ padding: "2px 8px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999, fontSize: 12 }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {data.gaps.map((g: any, i: number) => (
        <div className="card" key={i} style={{ marginBottom: 10 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 4px" }}>{g.gap}</h3>
          <div style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 8 }}>{g.why}</div>
          {g.points.map((p: any, pi: number) => (
            <div key={pi} style={{ marginBottom: 12 }}>
              <div>{p.text}</div>
              <EvidenceList cards={p.evidence} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
