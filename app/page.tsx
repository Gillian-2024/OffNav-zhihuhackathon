"use client";

import { useEffect, useState } from "react";
import { streamSSE } from "@/lib/client/sse";
import { SourcePool, type PoolItem } from "@/components/SourcePool";
import { NavResult } from "@/components/NavResult";
import { CompareResult } from "@/components/CompareResult";
import { MatchResult } from "@/components/MatchResult";

type Mode = "nav" | "compare" | "match";

const MODES: { key: Mode; label: string; placeholder: string }[] = [
  { key: "nav", label: "岗位导航", placeholder: "例如：字节跳动 产品经理 校招" },
  { key: "compare", label: "问题对照", placeholder: "例如：产品经理面试怎么答产品分析题" },
  { key: "match", label: "我的背景", placeholder: "粘贴背景，或上传简历文件" },
];

// 收集结果里所有被引用的来源 url，用于在来源池标「已引用」。
function collectUsed(result: any): Set<string> {
  const used = new Set<string>();
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n.evidence)) for (const e of n.evidence) if (e?.url) used.add(e.url);
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") walk(v);
    }
  };
  walk(result);
  return used;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("nav");
  const [input, setInput] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, []);

  async function onUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    if (d.error) setError(d.error);
    else setInput(d.text);
  }

  async function run() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setSteps([]);
    setPool([]);
    setResult(null);
    setError("");
    setNotice("");

    const body = mode === "match" ? { profileText: input, target } : { input };

    await streamSSE(`/api/${mode}`, body, {
      step: (e) => setSteps((s) => [...s, e.message]),
      pool: (e) => setPool(e.items),
      notice: (e) => setNotice(e.message),
      result: (e) => setResult(e.result),
      error: (m) => setError(m),
    });

    setBusy(false);
  }

  const usedUrls = result ? collectUsed(result) : new Set<string>();
  const usedIds = new Set(pool.filter((p) => usedUrls.has(p.url)).map((p) => p.contentId));
  const active = MODES.find((m) => m.key === mode)!;

  return (
    <div className="wrap">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 21, margin: 0 }}>OffNav</h1>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "2px 0 0" }}>
            把知乎的经验长文，按权威度重排成一条带证据链的求职路径
          </p>
        </div>
        {user ? (
          <button
            onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => setUser(null))}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", color: "var(--text-dim)", cursor: "pointer" }}
          >
            退出
          </button>
        ) : (
          <a href="/api/auth/zhihu/start" style={{ fontSize: 13, color: "var(--auth-3)" }}>
            知乎登录
          </a>
        )}
      </header>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setResult(null); setPool([]); }}
            style={{
              flex: 1,
              padding: "7px 4px",
              fontSize: 13,
              borderRadius: 6,
              cursor: "pointer",
              border: `1px solid ${mode === m.key ? "var(--auth-3)" : "var(--border)"}`,
              background: mode === m.key ? "var(--auth-3)" : "var(--surface)",
              color: mode === m.key ? "#fff" : "var(--text)",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "match" && (
        <>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="目标岗位（例如：字节 产品经理）"
            style={{ width: "100%", padding: 10, marginBottom: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 15 }}
          />
          <input
            type="file"
            accept=".pdf,.docx,.txt,.html"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
            style={{ marginBottom: 8, fontSize: 13 }}
          />
        </>
      )}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={active.placeholder}
        rows={mode === "match" ? 6 : 2}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 15, resize: "vertical" }}
      />

      <button
        onClick={run}
        disabled={busy || !input.trim()}
        style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 8, border: 0, background: busy ? "var(--auth-1)" : "var(--auth-4)", color: "#fff", fontSize: 15, cursor: busy ? "default" : "pointer" }}
      >
        {busy ? "正在导航…" : "开始导航"}
      </button>

      {steps.length > 0 && !result && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 14, fontSize: 13, color: "var(--text-dim)" }}>
          {steps.map((s, i) => (
            <li key={i}>· {s}</li>
          ))}
        </ul>
      )}

      {notice && (
        <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-faint)" }}>
          ⓘ {notice}
        </p>
      )}

      {error && (
        <div className="card" style={{ marginTop: 14, borderColor: "#c0574a", color: "#c0574a" }}>
          {error}
        </div>
      )}

      {result && (
        <div className="layout" style={{ marginTop: 22 }}>
          <main>
            {result.dropped > 0 && (
              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                已丢弃 {result.dropped} 条无法回溯到来源的内容
              </p>
            )}
            {mode === "nav" && <NavResult data={result} />}
            {mode === "compare" && <CompareResult data={result} />}
            {mode === "match" && <MatchResult data={result} />}
          </main>
          <SourcePool items={pool} usedIds={usedIds} />
        </div>
      )}
    </div>
  );
}
