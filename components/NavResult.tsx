import { EvidenceList } from "./EvidenceCard";

// 岗位导航结果：按轮次 → 主题 → 考点，每条考点挂证据链。
export function NavResult({ data }: { data: any }) {
  return (
    <div>
      <p style={{ color: "var(--text-dim)" }}>{data.jobSummary}</p>

      {data.rounds.map((r: any, ri: number) => (
        <section key={ri} style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>{r.round}</h2>

          {r.topics.map((t: any, ti: number) => (
            <div className="card" key={ti} style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "var(--text-dim)" }}>{t.topic}</h3>
              {t.points.map((p: any, pi: number) => (
                <div key={pi} style={{ marginBottom: 12 }}>
                  <div>{p.text}</div>
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
