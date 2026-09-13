# OffNav

> **移动端优先**：OffNav 是按手机屏幕设计的——目标用户在手机上刷知乎，分享出去的链接也在手机上打开。
> 用电脑访问同样可用，宽屏下右侧会展开常驻的来源池面板。**建议用手机打开，或把浏览器窗口收窄到手机宽度体验。**

**线上体验**：https://offnav-2026-d6gvnsynj3c561411-1485365421.ap-singapore.app.tcloudbase.com/offnav

把知乎的经验长文，按知乎自己的权威度信号重排，织成一条带证据链的求职路径。

知乎黑客松 2026 校园新锐季 · 知识炼金场赛道参赛作品。

## 它解决什么

知乎有全中文互联网最深的经验类长文，但对求职的人来说它们是散的：一次搜索只给 10 条且无分页，前排常被营销号占据，而且你没办法判断哪条经验值得信。

OffNav 用 `AuthorityLevel`（权威度）与赞同数重排这些内容并结构化，每条结论都挂着来源深链回流知乎原文——**给知乎导流，不替代知乎**。

## 三个入口

| 入口 | 输入 | 输出 |
|---|---|---|
| 岗位导航 | 字节跳动 产品经理 校招 | 面试考点地图，按轮次与主题分组 |
| 问题对照 | 产品经理面试怎么答产品分析题 | 按权威度排序的多方说法 + 共识与分歧 |
| 我的背景 | 简历文件或背景文字 | 相对目标岗位的差距 + 对应的知乎阅读清单 |

三个入口共用一条链路：知乎取材 → 权威度重排 → AI 结构化 → 证据链校验 → 深链回流。

## 每个字都能点回知乎

AI 输出的每条结论都必须带来源编号，服务端逐条核对这些编号是否真在本次检索池里，**核不上的结论直接丢弃、不进入响应**。界面上「本次检索 N 篇原文」始终可见，被引用的标「已引用」，被丢弃的条数也会显示出来。

反编造不靠在 prompt 里写「请不要编造」，靠服务端的这道校验闸口。

## 本地运行

```bash
npm install
cp .env.example .env.local   # 填入 ZHIHU_ACCESS_SECRET 与模型 API Key
npm run dev
```

未配置 `CLOUDBASE_SERVER_API_KEY` 时自动回退到进程内存储，无需数据库即可跑通全部功能。

## 测试

```bash
npm test          # 96 个单元测试
npm run typecheck
npm run build
```

覆盖重点在证据链回填与丢弃、搜索缓存的命中/过期/失败不写入、直答额度降级的四种行为、OAuth state 防重放与跨浏览器绑定。

## 技术栈

Next 15 App Router · React 19 · TypeScript · zod · Vercel AI SDK · 腾讯 CloudBase（PostgreSQL，ap-singapore）

## 知乎开放平台用法与实测约束

| 约束 | 实测 | 应对 |
|---|---|---|
| 单次搜索上限 | ≤10 条，`HasMore` 恒 false，无分页 | 多组关键词串行取材扩池，5 组取回 34 篇去重原文 |
| 并发限流 | 5 并发中 3 个返回 `Code=30001` | 串行请求，间隔 ≥400ms |
| 字段类型 | `AuthorityLevel` 是字符串 | 排序前强制转型，否则 `NaN` 静默破坏排序 |
| 知识库 RAG | 检索返回整篇摘要，丢失单条来源归属 | 与证据链冲突，未采用 |
| 发布写 API | `creator` 四个接口全是 GET，只认本人身份 | 「一键发布回知乎」是伪需求，产出为可复制文本 + 深链 |

搜索结果按 `query_hash` 缓存 24 小时。生成默认走知乎直答（`zhida-fast-1p5`），其 100 次/天额度为全租户共享，撞额度自动降级到 Anthropic 协议兼容端点并在界面告知用户。

## 安全

- OAuth `state` 为 256 位随机值，存库并绑定浏览器 cookie，单次消费
- OAuth token 只留服务端，浏览器仅持 HttpOnly + Secure 会话 cookie
- `uid` 是 int64，解析前用正则从原始响应取出并以字符串存储，避免 `JSON.parse` 静默丢精度
- 简历上传只做一次性解析，不落盘、不入库、不记日志

## 部署

运行在腾讯 CloudBase **云函数（HTTP Function）**，环境 `offnav-2026-d6gvnsynj3c561411`，地域 `ap-singapore`。

访问地址：https://offnav-2026-d6gvnsynj3c561411-1485365421.ap-singapore.app.tcloudbase.com/offnav

**为什么是云函数而不是云托管**：当前环境是体验版套餐，不含云托管资源（`CreateCloudRunServer` 报「云托管资源未开通」）；静态网站托管的 Git 部署走的是 `static-hosting`，没有 Node 进程，而本项目 8 个 API 路由全是服务端渲染。`deploy/Dockerfile` 保留了容器路径，套餐升级后可直接切回，代码无需改动。

**Node 18 兼容层**：云函数运行时最高 Node 18.15，而 Next 16 要求 >= 20.9、Next 14 要求 >= 18.17。因此固定 Next 15.5.25，并通过 `node --require deploy/node18-polyfill.cjs` 补两个缺失能力：`AsyncLocalStorage.snapshot`（Node 18.16 才有，Next 服务端渲染路径依赖）与 `File` 全局（Node 20 才有，解析 multipart 表单时引用）。缺前者会让所有 API 路由 500 而静态页面正常，缺后者只影响文件上传。

数据库五张表（`users` / `sessions` / `oauth_states` / `zhihu_search_cache` / `nav_results`）已建好，`lib/db/schema.sql` 是 schema 参考与灾备重建用的存档，不是待执行的建表步骤。

需在云托管服务的环境变量里配置（**值不入仓库**）：

```
DEFAULT_PROVIDER=zhihu
ZHIHU_ZHIDA_MODEL=zhida-fast-1p5
ANTHROPIC_MODEL=claude-sonnet-5
ANTHROPIC_BASE_URL=<Anthropic 或兼容中转站>
CLOUDBASE_API_BASE=https://offnav-2026-d6gvnsynj3c561411.api.intl.tcloudbasegateway.com
ZHIHU_ACCESS_SECRET=<机密>
ANTHROPIC_AUTH_TOKEN=<机密>
CLOUDBASE_SERVER_API_KEY=<机密>
```

OAuth 的 `ZHIHU_OAUTH_APP_ID` / `APP_KEY` 由赛事页面在提交项目时生成；`ZHIHU_OAUTH_REDIRECT_URI` 须填 `https://<部署域名>/auth/callback`，且与赛事页面登记值完全一致（协议、域名、端口、路径、尾斜杠）。
