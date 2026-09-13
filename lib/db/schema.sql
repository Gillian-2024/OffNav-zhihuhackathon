-- 网关：https://offnav-2026-d6gvnsynj3c561411.api.intl.tcloudbasegateway.com
-- 地域：ap-singapore（国际地域需要 host 里的 `.intl.` 段）。
-- 已确认（2026-09-13 复审探测）：五张表已经建好，本文件不会再被人工在控制台执行，
-- 现在是 schema 参考 / 灾难恢复用的存档文件，不是待执行的建表步骤。
create table if not exists users (
  id           text primary key,
  zhihu_uid    text unique not null,
  hash_id      text not null default '',
  fullname     text not null default '',
  avatar       text not null default '',
  created_at   bigint not null
);

create table if not exists sessions (
  id           text primary key,
  user_id      text not null,
  oauth_token  text not null,
  expires_at   bigint not null
);

create table if not exists oauth_states (
  state        text primary key,
  session_hint text not null default '',
  expires_at   bigint not null,
  consumed_at  bigint
);

create table if not exists zhihu_search_cache (
  query_hash   text primary key,
  query        text not null,
  payload      jsonb not null,
  fetched_at   bigint not null
);

create table if not exists nav_results (
  id           text primary key,
  user_id      text,
  kind         text not null,
  input        text not null,
  result       jsonb not null,
  created_at   bigint not null
);

create index if not exists idx_sessions_expires on sessions (expires_at);
create index if not exists idx_cache_fetched on zhihu_search_cache (fetched_at);
