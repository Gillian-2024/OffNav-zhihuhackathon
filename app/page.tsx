"use client";

import { useEffect, useState } from "react";
import { streamSSE } from "@/lib/client/sse";
import { withBase } from "@/lib/client/basePath";
import { SourcePool, type PoolItem } from "@/components/SourcePool";
import { NavResult } from "@/components/NavResult";
import { CompareResult } from "@/components/CompareResult";
import { MatchResult } from "@/components/MatchResult";

type Mode = "nav" | "compare" | "match";

const MODES: { key: Mode; label: string; placeholder: string; hint: string }[] = [
  { key: "nav", label: "岗位导航", placeholder: "例如：字节跳动 产品经理 校招", hint: "填入公司和岗位，开始导航" },
  { key: "compare", label: "问题对照", placeholder: "例如：产品经理面试怎么答产品分析题", hint: "填入一个面试问题，看各方怎么答" },
  { key: "match", label: "我的背景", placeholder: "粘贴背景，或上传简历文件", hint: "上传简历或粘贴背景，开始比对" },
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
    fetch(withBase("/api/auth/me"))
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, []);

  async function onUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(withBase("/api/upload"), { method: "POST", body: fd });
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

    await streamSSE(withBase(`/api/${mode}`), body, {
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <a href={withBase("/me")} title={user.fullname || "个人主页"}>
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.fullname || "头像"}
                  style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--border)" }} />
              )}
            </a>
            <button
              onClick={() => fetch(withBase("/api/auth/logout"), { method: "POST" }).then(() => setUser(null))}
              className="btn-ghost btn-tap"
            >
              退出
            </button>
          </div>
        ) : (
          <a href={withBase("/api/auth/zhihu/start")} className="login-link btn-tap">
            知乎登录
          </a>
        )}
      </header>

      <div className="segmented" role="group" aria-label="选择分析模式">
        {MODES.map((m) => (
          <button
            key={m.key}
            className="btn-tap"
            aria-pressed={mode === m.key}
            onClick={() => { setMode(m.key); setResult(null); setPool([]); }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="form-group">
        {mode === "match" && (
          <>
            <input
              className="field"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="目标岗位（例如：字节 产品经理）"
            />
            <label className="file-pick">
              <input
                type="file"
                accept=".pdf,.docx,.txt,.html"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
              />
              上传简历（PDF / Word / txt），或直接粘贴到下方
            </label>
          </>
        )}

        <textarea
          className="field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={active.placeholder}
          rows={mode === "match" ? 6 : 2}
        />
      </div>

      <div className="form-cta">
        <button className="cta btn-tap" onClick={run} disabled={busy || !input.trim()}>
          {busy ? "正在导航…" : "开始导航"}
        </button>
        {!busy && !input.trim() && (
          <p className="cta-hint">{active.hint}</p>
        )}
      </div>

      {!busy && !result && !error && steps.length === 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="kanshan-row">
            <img src={withBase("/kanshan/hello.gif")} alt="" className="kanshan kanshan-lg" />
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-dim)" }}>
              输入后，OffNav 会做四件事：
            </p>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--text-dim)", lineHeight: 1.9 }}>
            <li>用多组关键词检索知乎，合并去重成一个内容池</li>
            <li>按知乎自己的权威度（<span className="auth auth-4">L4</span> 最高）和赞同数重排</li>
            <li>结构化成一张分轮次、分主题的地图</li>
            <li>每条结论挂上来源卡，点进去回到知乎原文</li>
          </ol>
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--text-faint)" }}>
            交不出来源的结论会被丢弃，页面会告诉你丢了几条。
          </p>
        </div>
      )}

      {steps.length > 0 && !result && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="kanshan-row">
            <img src={withBase("/kanshan/working.gif")} alt="" className="kanshan" />
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.9 }}>
              {steps.map((s, i) => (
                <li key={i}>{i === steps.length - 1 ? "▸ " : "✓ "}{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {notice && (
        <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-faint)" }}>
          ⓘ {notice}
        </p>
      )}

      {error && (
        <div className="card" style={{ marginTop: 14, borderColor: "#f1403c" }}>
          <div className="kanshan-row">
            <img src={withBase("/kanshan/sleepy.gif")} alt="" className="kanshan" />
            <span style={{ color: "#f1403c", fontSize: 14 }}>{error}</span>
          </div>
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
