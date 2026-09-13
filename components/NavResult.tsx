import { EvidenceList } from "./EvidenceCard";

// 岗位导航结果：按轮次 → 主题 → 考点，每条考点挂证据链。
export function NavResult({ data }: { data: any }) {
  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75 }}>{data.jobSummary}</p>
      </div>

      {data.rounds.map((r: any, ri: number) => (
        <section key={ri} style={{ marginTop: 22 }}>
          <h2 className="round-head">
            <span className="round-dot" aria-hidden="true" />
            {r.round}
          </h2>

          {r.topics.map((t: any, ti: number) => (
            <div className="card" key={ti} style={{ marginBottom: 10 }}>
              <h3 className="topic-head">{t.topic}</h3>
              {t.points.map((p: any, pi: number) => (
                <div key={pi} className="point">
                  <div className="point-text">{p.text}</div>
                  <EvidenceList cards={p.evidence} />
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
