"use client";

// 个人主页：昵称/头像/一句话介绍 + 关注的人 + 创作内容，均按 Offset/Limit 分页。
// 分页严格按官方约定：下一页的 Offset 用响应里的 Paging.NextOffset 原样回传，
// 不用本地累计的 items.length 自己算 offset（user-api.md 有专门警告）。
import { useEffect, useState } from "react";
import { withBase } from "@/lib/client/basePath";

type Paging = { IsEnd: boolean; NextOffset?: string; Totals: number };

type Followee = {
  Fullname: string;
  UrlToken: string;
  Url: string;
  AvatarUrl: string;
  Headline: string;
  FollowerCount: number;
};

type ContentItem = {
  ContentType: string;
  Url: string;
  CreatedAt: number;
  LikeCount: number;
  CommentCount: number;
  Title: string;
  Summary: string;
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  answer: "回答",
  article: "文章",
  zvideo: "视频",
  pin: "想法",
  question: "问题",
};

export default function MePage() {
  const [me, setMe] = useState<any>(null);
  const [meLoading, setMeLoading] = useState(true);

  const [followees, setFollowees] = useState<Followee[]>([]);
  const [followeesOffset, setFolloweesOffset] = useState<string | null>("0");
  const [followeesBusy, setFolloweesBusy] = useState(false);
  const [followeesError, setFolloweesError] = useState("");

  const [contents, setContents] = useState<ContentItem[]>([]);
  const [contentsOffset, setContentsOffset] = useState<string | null>("0");
  const [contentsBusy, setContentsBusy] = useState(false);
  const [contentsError, setContentsError] = useState("");

  useEffect(() => {
    fetch(withBase("/api/auth/me"))
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          setMe(null);
          return;
        }
        setMe(d.user);
        // headline 不落库，现查现返；失败不影响页面其余部分（昵称/头像已够用）。
        fetch(withBase("/api/me/profile"))
          .then((r) => r.json())
          .then((p) => {
            if (p?.headline) setMe((prev: any) => (prev ? { ...prev, headline: p.headline } : prev));
          })
          .catch(() => {});
      })
      .catch(() => {})
      .finally(() => setMeLoading(false));
  }, []);

  useEffect(() => {
    if (me) {
      loadFollowees("0");
      loadContents("0");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  async function loadFollowees(offset: string) {
    setFolloweesBusy(true);
    setFolloweesError("");
    try {
      const res = await fetch(withBase(`/api/me/followees?Offset=${offset}&Limit=20`));
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "加载失败");
      setFollowees((prev) => [...prev, ...(d.Items || [])]);
      const paging: Paging | undefined = d.Paging;
      setFolloweesOffset(paging && !paging.IsEnd ? String(paging.NextOffset) : null);
    } catch (e) {
      setFolloweesError((e as Error).message);
    } finally {
      setFolloweesBusy(false);
    }
  }

  async function loadContents(offset: string) {
    setContentsBusy(true);
    setContentsError("");
    try {
      const res = await fetch(withBase(`/api/me/contents?ContentType=all&Offset=${offset}&Limit=20`));
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "加载失败");
      setContents((prev) => [...prev, ...(d.Items || [])]);
      const paging: Paging | undefined = d.Paging;
      setContentsOffset(paging && !paging.IsEnd ? String(paging.NextOffset) : null);
    } catch (e) {
      setContentsError((e as Error).message);
    } finally {
      setContentsBusy(false);
    }
  }

  if (meLoading) {
    return (
      <div className="wrap">
        <p style={{ color: "var(--text-dim)" }}>加载中…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="wrap">
        <div className="card">
          <p style={{ margin: 0 }}>请先登录知乎账号后查看个人主页。</p>
          <a href={withBase("/api/auth/zhihu/start")} style={{ color: "var(--link)", fontSize: 13 }}>
            去登录
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18 }}>
        <a href={withBase("/")} style={{ color: "var(--text-dim)", fontSize: 13, textDecoration: "none" }}>
          ‹ 返回
        </a>
      </header>

      <div className="card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {me.avatar ? (
          <img
            src={me.avatar}
            alt={me.fullname || "头像"}
            style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
              background: "var(--border)",
            }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{me.fullname || "知乎用户"}</div>
          {me.headline && (
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2 }}>{me.headline}</div>
          )}
        </div>
      </div>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>关注的人</h2>
        {followeesError && (
          <p style={{ fontSize: 13, color: "#f1403c" }}>{followeesError}</p>
        )}
        {followees.length === 0 && !followeesBusy && !followeesError && (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>暂无公开的关注列表</p>
        )}
        <div className="card" style={{ padding: 0 }}>
          {followees.map((f, i) => (
            <div
              key={f.UrlToken + i}
              style={{
                display: "flex", gap: 10, alignItems: "center", padding: "10px 14px",
                borderBottom: i < followees.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              {f.AvatarUrl ? (
                <img
                  src={f.AvatarUrl}
                  alt={f.Fullname}
                  style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
                />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "var(--border)" }} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <a
                  href={f.Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}
                >
                  {f.Fullname}
                </a>
                {f.Headline && (
                  <div
                    style={{
                      fontSize: 12, color: "var(--text-faint)", marginTop: 2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {f.Headline}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 12, color: "var(--text-faint)", flexShrink: 0 }}>
                {f.FollowerCount} 粉丝
              </span>
            </div>
          ))}
        </div>
        {followeesOffset !== null && (
          <button
            onClick={() => loadFollowees(followeesOffset)}
            disabled={followeesBusy}
            style={{
              width: "100%", marginTop: 10, padding: 10, borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--surface)",
              color: "var(--text-dim)", fontSize: 13, cursor: followeesBusy ? "default" : "pointer",
            }}
          >
            {followeesBusy ? "加载中…" : "加载更多"}
          </button>
        )}
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>创作内容</h2>
        {contentsError && <p style={{ fontSize: 13, color: "#f1403c" }}>{contentsError}</p>}
        {contents.length === 0 && !contentsBusy && !contentsError && (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>暂无公开的创作内容</p>
        )}
        {contents.map((c, i) => (
          <div className="card" key={c.Url + i} style={{ marginTop: i === 0 ? 0 : 8 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <span className="auth auth-0">{CONTENT_TYPE_LABEL[c.ContentType] || c.ContentType}</span>
              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                赞 {c.LikeCount} · 评论 {c.CommentCount}
              </span>
            </div>
            <a
              href={c.Url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 14, color: "var(--text)", fontWeight: 500, display: "block", marginBottom: 4 }}
            >
              {c.Title}
            </a>
            {c.Summary && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>{c.Summary}</p>
            )}
          </div>
        ))}
        {contentsOffset !== null && (
          <button
            onClick={() => loadContents(contentsOffset)}
            disabled={contentsBusy}
            style={{
              width: "100%", marginTop: 10, padding: 10, borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--surface)",
              color: "var(--text-dim)", fontSize: 13, cursor: contentsBusy ? "default" : "pointer",
            }}
          >
            {contentsBusy ? "加载中…" : "加载更多"}
          </button>
        )}
      </section>
    </div>
  );
}
