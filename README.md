# Agent Skill Hub Patterns · Agent 技能中心手册

> 不是 Agent 不会干活，是没人把能力装进工具箱。
>
> Your agent is not incapable. Nobody put the tools in a toolbox.

面向工程师与平台架构师的 **AI Agent 技能中心 / 技能市场工程模式完全手册**：把「Agent 的技能怎么注册、分发、管控、计费」拆成可实现的模式、可运行的代码和可复用的避坑清单。

- 在线阅读（中文）：https://yuxinrun.github.io/agent-skillhub-patterns/
- 在线阅读（English）：https://yuxinrun.github.io/agent-skillhub-patterns/en/
- 仓库：https://github.com/yuxinrun/agent-skillhub-patterns

---

## 这是什么

大多数团队做 Agent，第一年都在重复同一件事：**每个人写一遍同样的查订单工具，每个团队各存一份，改一次要通知十个人。**

等技能攒到几十个，新的问题接踵而来：谁在用旧版本、谁能调退款、出问题查不到是谁调的、第三方技能跑起来会不会偷数据。

这个站点不讲「Agent 多智能」这种玄学，只回答六个工程问题：

**技能怎么注册 → 怎么分发 → 谁能看 → 谁在调 → 出错怎么办 → 怎么计费。**

并且反复强调一条容易被糊过去的边界：

```text
MCP 是协议标准        Skill Hub 是管理平台
Tool 是单个工具        Skill 是打包好的可复用能力
```

## 适合谁读

| 角色 | 你能拿到什么 |
| --- | --- |
| 零基础 / 产品 | 看懂技能、工具、MCP、Agent 的关系，和工程师说同一种语言 |
| AI 应用开发者 | 一周内跑通最小 Skill Hub，知道每一层为什么存在 |
| 后端 / 平台工程师 | 落地注册发现、权限、沙箱、审计、计费与灰度发布 |
| 架构师 / SaaS 创业者 | 完整分层架构、选型对照表与可直接抄的上线路线图 |

## 内容结构

16 章，从「为什么你的 Agent 永远在重复造轮子」一路讲到「技能交易、自主进化与可信认证」。

| # | 章节 | 关键词 |
| --- | --- | --- |
| 00 | 开篇 | 团队代价、应用商店类比、四者关系图、技术栈位置、10 大痛点 |
| 01 | 核心概念 | Tool vs Skill、复用/管控/安全、公共市场 vs 私有中心、演进路线 |
| 02 | 架构分层 | 接入、注册发现、权限管控、执行、运营、数据六层 + 调用时序 |
| 03 | 元数据规范 | 必填字段、描述怎么写、JSON Schema 校验、统一错误码、标签体系 |
| 04 | 生命周期 | 开发、发布、灰度、上线、运维、下线、回滚与 SemVer 兼容判定 |
| 05 | 八大落地模式 | 代理转发、本地执行、远程服务、沙箱、组合、工作流、多租户、计费 |
| 06 | 安全与沙箱 | 权限模型、脱敏、三种沙箱、恶意技能防护、审批、哈希链审计、合规 |
| 07 | 发现与匹配 | 关键词 + 语义混合检索、渐进式加载、个性化推荐、评分排序 |
| 08 | MCP 深度融合 | Server 一键接入、Hub 当注册中心、API 自动转 MCP、多服务聚合 |
| 09 | 生态联动 | better-agent、a2a、memory、gateway、observability、evaluation |
| 10 | 选型对比 | 纯 MCP、平台自带、自研底座、云厂商，中小企业最小方案 |
| 11 | 部署与运维 | Compose 单机、K8s 集群、告警、备份容灾、运营看板、版本灰度 |
| 12 | 踩坑清单 | 描述糊、上下文爆炸、不可信代码、版本失控、无审计、越权、重试风暴 |
| 13 | 可运行 Demo | Python 最小 Hub、MCP 接入、LangGraph 加载、Docker 沙箱、看板、校验 |
| 14 | 性能与扩展 | 三层缓存、结果缓存、异步回调、限流熔断、多区域、冷启动 |
| 15 | 未来趋势 | 技能交易与分成、自主进化、A2A 互通、安全认证与可信评级 |

