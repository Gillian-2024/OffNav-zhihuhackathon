import { EvidenceList } from "./EvidenceCard";

// 问题对照：多方观点按权威度排列 + 共识与分歧。
export function CompareResult({ data }: { data: any }) {
  return (
    <div>
      <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>{data.question}</h2>

      <section>
        <h3 style={{ fontSize: 14, color: "var(--text-dim)" }}>各方说法（{data.views.length}）</h3>
        {data.views.map((v: any, i: number) => (
          <div className="card" key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 500 }}>{v.stance}</div>
            <div style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 4 }}>{v.detail}</div>
            <EvidenceList cards={v.evidence} />
          </div>
        ))}
      </section>

      {data.consensus.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 14, color: "var(--text-dim)" }}>共识</h3>
          {data.consensus.map((c: any, i: number) => (
            <div className="card" key={i} style={{ marginBottom: 10 }}>
              <div>{c.text}</div>
              <EvidenceList cards={c.evidence} />
            </div>
          ))}
        </section>
      )}

      {data.divergence.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 14, color: "var(--text-dim)" }}>分歧</h3>
          {data.divergence.map((d: any, i: number) => (
            <div className="card" key={i} style={{ marginBottom: 10 }}>
              <div>{d.text}</div>
              <EvidenceList cards={d.evidence} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
