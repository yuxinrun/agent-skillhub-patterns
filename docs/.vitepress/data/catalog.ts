/**
 * 全站目录中枢：侧边栏、面包屑、首页章节地图、上下章导航都由这里生成。
 * Site catalog: single source of truth for sidebars, breadcrumbs, chapter map.
 */

export interface CatalogSection {
  /** 锚点 id，中英文页面共用 */
  id: string
  zh: string
  en: string
}

export interface CatalogItem {
  num: string
  slug: string
  zhTitle: string
  enTitle: string
  zhLead: string
  enLead: string
  zhTag: string
  enTag: string
  sections: CatalogSection[]
}

export const catalog: CatalogItem[] = [
  {
    num: '00',
    slug: 'intro',
    zhTitle: '开篇：为什么你的 Agent 永远在重复造轮子',
    enTitle: 'Opening: why your agent keeps reinventing the wheel',
    zhLead: '没有 Skill Hub 的团队有多惨、技能中心到底是什么，以及 Skill / Tool / MCP / Agent 的关系。',
    enLead: 'What a team without a skill hub pays, what a skill hub really is, and how Skill, Tool, MCP and Agent relate.',
    zhTag: '零基础友好',
    enTag: 'Beginner friendly',
    sections: [
      { id: 'pain', zh: '没有 Skill Hub 的团队有多惨', en: 'What a team without a hub pays' },
      { id: 'what', zh: '什么是 Skill Hub：AI 的应用商店', en: 'What a skill hub is: an app store for agents' },
      { id: 'relation', zh: 'Skill / Tool / MCP / Agent 终极关系图', en: 'Skill, Tool, MCP, Agent: the real map' },
      { id: 'stack', zh: '技能中心在技术栈里的位置', en: 'Where the hub sits in the stack' },
      { id: 'promise', zh: '本手册解决的 10 大生产痛点', en: 'Ten production problems this book solves' },
      { id: 'eco', zh: '整套生态如何联动', en: 'How the whole ecosystem fits' },
    ],
  },
  {
    num: '01',
    slug: 'concepts',
    zhTitle: '核心概念彻底搞懂',
    enTitle: 'Core concepts, settled',
    zhLead: 'Tool 与 Skill 的边界、技能中心的三大价值、公共市场与内部中心、从单工具到技能中心的演进。',
    enLead: 'Tool versus skill, the three values of a hub, public marketplace versus internal registry, and the evolution path.',
    zhTag: '概念地基',
    enTag: 'Foundations',
    sections: [
      { id: 'toolskill', zh: 'Tool 工具 vs Skill 技能', en: 'Tool versus skill' },
      { id: 'value', zh: '技能中心的三大价值', en: 'The three values of a hub' },
      { id: 'publicprivate', zh: '公共 Hub vs 私有 Hub', en: 'Public versus private hubs' },
      { id: 'marketvscenter', zh: '技能市场 vs 技能中心', en: 'Marketplace versus registry' },
      { id: 'evolution', zh: '从工具调用到技能中心', en: 'From one call to a hub' },
      { id: 'boundary', zh: '四条最容易踩错的边界', en: 'Four boundaries people blur' },
    ],
  },
  {
    num: '02',
    slug: 'architecture',
    zhTitle: '技能中心核心架构分层',
    enTitle: 'The layered architecture',
    zhLead: '接入、注册发现、权限、执行、运营、数据六层，每层的职责、接口与失败模式。',
    enLead: 'Access, registry, permissions, execution, operations and data — responsibilities, interfaces and failure modes.',
    zhTag: '架构全景',
    enTag: 'Architecture',
    sections: [
      { id: 'access', zh: '接入层：SDK、MCP、REST', en: 'Access: SDK, MCP, REST' },
      { id: 'registry', zh: '注册发现层：元数据与检索', en: 'Registry: metadata and search' },
      { id: 'permission', zh: '权限管控层：鉴权与租户', en: 'Permissions: auth and tenancy' },
      { id: 'execute', zh: '执行层：沙箱与转发', en: 'Execution: sandbox and proxy' },
      { id: 'ops', zh: '运营管理层：版本与计费', en: 'Operations: versions and billing' },
      { id: 'data', zh: '数据层：元数据、日志、审计', en: 'Data: metadata, logs, audit' },
    ],
  },
  {
    num: '03',
    slug: 'metadata',
    zhTitle: '技能元数据与标准化规范',
    enTitle: 'Skill metadata and schemas',
    zhLead: '必填字段、描述写法、JSON Schema 校验、错误码规范、标签体系与完整生产示例。',
    enLead: 'Required fields, description craft, JSON Schema validation, error codes, taxonomy and a full production manifest.',
    zhTag: '地基工程',
    enTag: 'Groundwork',
    sections: [
      { id: 'fields', zh: '元数据必填字段', en: 'Required fields' },
      { id: 'describe', zh: '描述怎么写才不被乱调', en: 'Descriptions that prevent misuse' },
      { id: 'validate', zh: '入参校验规范', en: 'Input validation' },
      { id: 'errors', zh: '错误码标准化', en: 'Standard error codes' },
      { id: 'taxonomy', zh: '分类与标签体系', en: 'Categories and tags' },
      { id: 'examples', zh: '最小示例与生产示例', en: 'Minimal and production examples' },
    ],
  },
  {
    num: '04',
    slug: 'lifecycle',
    zhTitle: '技能生命周期全流程',
    enTitle: 'The skill lifecycle',
    zhLead: '开发、发布、灰度、上线、运维、下线、回滚：七个阶段的门禁、字段与操作手册。',
    enLead: 'Develop, publish, canary, launch, operate, sunset, roll back — gates and runbooks for all seven stages.',
    zhTag: '标准流程',
    enTag: 'Standard flow',
    sections: [
      { id: 'dev', zh: '开发阶段：本地跑通', en: 'Develop locally' },
      { id: 'publish', zh: '发布阶段：版本与兼容', en: 'Publish: versions and compat' },
      { id: 'canary', zh: '灰度阶段：白名单放量', en: 'Canary: whitelist ramps' },
      { id: 'ga', zh: '正式上线：全量与通知', en: 'Launch: full rollout' },
      { id: 'ops', zh: '运维阶段：监控与容量', en: 'Operate: monitoring and capacity' },
      { id: 'sunset', zh: '下线阶段：弃用与归档', en: 'Sunset: deprecate and archive' },
      { id: 'rollback', zh: '版本回滚：一键切回', en: 'Rollback in one click' },
    ],
  },
  {
    num: '05',
    slug: 'patterns',
    zhTitle: '八大核心工程落地模式',
    enTitle: 'Eight production patterns',
    zhLead: '代理转发、本地执行、远程服务、沙箱隔离、组合技能、工作流技能、多租户、计费配额。',
    enLead: 'Proxy, local execution, remote service, sandbox, composition, workflow, tenancy and metering.',
    zhTag: '模式核心',
    enTag: 'Pattern core',
    sections: [
      { id: 'proxy', zh: '代理转发模式', en: 'Proxy forwarding' },
      { id: 'local', zh: '本地执行模式', en: 'Local execution' },
      { id: 'remote', zh: '远程服务模式', en: 'Remote service' },
      { id: 'sandbox', zh: '沙箱隔离模式', en: 'Sandbox isolation' },
      { id: 'compose', zh: '组合技能模式', en: 'Composite skills' },
      { id: 'workflow', zh: '工作流技能模式', en: 'Workflow skills' },
      { id: 'tenancy', zh: '多租户隔离模式', en: 'Multi-tenant isolation' },
      { id: 'billing', zh: '计费配额模式', en: 'Metering and quotas' },
    ],
  },
  {
    num: '06',
    slug: 'security',
    zhTitle: '安全、权限与沙箱体系',
    enTitle: 'Security, permissions, sandboxes',
    zhLead: '权限模型、数据脱敏、三种沙箱、恶意技能防护、审批流、审计追溯与合规。',
    enLead: 'Permission models, masking, three sandbox types, hostile skills, approvals, audit and compliance.',
    zhTag: '企业必看',
    enTag: 'Enterprise must',
    sections: [
      { id: 'model', zh: '技能权限模型', en: 'The permission model' },
      { id: 'data', zh: '数据安全：脱敏与过滤', en: 'Data safety: mask and filter' },
      { id: 'sandbox', zh: '三种沙箱怎么选', en: 'Choosing a sandbox' },
      { id: 'abuse', zh: '恶意技能防护', en: 'Defending against hostile skills' },
      { id: 'approval', zh: '审批流程与门禁', en: 'Approvals and release gates' },
      { id: 'audit', zh: '审计追溯：全量留痕', en: 'Audit: full traceability' },
      { id: 'compliance', zh: '合规要求与第三方声明', en: 'Compliance and vendor claims' },
    ],
  },
  {
    num: '07',
    slug: 'discovery',
    zhTitle: '技能发现、匹配与推荐',
    enTitle: 'Discovery, matching, ranking',
    zhLead: '混合检索、启动时发现、按需加载、个性化推荐、评分排序，以及技能过载反模式。',
    enLead: 'Hybrid retrieval, startup discovery, lazy loading, personalisation, ranking and the overload anti-pattern.',
    zhTag: '可用性关键',
    enTag: 'Usability',
    sections: [
      { id: 'hybrid', zh: '关键词 + 语义混合匹配', en: 'Keyword plus semantic matching' },
      { id: 'autodiscover', zh: 'Agent 启动时自动发现', en: 'Discovery at startup' },
      { id: 'lazy', zh: '动态加载与上下文预算', en: 'Lazy loading under a budget' },
      { id: 'recommend', zh: '个性化推荐', en: 'Personalised recommendations' },
      { id: 'ranking', zh: '评分与排序公式', en: 'Scoring and ranking' },
      { id: 'antipattern', zh: '反模式：技能过载', en: 'Anti-pattern: skill overload' },
    ],
  },
  {
    num: '08',
    slug: 'mcp',
    zhTitle: '与 MCP 协议深度融合',
    enTitle: 'Deep integration with MCP',
    zhLead: 'MCP Server 一键接入、Hub 当注册中心、传统 API 自动包装、三类能力管理与多服务聚合。',
    enLead: 'One-click onboarding, the hub as registry, wrapping legacy APIs, three capability types and aggregation.',
    zhTag: '协议联动',
    enTag: 'Protocol bridge',
    sections: [
      { id: 'bridge', zh: 'MCP Server 一键接入', en: 'Onboarding an MCP server' },
      { id: 'registry', zh: 'Hub 作为 MCP 注册中心', en: 'The hub as an MCP registry' },
      { id: 'wrap', zh: '传统 API 自动包装成 MCP', en: 'Wrapping legacy APIs' },
      { id: 'three', zh: '工具 / 资源 / 提示三类能力', en: 'Tools, resources, prompts' },
      { id: 'aggregate', zh: '多 MCP 服务聚合', en: 'Aggregating many servers' },
    ],
  },
  {
    num: '09',
    slug: 'ecosystem',
    zhTitle: '与全生态组件联动',
    enTitle: 'Wiring into the ecosystem',
    zhLead: '调度框架如何动态加载技能、跨 Agent 共享、记忆与网关联动、全链路追踪与评测门禁。',
    enLead: 'How orchestration loads skills, cross-agent sharing, memory and gateway wiring, tracing and eval gates.',
    zhTag: '生态打通',
    enTag: 'Integration',
    sections: [
      { id: 'betteragent', zh: 'better-agent：调度层加载技能', en: 'better-agent: loading skills in the loop' },
      { id: 'a2a', zh: 'a2a-patterns：跨 Agent 共享技能', en: 'a2a-patterns: sharing skills across agents' },
      { id: 'memory', zh: 'agent-memory-patterns：记忆型技能', en: 'agent-memory-patterns: memory skills' },
      { id: 'gateway', zh: 'llm-gateway-patterns：调用走网关', en: 'llm-gateway-patterns: traffic through the gateway' },
      { id: 'observability', zh: 'agent-observability-patterns：全链路追踪', en: 'agent-observability-patterns: tracing' },
      { id: 'evaluation', zh: 'agent-evaluation-patterns：上线门禁', en: 'agent-evaluation-patterns: release gates' },
    ],
  },
  {
    num: '10',
    slug: 'landscape',
    zhTitle: '主流方案与选型对比',
    enTitle: 'The landscape and how to choose',
    zhLead: '纯 MCP 生态、平台自带市场、自研底座、云厂商方案，以及中小企业的最小推荐。',
    enLead: 'Pure MCP ecosystems, platform marketplaces, DIY bases, cloud offerings and the smallest viable choice.',
    zhTag: '选型必备',
    enTag: 'Selection guide',
    sections: [
      { id: 'mcp', zh: '纯 MCP 生态方案', en: 'Pure MCP ecosystems' },
      { id: 'platform', zh: 'Agent 平台自带市场', en: 'Platform marketplaces' },
      { id: 'diy', zh: '自研轻量底座', en: 'A light DIY base' },
      { id: 'cloud', zh: '云厂商方案', en: 'Cloud vendor options' },
      { id: 'matrix', zh: '完整选型对照表', en: 'The full comparison matrix' },
      { id: 'smb', zh: '中小企业最小推荐', en: 'The smallest viable stack' },
    ],
  },
  {
    num: '11',
    slug: 'deploy',
    zhTitle: '生产级部署与运维',
    enTitle: 'Deploying and operating',
    zhLead: '单机 Compose、集群高可用、监控告警、备份容灾、运营看板与灰度切流。',
    enLead: 'Single-node Compose, clustered HA, alerting, backups, dashboards and traffic-shaped rollouts.',
    zhTag: '上线必备',
    enTag: 'Ship it',
    sections: [
      { id: 'single', zh: '单机部署：Compose 起步', en: 'Single node with Compose' },
      { id: 'cluster', zh: '集群部署：无状态扩展', en: 'Cluster: stateless scale-out' },
      { id: 'monitor', zh: '监控告警四件套', en: 'Monitoring and alerting' },
      { id: 'backup', zh: '备份容灾与归档', en: 'Backups and disaster recovery' },
      { id: 'dashboard', zh: '运营看板：谁在用、用多少', en: 'Dashboards: who uses what' },
      { id: 'canary', zh: '灰度发布与流量切分', en: 'Canary releases and traffic splits' },
    ],
  },
  {
    num: '12',
    slug: 'pitfalls',
    zhTitle: '高频生产踩坑血泪清单',
    enTitle: 'The production pitfall catalog',
    zhLead: '描述写不好、技能过载、第三方不可信、版本失控、没有审计、权限越界、重试风暴。',
    enLead: 'Bad descriptions, skill overload, untrusted vendors, version drift, missing audit, privilege creep, retry storms.',
    zhTag: '血泪经验',
    enTag: 'Scars included',
    sections: [
      { id: 'desc', zh: '描述写不好，Agent 乱调用', en: 'Bad descriptions, wrong calls' },
      { id: 'explosion', zh: '技能太多，上下文爆炸', en: 'Too many skills, no context' },
      { id: 'untrusted', zh: '第三方技能偷数据', en: 'Untrusted skills exfiltrating data' },
      { id: 'version', zh: '没有版本管理，集体报错', en: 'No versions, global outage' },
      { id: 'noaudit', zh: '没有审计，查不到是谁', en: 'No audit, no accountability' },
      { id: 'privilege', zh: '权限失控，越权调用', en: 'Privilege creep and abuse' },
      { id: 'retry', zh: '重试风暴打挂下游', en: 'Retry storms take down downstream' },
    ],
  },
  {
    num: '13',
    slug: 'demos',
    zhTitle: '可直接运行的实战 Demo',
    enTitle: 'Runnable demos',
    zhLead: '最简 Python Hub、MCP 接入、LangGraph 动态加载、Docker 沙箱、审计看板、Compose 部署与校验模板。',
    enLead: 'A minimal Python hub, MCP onboarding, LangGraph loading, Docker sandbox, audit dashboard, Compose and schemas.',
    zhTag: '可复制',
    enTag: 'Copy-ready',
    sections: [
      { id: 'minimal', zh: '最简 Python Skill Hub', en: 'Minimal Python hub' },
      { id: 'mcp', zh: 'MCP Server 接入示例', en: 'MCP server onboarding' },
      { id: 'langgraph', zh: 'LangGraph 动态加载技能', en: 'LangGraph dynamic loading' },
      { id: 'sandbox', zh: 'Docker 沙箱执行 Demo', en: 'Docker sandbox demo' },
      { id: 'audit', zh: '审计日志与统计看板', en: 'Audit log and dashboard' },
      { id: 'compose', zh: 'Docker Compose 一键部署', en: 'One-command Compose deploy' },
      { id: 'schema', zh: '元数据模板与校验', en: 'Manifest template and validation' },
    ],
  },
  {
    num: '14',
    slug: 'performance',
    zhTitle: '性能优化与大规模扩展',
    enTitle: 'Performance at scale',
    zhLead: '元数据缓存、热门结果缓存、异步回调、限流熔断、多区域部署与冷启动预热。',
    enLead: 'Metadata caching, hot-result caches, async callbacks, rate limits, multi-region and cold starts.',
    zhTag: '规模化',
    enTag: 'At scale',
    sections: [
      { id: 'cache', zh: '元数据缓存与增量拉取', en: 'Metadata caches and delta sync' },
      { id: 'hotcache', zh: '热门技能结果缓存', en: 'Hot result caching' },
      { id: 'async', zh: '异步调用与回调', en: 'Async calls and callbacks' },
      { id: 'ratelimit', zh: '限流、熔断与隔离', en: 'Rate limits, breakers, bulkheads' },
      { id: 'region', zh: '多区域部署与就近访问', en: 'Multi-region and locality' },
      { id: 'coldstart', zh: '冷启动优化与预热', en: 'Cold starts and warm pools' },
    ],
  },
  {
    num: '15',
    slug: 'future',
    zhTitle: '生态延伸与未来趋势',
    enTitle: 'Where this is going',
    zhLead: '技能交易与分成、自主技能进化、跨平台互通、安全认证与可信评级。',
    enLead: 'Skill marketplaces, autonomous skill evolution, cross-platform interop, certification and trust ratings.',
    zhTag: '收官',
    enTag: 'Wrap-up',
    sections: [
      { id: 'market', zh: '技能交易市场与分成', en: 'Skill marketplaces and revenue share' },
      { id: 'evolution', zh: '自主技能进化', en: 'Autonomous skill evolution' },
      { id: 'crossplatform', zh: 'A2A + Skill Hub 跨平台互通', en: 'A2A plus skill hubs across platforms' },
      { id: 'certification', zh: '安全认证与可信评级', en: 'Certification and trust ratings' },
    ],
  },
]

export const chapterPath = (item: CatalogItem, lang: 'zh' | 'en') =>
  `${lang === 'en' ? '/en' : ''}/${item.slug}/`

export const findChapter = (slug: string) => catalog.find((c) => c.slug === slug)

/** 上一章 / 下一章，供自定义导航与首页使用 */
export const neighbors = (slug: string) => {
  const i = catalog.findIndex((c) => c.slug === slug)
  return {
    prev: i > 0 ? catalog[i - 1] : undefined,
    next: i >= 0 && i < catalog.length - 1 ? catalog[i + 1] : undefined,
  }
}