附录：[阅读指南](https://yuxinrun.github.io/agent-skillhub-patterns/reading/) · [术语表](https://yuxinrun.github.io/agent-skillhub-patterns/glossary/)

每章标配：生活类比 + 架构/流程图 + 对比表 + 看板样例 + 避坑清单 + 可运行代码 + 官方来源（新标签页直达原文）。

## 生态矩阵

八个站点，统一视觉风格、互相导流，拼成一套企业级 Agent 技术栈：

| 站点 | 负责什么 | 地址 |
| --- | --- | --- |
| **better-agent** | 单 Agent 的循环、工具、上下文、上线 | https://yuxinrun.github.io/better-agent/ |
| **mcp-patterns** | 工具调用的协议标准与权限 | https://yuxinrun.github.io/mcp-patterns/ |
| **agent-skillhub-patterns**（本站） | 能力怎么注册、分发、管控、计费 | https://yuxinrun.github.io/agent-skillhub-patterns/ |
| **a2a-patterns** | 多 Agent 之间怎么发现、委派、协作 | https://yuxinrun.github.io/a2a-patterns/ |
| **agent-memory-patterns** | Agent 怎么记住事 | https://yuxinrun.github.io/agent-memory-patterns/ |
| **agent-observability-patterns** | 追踪、指标、日志与成本 | https://yuxinrun.github.io/agent-observability-patterns/ |
| **agent-evaluation-patterns** | 数据集、判分器与上线门禁 | https://yuxinrun.github.io/agent-evaluation-patterns/ |
| **llm-gateway-patterns** | 模型路由、限流、成本与审计 | https://yuxinrun.github.io/llm-gateway-patterns/ |

```text
调度（better-agent）→ 协议（mcp）→ 技能（本站）→ 通信（a2a）
      ↓                                              ↓
   记忆（memory） ← 观测（observability） ← 网关（llm-gateway）
                        ↑
                   评估（evaluation）
```

## 技术栈

- **VitePress**（最新稳定版）+ Vue 3 自定义主题
- 全站 **中英双语**（根路径中文 / `/en/` 英文），一键切换、保留当前位置
- **明暗主题**：跟随系统 + 手动切换，切换时全局平滑过渡
- **动效**：入场淡入、卡片悬浮、代码块柔光、目录滚动高亮、图表渐现、返回顶部平滑（均遵循 `prefers-reduced-motion`）
- **代码块**：行号、一键复制、语法高亮
- **站内搜索**：构建期生成索引（`scripts/build-search.mjs`），客户端打分排序
- **图解系统**：`<Diagram id="..." />` 组件 + `data/diagrams.ts` 单源双语数据，支持 flow / layers / sequence / lifecycle / compare / hub / matrix 七种视图
- **目录中枢**：`data/catalog.ts` 驱动侧边栏、面包屑、章节地图、上下章导航

## 本地开发

```bash
npm install       # 安装依赖
npm run dev       # 本地预览，默认 http://localhost:5182
npm run build     # 构建（会先生成搜索索引，产物在 docs/.vitepress/dist）
npm run preview   # 预览构建产物
```

要求 Node.js 18+（推荐 20 或以上）。

## 目录结构

```text
.
├─ .github/workflows/deploy.yml   # GitHub Pages 自动部署
├─ docs/
│  ├─ .vitepress/
│  │  ├─ config.mts               # 站点配置：base / 双语 / 导航 / 侧边栏
│  │  ├─ data/
│  │  │  ├─ catalog.ts            # 16 章目录中枢（中英标题与锚点）
│  │  │  ├─ diagrams.ts           # 40+ 张双语图解
│  │  │  └─ ecosystem.ts          # 八站生态矩阵
│  │  └─ theme/                   # 自定义主题：组件、样式、布局
│  ├─ public/                     # logo、favicon、hero 插画、搜索索引
│  ├─ index.md                    # 中文首页
│  ├─ intro/ concepts/ architecture/ metadata/
│  ├─ lifecycle/ patterns/ security/ discovery/
│  ├─ mcp/ ecosystem/ landscape/ deploy/
│  ├─ pitfalls/ demos/ performance/ future/
│  ├─ glossary/ reading/ start/   # 附录与阅读指南
│  └─ en/                         # 英文站点（结构与中文一一对应）
└─ scripts/build-search.mjs       # 构建期搜索索引生成
```

## 内容规范

- 所有章节中英双语，**锚点 id 严格一致**（由 `catalog.ts` 单点定义）
- 每章标配：生活类比 / 架构图 / 对比表 / 看板样例 / 避坑清单 / 可运行代码
- 所有高深概念都配【人话翻译】与生活化类比
- 来源统一用 `<Source>` 组件渲染，**新标签页打开官方原文**，每章末尾汇总一组【参考来源】
- Demo 代码不依赖框架即可运行，模型调用统一抽成可替换的客户端；示例仅用于教学
- 内容参考 Anthropic Agent Skills 与工具设计文档、OpenAI Function Calling / GPT Actions、LangChain & LangGraph 工具规范、MCP 官方规范与 Registry、A2A 规范、SLSA / Sigstore、OWASP LLM Top 10，以及 Dify / FastGPT 等开源平台与国内社区落地文章

## 部署

推送到 `main` 分支即自动部署到 GitHub Pages：

1. 仓库 Settings → Pages → Source 选择 **GitHub Actions**
2. `.github/workflows/deploy.yml` 使用 `npm ci` + `npm run build` + `deploy-pages`
3. 站点地址：`https://yuxinrun.github.io/agent-skillhub-patterns/`

若仓库名变更，请同步修改 `docs/.vitepress/config.mts` 中的 `base` 与 `sitemap.hostname`，以及首页中的绝对路径链接。

## 许可

MIT © [鱼心 · Yuxin](https://yuxin.run) ｜ 鱼心快跑，Bug追不到 / Yuxin Rush, Bugs Gone
