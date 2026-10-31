/**
 * 全站手写图解数据：中英双语只写一份，组件按当前语言渲染。
 * All hand-drawn diagrams, bilingual, single source.
 * 组件会自动适配明暗主题与移动端。
 */

export type Tone = 'accent' | 'coral' | 'blue' | 'lime' | 'muted'

export interface FlowNode {
  t: string
  s?: string
  tone?: Tone
}

export type DiagramSpec =
  | {
      kind: 'flow'
      caption: { zh: string; en: string }
      zh: { nodes: FlowNode[]; edges?: string[]; dir?: 'h' | 'v' }
      en: { nodes: FlowNode[]; edges?: string[]; dir?: 'h' | 'v' }
    }
  | {
      kind: 'layers'
      caption: { zh: string; en: string }
      zh: { layers: { t: string; items: string[]; tone?: Tone; note?: string }[] }
      en: { layers: { t: string; items: string[]; tone?: Tone; note?: string }[] }
    }
  | {
      kind: 'sequence'
      caption: { zh: string; en: string }
      zh: { actors: string[]; steps: { from: number; to: number; t: string; dashed?: boolean }[] }
      en: { actors: string[]; steps: { from: number; to: number; t: string; dashed?: boolean }[] }
    }
  | {
      kind: 'lifecycle'
      caption: { zh: string; en: string }
      zh: { states: { t: string; s: string; tone?: Tone }[]; note?: string }
      en: { states: { t: string; s: string; tone?: Tone }[]; note?: string }
    }
  | {
      kind: 'compare'
      caption: { zh: string; en: string }
      zh: { left: { title: string; sub: string; points: string[] }; right: { title: string; sub: string; points: string[] }; axis?: string }
      en: { left: { title: string; sub: string; points: string[] }; right: { title: string; sub: string; points: string[] }; axis?: string }
    }
  | {
      kind: 'hub'
      caption: { zh: string; en: string }
      zh: { center: string; nodes: string[]; mode?: 'star' | 'broadcast' | 'cycle'; note?: string }
      en: { center: string; nodes: string[]; mode?: 'star' | 'broadcast' | 'cycle'; note?: string }
    }
  | {
      kind: 'matrix'
      caption: { zh: string; en: string }
      zh: { head: string[]; rows: string[][]; highlight?: number[] }
      en: { head: string[]; rows: string[][]; highlight?: number[] }
    }

export const diagrams: Record<string, DiagramSpec> = {
  /* ---------------- 00 开篇 ---------------- */
  wheel: {
    kind: 'flow',
    caption: {
      zh: '同一个「查订单」工具，被四个团队各写了一遍——这不是勤奋，是能力没有地方沉淀。',
      en: 'Four teams each wrote the same "look up order" tool. That is not diligence, it is capability with nowhere to live.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: 'A 团队', s: '写一个查订单工具', tone: 'accent' },
        { t: 'B 团队', s: '再写一个，字段还不一样', tone: 'blue' },
        { t: 'C 团队', s: '照抄 A 的旧版本', tone: 'lime' },
        { t: '线上事故', s: '三套实现，三种 bug', tone: 'coral' },
      ],
      edges: ['三个月后', '又三个月', '同时爆发'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Team A', s: 'builds an order lookup tool', tone: 'accent' },
        { t: 'Team B', s: 'rebuilds it, different fields', tone: 'blue' },
        { t: 'Team C', s: 'copies A\'s stale version', tone: 'lime' },
        { t: 'Incident', s: 'three builds, three bugs', tone: 'coral' },
      ],
      edges: ['three months later', 'three more', 'all at once'],
    },
  },
  'four-roles': {
    kind: 'matrix',
    caption: {
      zh: '四个词天天被混着用。记住一句话：Tool 是螺丝刀，Skill 是「修水龙头」这套本事，MCP 是插座标准，Agent 是上门师傅。',
      en: 'Four words used interchangeably. One line: a tool is a screwdriver, a skill is "fix the tap", MCP is the socket standard, the agent is the plumber.',
    },
    zh: {
      head: ['名词', '一句话定义', '归属', '典型例子'],
      rows: [
        ['Tool 工具', '一个可被调用的函数', '代码 / 服务', 'get_order(order_id)'],
        ['Skill 技能', '带说明、参数、权限的可复用能力包', '技能中心', 'order-support@1.4.0'],
        ['MCP', '把工具暴露给模型的通信协议', '协议标准', 'tools/list、tools/call'],
        ['Agent', '会规划、会挑工具的执行者', '运行时', '客服 Agent'],
      ],
      highlight: [1],
    },
    en: {
      head: ['Term', 'One-line definition', 'Owned by', 'Example'],
      rows: [
        ['Tool', 'A callable function', 'Code / service', 'get_order(order_id)'],
        ['Skill', 'A reusable capability pack with docs, schema and policy', 'The hub', 'order-support@1.4.0'],
        ['MCP', 'A protocol that exposes tools to models', 'Specification', 'tools/list, tools/call'],
        ['Agent', 'The planner that picks and calls tools', 'Runtime', 'support agent'],
      ],
      highlight: [1],
    },
  },
  'hub-stack': {
    kind: 'layers',
    caption: {
      zh: '技能中心不是「一个数据库」，而是夹在 Agent 和外部世界之间的一层能力中台。',
      en: 'A skill hub is not a database. It is a capability layer sitting between agents and the outside world.',
    },
    zh: {
      layers: [
        { t: '消费方', items: ['客服 Agent', '编码助手', '工作流引擎', '第三方应用'], tone: 'blue' },
        { t: '技能中心（承上启下）', items: ['注册与目录', '权限与租户', '版本与灰度', '沙箱与执行', '审计与计费'], tone: 'accent', note: '本手册的主角' },
        { t: '技能实现', items: ['内部 API', 'MCP Server', 'Serverless 函数', '第三方 SaaS'], tone: 'lime' },
        { t: '外部世界', items: ['数据库', '业务系统', '公开互联网', '企业知识库'], tone: 'muted' },
      ],
    },
    en: {
      layers: [
        { t: 'Consumers', items: ['Support agent', 'Coding copilot', 'Workflow engine', 'Third-party apps'], tone: 'blue' },
        { t: 'Skill hub (the middle)', items: ['Registry', 'Permissions', 'Versions', 'Sandbox', 'Audit & metering'], tone: 'accent', note: 'the subject of this book' },
        { t: 'Implementations', items: ['Internal APIs', 'MCP servers', 'Serverless functions', 'Vendor SaaS'], tone: 'lime' },
        { t: 'The outside world', items: ['Databases', 'Business systems', 'The public web', 'Knowledge bases'], tone: 'muted' },
      ],
    },
  },
  'eco-hub': {
    kind: 'hub',
    caption: {
      zh: '技能中心是「能力仓库」，调度、通信、记忆、网关、观测、评估都从它这里取货。',
      en: 'The hub is the capability warehouse. Orchestration, messaging, memory, gateway, observability and evals all pick from it.',
    },
    zh: {
      center: 'Skill Hub',
      nodes: ['better-agent 调度', 'mcp-patterns 协议', 'a2a-patterns 共享', 'memory 记忆', 'gateway 流量', 'observability 追踪', 'evaluation 评测'],
      mode: 'star',
      note: '八个仓库共用一套租户 ID、技能 ID 与调用链 ID，否则对不上账。',
    },
    en: {
      center: 'Skill Hub',
      nodes: ['better-agent loop', 'mcp-patterns protocol', 'a2a-patterns sharing', 'memory', 'gateway traffic', 'observability traces', 'evaluation gates'],
      mode: 'star',
      note: 'All eight repos share one tenant id, skill id and trace id — otherwise the books never reconcile.',
    },
  },

  /* ---------------- 01 核心概念 ---------------- */
  'tool-vs-skill': {
    kind: 'compare',
    caption: {
      zh: 'Tool 解决「能不能调」，Skill 解决「该不该调、谁来调、调多少次、出错怎么办」。',
      en: 'A tool answers "can it be called"; a skill answers "should it be called, by whom, how often, and what happens on failure".',
    },
    zh: {
      left: {
        title: 'Tool 工具',
        sub: '一个函数，一次调用',
        points: ['只有参数与返回值', '没有版本概念，改了就变', '权限通常由代码硬编码', '出问题只能翻日志'],
      },
      right: {
        title: 'Skill 技能',
        sub: '一个可治理的能力包',
        points: ['描述 + Schema + 权限 + 计费', '语义化版本，可灰度可回滚', '租户 / 角色 / 配额可配', '调用留痕，可审计可评测'],
      },
      axis: '同一个函数，包成技能之后才敢给全公司用',
    },
    en: {
      left: {
        title: 'Tool',
        sub: 'One function, one call',
        points: ['Only arguments and a return value', 'No versions: change is breakage', 'Permissions hard-coded in code', 'Failures live in log files'],
      },
      right: {
        title: 'Skill',
        sub: 'A governable capability pack',
        points: ['Description, schema, policy, metering', 'Semantic versions, canary, rollback', 'Tenant, role and quota aware', 'Every call traceable and testable'],
      },
      axis: 'The same function, only trustworthy company-wide once it is a skill',
    },
  },
  'hub-values': {
    kind: 'layers',
    caption: {
      zh: '技能中心的三大价值：复用省人力、管控防事故、安全兜底线。三者缺一，平台就退化成网盘。',
      en: 'Three values: reuse saves people, governance prevents incidents, safety sets a floor. Miss one and the platform is just a file share.',
    },
    zh: {
      layers: [
        { t: '复用 Reuse', items: ['一次开发多处调用', '避免重复造轮子', '统一 bug 修复'], tone: 'accent', note: '省的是研发人力' },
        { t: '管控 Govern', items: ['版本与灰度', '配额与计费', '上下线与通知'], tone: 'blue', note: '省的是事故成本' },
        { t: '安全 Secure', items: ['最小权限', '沙箱执行', '审计与合规'], tone: 'coral', note: '省的是赔偿与罚款' },
      ],
    },
    en: {
      layers: [
        { t: 'Reuse', items: ['Build once, call everywhere', 'No more duplicate tools', 'One place to fix bugs'], tone: 'accent', note: 'saves engineering time' },
        { t: 'Govern', items: ['Versions and canaries', 'Quotas and metering', 'Launch and sunset'], tone: 'blue', note: 'saves incident cost' },
        { t: 'Secure', items: ['Least privilege', 'Sandboxed execution', 'Audit and compliance'], tone: 'coral', note: 'saves fines and lawsuits' },
      ],
    },
  },
  'public-private': {
    kind: 'matrix',
    caption: {
      zh: '公共 Hub 像 App Store，私有 Hub 像公司内网软件中心。绝大多数企业真正需要的是后者。',
      en: 'A public hub is an app store; a private hub is the internal software centre. Most enterprises actually need the latter.',
    },
    zh: {
      head: ['维度', '公共 Skill Hub', '私有 Skill Hub'],
      rows: [
        ['典型形态', '开源市场、MCP 公共目录', '企业内部能力平台'],
        ['技能来源', '任何人可提交', '内部团队 + 审核过的三方'],
        ['核心难题', '不可信、质量参差', '权限、隔离、重复建设'],
        ['变现方式', '订阅 / 分成 / 引流', '降本、复用率、合规'],
        ['上线门槛', '低，但风险自担', '高，但可控可审计'],
      ],
      highlight: [2],
    },
    en: {
      head: ['Dimension', 'Public hub', 'Private hub'],
      rows: [
        ['Typical form', 'Open marketplace, public MCP index', 'Internal capability platform'],
        ['Who publishes', 'Anyone', 'Internal teams plus vetted vendors'],
        ['Hard problem', 'Trust and quality', 'Permissions, isolation, duplication'],
        ['How it pays', 'Subscription, revenue share, traffic', 'Cost saving, reuse, compliance'],
        ['Barrier', 'Low, but you own the risk', 'High, but controlled and auditable'],
      ],
      highlight: [2],
    },
  },
  evolve: {
    kind: 'lifecycle',
    caption: {
      zh: '能力治理的五级台阶：硬编码工具 → 工具库 → 工具网关 → 技能中心 → 技能生态。别跳级。',
      en: 'Five rungs: hard-coded tool, tool library, tool gateway, skill hub, skill ecosystem. Do not skip rungs.',
    },
    zh: {
      states: [
        { t: 'L1 硬编码', s: '每个 Agent 自己写函数', tone: 'muted' },
        { t: 'L2 工具库', s: '抽成公共包，仍无治理', tone: 'blue' },
        { t: 'L3 工具网关', s: '统一转发、限流、鉴权', tone: 'lime' },
        { t: 'L4 技能中心', s: '元数据、版本、租户、计费', tone: 'accent' },
        { t: 'L5 技能生态', s: '跨团队 / 跨公司交易与认证', tone: 'coral' },
      ],
      note: '多数团队卡在 L2：代码复用了，治理没有。',
    },
    en: {
      states: [
        { t: 'L1 Hard-coded', s: 'every agent writes its own', tone: 'muted' },
        { t: 'L2 Library', s: 'shared package, no governance', tone: 'blue' },
        { t: 'L3 Gateway', s: 'one proxy, rate limits, auth', tone: 'lime' },
        { t: 'L4 Hub', s: 'metadata, versions, tenants, billing', tone: 'accent' },
        { t: 'L5 Ecosystem', s: 'cross-company trade and certification', tone: 'coral' },
      ],
      note: 'Most teams stall at L2: code is shared, governance is not.',
    },
  },

  /* ---------------- 02 架构 ---------------- */
  arch: {
    kind: 'layers',
    caption: {
      zh: '六层架构，任何一层偷懒都会在别处加倍偿还：接入层偷懒，客户端各写一套；权限层偷懒，事故替你补课。',
      en: 'Six layers. Skipping any one is repaid elsewhere: skip access and every client differs; skip permissions and incidents teach you.',
    },
    zh: {
      layers: [
        { t: '接入层', items: ['Agent SDK', 'MCP 适配器', 'REST / JSON-RPC', '控制台 UI'], tone: 'blue' },
        { t: '注册发现层', items: ['元数据存储', '目录与标签', '混合检索', '推荐排序'], tone: 'accent' },
        { t: '权限管控层', items: ['身份鉴权', '租户隔离', '技能白名单', '配额策略'], tone: 'coral' },
        { t: '执行层', items: ['代理转发', '沙箱运行', '超时与重试', '结果归一化'], tone: 'lime' },
        { t: '运营管理层', items: ['版本与灰度', '审批流', '计费账单', '报表看板'], tone: 'blue' },
        { t: '数据层', items: ['元数据库', '调用日志', '审计库', '指标时序库'], tone: 'muted' },
      ],
    },
    en: {
      layers: [
        { t: 'Access', items: ['Agent SDK', 'MCP adapter', 'REST / JSON-RPC', 'Console UI'], tone: 'blue' },
        { t: 'Registry & discovery', items: ['Metadata store', 'Catalogue and tags', 'Hybrid search', 'Ranking'], tone: 'accent' },
        { t: 'Permissions', items: ['Authentication', 'Tenant isolation', 'Allowlists', 'Quotas'], tone: 'coral' },
        { t: 'Execution', items: ['Proxy forwarding', 'Sandbox runtime', 'Timeouts and retries', 'Result normalisation'], tone: 'lime' },
        { t: 'Operations', items: ['Versions and canaries', 'Approvals', 'Billing', 'Dashboards'], tone: 'blue' },
        { t: 'Data', items: ['Metadata DB', 'Invocation logs', 'Audit store', 'Metrics TSDB'], tone: 'muted' },
      ],
    },
  },
  'call-seq': {
    kind: 'sequence',
    caption: {
      zh: '一次技能调用的完整链路：Agent 只认识 Hub，Hub 负责鉴权、选版本、转发、记录与计费。',
      en: 'One invocation end to end: the agent only knows the hub; the hub authenticates, pins a version, forwards, logs and meters.',
    },
    zh: {
      actors: ['Agent', 'Hub 接入层', '策略引擎', '执行层', '技能实现'],
      steps: [
        { from: 1, to: 2, t: 'skills.resolve(name, tenant)' },
        { from: 2, to: 3, t: '校验身份 / 配额 / 白名单' },
        { from: 3, to: 2, t: '放行 + 版本与超时策略' },
        { from: 2, to: 4, t: 'invoke(skill_id@version, args)' },
        { from: 4, to: 5, t: '签名转发 / 沙箱执行' },
        { from: 5, to: 4, t: 'result | error.code', dashed: true },
        { from: 4, to: 2, t: '耗时、结果摘要、用量' },
        { from: 2, to: 1, t: '归一化结果 + trace_id' },
      ],
    },
    en: {
      actors: ['Agent', 'Hub access', 'Policy', 'Execution', 'Implementation'],
      steps: [
        { from: 1, to: 2, t: 'skills.resolve(name, tenant)' },
        { from: 2, to: 3, t: 'identity / quota / allowlist' },
        { from: 3, to: 2, t: 'allow + version and timeout policy' },
        { from: 2, to: 4, t: 'invoke(skill_id@version, args)' },
        { from: 4, to: 5, t: 'signed forward / sandbox run' },
        { from: 5, to: 4, t: 'result | error.code', dashed: true },
        { from: 4, to: 2, t: 'latency, digest, usage' },
        { from: 2, to: 1, t: 'normalised result + trace_id' },
      ],
    },
  },
  'exec-modes': {
    kind: 'compare',
    caption: {
      zh: '代理转发与本地执行不是二选一：可信、稳定、需要计费的走代理；高频、低风险、要低延迟的走本地。',
      en: 'Proxy and local execution are not either/or: trusted, stable, metered calls go through the proxy; hot, low-risk, low-latency calls run locally.',
    },
    zh: {
      left: {
        title: '代理转发',
        sub: 'Hub 统一出入口',
        points: ['鉴权与配额在一处生效', '可灰度、可熔断、可计费', '多一跳，延迟 +5~20ms', 'Hub 挂了全挂，必须高可用'],
      },
      right: {
        title: '本地执行',
        sub: '技能包下发到 Agent 侧',
        points: ['延迟最低，可离线', 'Hub 只做分发与签名', '代码落地，风险面变大', '版本一致性难保证'],
      },
      axis: '真实生产里通常是混合：控制面走 Hub，数据面按技能分级',
    },
    en: {
      left: {
        title: 'Proxy forwarding',
        sub: 'One door for everything',
        points: ['Auth and quotas enforced once', 'Canary, breakers, billing built in', 'One extra hop, +5~20ms', 'Hub down means all down: needs HA'],
      },
      right: {
        title: 'Local execution',
        sub: 'Signed packs shipped to the agent',
        points: ['Lowest latency, works offline', 'Hub only distributes and signs', 'Code lands on hosts: bigger blast radius', 'Version consistency is hard'],
      },
      axis: 'Production is usually hybrid: control plane in the hub, data plane by skill tier',
    },
  },

  /* ---------------- 03 元数据 ---------------- */
  manifest: {
    kind: 'layers',
    caption: {
      zh: '一份技能清单要同时喂给三类读者：Agent 看描述与 Schema，平台看权限与配额，人看文档与负责人。',
      en: 'A manifest feeds three readers: the agent reads description and schema, the platform reads policy and quotas, humans read docs and ownership.',
    },
    zh: {
      layers: [
        { t: '身份 Identity', items: ['name / display_name', 'version / channel', 'owner / team', 'homepage / repo'], tone: 'blue' },
        { t: '契约 Contract', items: ['description', 'input_schema', 'output_schema', 'error_codes'], tone: 'accent', note: 'Agent 主要看这一层' },
        { t: '策略 Policy', items: ['scopes', 'tenant_visibility', 'quota', 'timeout / retry'], tone: 'coral', note: '平台主要看这一层' },
        { t: '运营 Ops', items: ['changelog', 'deprecation', 'sla', 'cost_model'], tone: 'lime' },
      ],
    },
    en: {
      layers: [
        { t: 'Identity', items: ['name / display_name', 'version / channel', 'owner / team', 'homepage / repo'], tone: 'blue' },
        { t: 'Contract', items: ['description', 'input_schema', 'output_schema', 'error_codes'], tone: 'accent', note: 'what the agent reads' },
        { t: 'Policy', items: ['scopes', 'tenant_visibility', 'quota', 'timeout / retry'], tone: 'coral', note: 'what the platform enforces' },
        { t: 'Ops', items: ['changelog', 'deprecation', 'sla', 'cost_model'], tone: 'lime' },
      ],
    },
  },
  'desc-quality': {
    kind: 'compare',
    caption: {
      zh: '描述不是给人看的简介，是给模型的「选择依据」。写得含糊，模型只能靠猜——猜错就是你的工单。',
      en: 'A description is not marketing copy; it is the model\'s selection signal. Vague words make it guess, and guesses become your tickets.',
    },
    zh: {
      left: {
        title: '含糊描述',
        sub: '「查询订单信息」',
        points: ['没说是按订单号还是手机号', '没说何时不该用', '没说返回什么、失败会怎样', '模型只能硬试，试错成本转嫁给用户'],
      },
      right: {
        title: '可执行描述',
        sub: '「按订单号查询单个订单的状态、金额与物流节点；仅在用户已提供订单号时使用；退款金额以 get_refund 为准」',
        points: ['输入形态明确', '使用与禁用条件明确', '边界职责写清楚', '模型选得准，人也看得懂'],
      },
      axis: '同样的能力，描述差 40 个字，选错率能差 5 倍',
    },
    en: {
      left: {
        title: 'Vague',
        sub: '"Look up order information"',
        points: ['Order id or phone number?', 'No statement of when not to use it', 'No shape of the result or failures', 'The model brute-forces; users pay'],
      },
      right: {
        title: 'Actionable',
        sub: '"Look up one order\'s status, amount and tracking by order id; only when the user has provided an id; refunds come from get_refund"',
        points: ['Input shape is explicit', 'Use and do-not-use conditions', 'Boundaries delegated elsewhere', 'The model picks right, humans understand'],
      },
      axis: 'Forty extra characters can cut mis-selection fivefold',
    },
  },
  'error-flow': {
    kind: 'flow',
    caption: {
      zh: '错误必须能被 Agent 读懂：可重试的给 retryable，参数错的给字段路径，权限错的不许重试。',
      en: 'Errors must be readable by the agent: retryable ones say so, argument errors name the field, permission errors forbid retries.',
    },
    zh: {
      dir: 'v',
      nodes: [
        { t: '技能返回错误', s: '{ code, message, retryable, field }', tone: 'coral' },
        { t: 'Hub 归一化', s: '补齐 trace_id / skill / version', tone: 'blue' },
        { t: 'Agent 决策', s: '重试 / 换参 / 换技能 / 上报人工', tone: 'accent' },
        { t: '结果', s: '可自愈的失败，而不是死循环', tone: 'lime' },
      ],
      edges: ['结构化', '可判断', '闭环'],
    },
    en: {
      dir: 'v',
      nodes: [
        { t: 'Skill fails', s: '{ code, message, retryable, field }', tone: 'coral' },
        { t: 'Hub normalises', s: 'adds trace_id / skill / version', tone: 'blue' },
        { t: 'Agent decides', s: 'retry / fix args / switch / escalate', tone: 'accent' },
        { t: 'Outcome', s: 'self-healing failure, not a loop', tone: 'lime' },
      ],
      edges: ['structured', 'decidable', 'closed loop'],
    },
  },

  /* ---------------- 04 生命周期 ---------------- */
  lifecycle: {
    kind: 'lifecycle',
    caption: {
      zh: '技能不是「发一次就完事」，它有出生、成长、衰老和死亡。没有下线的技能中心，最后会变成垃圾场。',
      en: 'A skill is born, grows, ages and dies. A hub without sunsetting becomes a landfill.',
    },
    zh: {
      states: [
        { t: '开发 dev', s: '本地跑通 + 单测', tone: 'blue' },
        { t: '发布 published', s: '审核通过，版本固定', tone: 'accent' },
        { t: '灰度 canary', s: '白名单 5% → 50%', tone: 'lime' },
        { t: '全量 GA', s: '默认版本，文档同步', tone: 'accent' },
        { t: '维护 maintained', s: '监控、修 bug、发小版本', tone: 'blue' },
        { t: '弃用 deprecated', s: '只修安全问题', tone: 'muted' },
        { t: '下线 retired', s: '拒绝新调用，归档', tone: 'coral' },
      ],
      note: '回滚不是第七步，是任意时刻都可用的旁路。',
    },
    en: {
      states: [
        { t: 'dev', s: 'runs locally, unit tested', tone: 'blue' },
        { t: 'published', s: 'reviewed, version pinned', tone: 'accent' },
        { t: 'canary', s: 'whitelist 5% → 50%', tone: 'lime' },
        { t: 'GA', s: 'default version, docs synced', tone: 'accent' },
        { t: 'maintained', s: 'monitor, fix, patch', tone: 'blue' },
        { t: 'deprecated', s: 'security fixes only', tone: 'muted' },
        { t: 'retired', s: 'rejects calls, archived', tone: 'coral' },
      ],
      note: 'Rollback is not step seven; it is a bypass available at any moment.',
    },
  },
  canary: {
    kind: 'flow',
    caption: {
      zh: '灰度的本质是「小范围用真实流量做实验」，不是「发个公告说我们灰度了」。',
      en: 'A canary is a real-traffic experiment on a small slice, not an announcement that you are canarying.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '1% 内部租户', s: '只看错误率', tone: 'blue' },
        { t: '5% 白名单', s: '比对延迟与失败', tone: 'accent' },
        { t: '25% 按租户', s: '观察成本与配额', tone: 'lime' },
        { t: '100% 全量', s: '旧版本保留 7 天', tone: 'coral' },
      ],
      edges: ['≥24h', '≥48h', '自动门禁'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: '1% internal', s: 'error rate only', tone: 'blue' },
        { t: '5% allowlist', s: 'latency and failures', tone: 'accent' },
        { t: '25% by tenant', s: 'cost and quotas', tone: 'lime' },
        { t: '100% GA', s: 'keep old version 7 days', tone: 'coral' },
      ],
      edges: ['≥24h', '≥48h', 'automatic gates'],
    },
  },

  /* ---------------- 05 模式 ---------------- */
  proxy: {
    kind: 'sequence',
    caption: {
      zh: '代理转发模式：Agent 不直连第三方，所有调用都从 Hub 过一遍——这就是你能收费、能限流、能追责的原因。',
      en: 'Proxy pattern: the agent never touches a vendor directly. Everything passes the hub — that is why you can bill, throttle and explain.',
    },
    zh: {
      actors: ['Agent', 'Hub', '密钥库', '第三方 API'],
      steps: [
        { from: 1, to: 2, t: 'call(skill, args, tenant)' },
        { from: 2, to: 3, t: '取短期凭证（不落客户端）' },
        { from: 3, to: 2, t: 'scoped token', dashed: true },
        { from: 2, to: 4, t: '转发 + 注入鉴权头' },
        { from: 4, to: 2, t: '响应 / 限流头', dashed: true },
        { from: 2, to: 1, t: '脱敏后的结果 + 用量' },
      ],
    },
    en: {
      actors: ['Agent', 'Hub', 'Secret store', 'Vendor API'],
      steps: [
        { from: 1, to: 2, t: 'call(skill, args, tenant)' },
        { from: 2, to: 3, t: 'fetch short-lived credential' },
        { from: 3, to: 2, t: 'scoped token', dashed: true },
        { from: 2, to: 4, t: 'forward with auth header' },
        { from: 4, to: 2, t: 'response / rate headers', dashed: true },
        { from: 2, to: 1, t: 'masked result + usage' },
      ],
    },
  },
  'sandbox-flow': {
    kind: 'flow',
    caption: {
      zh: '不可信技能的执行路径：先隔离，再限权，再限时，最后才允许它碰数据。',
      en: 'The path for untrusted skills: isolate first, then restrict, then time-box, and only then let it touch data.',
    },
    zh: {
      dir: 'v',
      nodes: [
        { t: '提交技能包', s: '镜像 / 代码 / 依赖清单', tone: 'blue' },
        { t: '静态扫描', s: '危险 API、外联域名、密钥硬编码', tone: 'coral' },
        { t: '沙箱实例', s: '无网络 / 只读挂载 / 非 root', tone: 'accent' },
        { t: '受限执行', s: 'CPU、内存、时长、输出大小', tone: 'lime' },
        { t: '结果回传', s: '脱敏 + 大小截断 + 审计', tone: 'muted' },
      ],
      edges: ['通过', '拉起', '调用', '结束'],
    },
    en: {
      dir: 'v',
      nodes: [
        { t: 'Skill package', s: 'image / code / dependency lock', tone: 'blue' },
        { t: 'Static scan', s: 'dangerous APIs, egress, hard-coded keys', tone: 'coral' },
        { t: 'Sandbox instance', s: 'no network / read-only mounts / non-root', tone: 'accent' },
        { t: 'Bounded run', s: 'CPU, memory, wall clock, output size', tone: 'lime' },
        { t: 'Return', s: 'masked, truncated, audited', tone: 'muted' },
      ],
      edges: ['pass', 'spawn', 'invoke', 'finish'],
    },
  },
  compose: {
    kind: 'flow',
    caption: {
      zh: '组合技能：把三个原子能力拼成一个「能对外承诺」的高级技能，失败时按语义整体回滚。',
      en: 'Composite skills: three atomic capabilities become one promise-bearing skill, with semantic rollback on failure.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: 'lookup_customer', s: '定位客户', tone: 'blue' },
        { t: 'get_orders', s: '拉最近订单', tone: 'accent' },
        { t: 'issue_refund', s: '按订单退款', tone: 'lime' },
        { t: 'refund_case@1.0', s: '一次调用对外承诺', tone: 'coral' },
      ],
      edges: ['customer_id', 'order_ids', '打包'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'lookup_customer', s: 'resolve customer', tone: 'blue' },
        { t: 'get_orders', s: 'recent orders', tone: 'accent' },
        { t: 'issue_refund', s: 'refund one order', tone: 'lime' },
        { t: 'refund_case@1.0', s: 'one call, one promise', tone: 'coral' },
      ],
      edges: ['customer_id', 'order_ids', 'wrap'],
    },
  },
  workflow: {
    kind: 'flow',
    caption: {
      zh: '工作流技能：多步骤、有分支、要等人审批。它和 Agent 的区别是——步骤是写死的，模型只在必要处填空。',
      en: 'Workflow skills: multi-step, branching, human approvals. Unlike an agent, the steps are fixed; the model only fills blanks.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '触发', s: '工单 / 定时 / 事件', tone: 'blue' },
        { t: '校验', s: '参数与权限', tone: 'accent' },
        { t: '人工审批', s: '金额 > 5000 才走', tone: 'coral' },
        { t: '执行动作', s: '调用子技能', tone: 'lime' },
        { t: '回执', s: '写回工单 + 通知', tone: 'muted' },
      ],
      edges: ['开始', '通过', '条件分支', '完成'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Trigger', s: 'ticket / schedule / event', tone: 'blue' },
        { t: 'Validate', s: 'args and permissions', tone: 'accent' },
        { t: 'Approval', s: 'only above 5000', tone: 'coral' },
        { t: 'Act', s: 'call child skills', tone: 'lime' },
        { t: 'Receipt', s: 'write back and notify', tone: 'muted' },
      ],
      edges: ['start', 'pass', 'branch', 'done'],
    },
  },
  billing: {
    kind: 'flow',
    caption: {
      zh: '计费链路：先记账再返回，异步聚合出账单。计量单位选错，账单永远对不上。',
      en: 'Metering: record before returning, aggregate asynchronously. Pick the wrong unit and the invoice never reconciles.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '调用发生', s: 'tenant / skill / version', tone: 'blue' },
        { t: '实时计量', s: '次数 + token + 时长', tone: 'accent' },
        { t: '配额扣减', s: '原子操作，防超卖', tone: 'coral' },
        { t: '异步聚合', s: '分钟级汇总到账单', tone: 'lime' },
        { t: '对账告警', s: '计量与账单差异 > 0.5%', tone: 'muted' },
      ],
      edges: ['埋点', '记账', '入队', '校验'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Call happens', s: 'tenant / skill / version', tone: 'blue' },
        { t: 'Meter live', s: 'calls + tokens + duration', tone: 'accent' },
        { t: 'Debit quota', s: 'atomic, no oversell', tone: 'coral' },
        { t: 'Aggregate', s: 'minute-level invoice lines', tone: 'lime' },
        { t: 'Reconcile', s: 'alert above 0.5% drift', tone: 'muted' },
      ],
     edges: ['emit', 'record', 'enqueue', 'verify'],
    },
  },

  /* ---------------- 06 安全 ---------------- */
  'perm-model': {
    kind: 'layers',
    caption: {
      zh: '权限要回答四个问题：谁、能调什么、调多少、在什么条件下。少答一个，就有一条绕过路径。',
      en: 'Permissions answer four questions: who, what, how much, under what conditions. Miss one and there is a bypass.',
    },
    zh: {
      layers: [
        { t: '身份 Identity', items: ['用户 / 服务账号', 'Agent 实例', '租户与项目', '来源 IP / 环境'], tone: 'blue' },
        { t: '范围 Scope', items: ['技能白名单', '数据域', '读写分离', '字段级可见性'], tone: 'accent' },
        { t: '额度 Quota', items: ['每分钟调用数', '每日 token', '并发上限', '单次结果大小'], tone: 'lime' },
        { t: '条件 Condition', items: ['金额阈值', '人工审批', '时间窗', 'MFA 二次确认'], tone: 'coral', note: '高风险技能必须落到这一层' },
      ],
    },
    en: {
      layers: [
        { t: 'Identity', items: ['User / service account', 'Agent instance', 'Tenant and project', 'Source IP / environment'], tone: 'blue' },
        { t: 'Scope', items: ['Skill allowlist', 'Data domain', 'Read versus write', 'Field-level visibility'], tone: 'accent' },
        { t: 'Quota', items: ['Calls per minute', 'Daily tokens', 'Concurrency cap', 'Max result size'], tone: 'lime' },
        { t: 'Condition', items: ['Amount thresholds', 'Human approval', 'Time windows', 'Step-up MFA'], tone: 'coral', note: 'high-risk skills must reach this layer' },
      ],
    },
  },
  'sandbox-matrix': {
    kind: 'matrix',
    caption: {
      zh: '三种沙箱没有绝对优劣：Docker 是默认答案，浏览器沙箱专治网页类技能，Serverless 适合突发流量。',
      en: 'No sandbox wins outright: Docker is the default, browser sandboxes handle web skills, serverless absorbs bursts.',
    },
    zh: {
      head: ['维度', 'Docker 沙箱', '浏览器沙箱', 'Serverless'],
      rows: [
        ['隔离强度', '中（共享内核）', '高（同源隔离）', '高（平台托管）'],
        ['冷启动', '100ms~2s', '300ms~1s', '50ms~5s'],
        ['适用技能', '通用代码 / CLI', '网页抓取 / 自动化', '突发、短任务'],
        ['运维成本', '中：要管宿主机', '低：镜像固定', '低：按量付费'],
        ['网络控制', '自己配 iptables', '天然受限', '依赖厂商策略'],
      ],
      highlight: [1, 3],
    },
    en: {
      head: ['Dimension', 'Docker', 'Browser sandbox', 'Serverless'],
      rows: [
        ['Isolation', 'Medium (shared kernel)', 'High (origin isolation)', 'High (provider managed)'],
        ['Cold start', '100ms~2s', '300ms~1s', '50ms~5s'],
        ['Best for', 'General code / CLI', 'Scraping, UI automation', 'Bursty short tasks'],
        ['Ops cost', 'Medium: you own hosts', 'Low: fixed images', 'Low: pay per use'],
        ['Network control', 'Your own iptables', 'Restricted by default', 'Provider policy'],
      ],
      highlight: [1, 3],
    },
  },
  'audit-seq': {
    kind: 'sequence',
    caption: {
      zh: '审计不是「多打一行日志」，而是能在三个月后回答：谁、用哪个版本、传了什么、拿走了什么。',
      en: 'Audit is not an extra log line. It answers, three months later: who, which version, what went in, what came out.',
    },
    zh: {
      actors: ['调用方', 'Hub', '审计队列', '对象存储', '查询台'],
      steps: [
        { from: 1, to: 2, t: '带身份的调用' },
        { from: 2, to: 2, t: '生成 trace_id + 摘要指纹' },
        { from: 2, to: 3, t: '异步写审计事件' },
        { from: 3, to: 4, t: '归档原始入参/出参（加密）' },
        { from: 2, to: 1, t: '返回结果 + trace_id' },
        { from: 5, to: 2, t: '按 trace_id 追溯', dashed: true },
      ],
    },
    en: {
      actors: ['Caller', 'Hub', 'Audit queue', 'Object store', 'Console'],
      steps: [
        { from: 1, to: 2, t: 'authenticated call' },
        { from: 2, to: 2, t: 'trace_id + payload digest' },
        { from: 2, to: 3, t: 'async audit event' },
        { from: 3, to: 4, t: 'archive raw payload (encrypted)' },
        { from: 2, to: 1, t: 'result + trace_id' },
        { from: 5, to: 2, t: 'trace lookup', dashed: true },
      ],
    },
  },
  'abuse-matrix': {
    kind: 'matrix',
    caption: {
      zh: '恶意技能的四类攻击，都能在平台侧设一道闸：不是靠「相信开发者」，而是靠机制。',
      en: 'Four hostile-skill attacks, each with a platform-side gate: mechanisms, not trust in the author.',
    },
    zh: {
      head: ['攻击', '表现', '平台侧防线'],
      rows: [
        ['资源耗尽', '死循环、内存炸弹', 'CPU/内存/时长硬上限 + 立即 kill'],
        ['数据外泄', '把入参往外部域名发', '默认禁网 + 域名白名单'],
        ['越权访问', '读别的租户数据', '短期凭证 + 行级过滤，不信入参 tenant'],
        ['注入攻击', '技能输出里塞指令', '输出当数据不当指令 + 内容过滤'],
      ],
      highlight: [1],
    },
    en: {
      head: ['Attack', 'Symptom', 'Platform defence'],
      rows: [
        ['Resource exhaustion', 'Infinite loop, memory bomb', 'Hard CPU/memory/time caps, kill instantly'],
        ['Exfiltration', 'Posting inputs to an external host', 'No egress by default, domain allowlist'],
        ['Privilege abuse', 'Reading another tenant', 'Short-lived creds, row filters, ignore tenant args'],
        ['Injection', 'Instructions inside skill output', 'Treat output as data, filter content'],
      ],
      highlight: [1],
    },
  },

  /* ---------------- 07 发现 ---------------- */
  discover: {
    kind: 'flow',
    caption: {
      zh: '发现不是「把 300 个技能全塞给模型」，而是先用便宜的手段缩到 8 个，再让模型做最后选择。',
      en: 'Discovery is not dumping 300 skills into the prompt. Narrow cheaply to eight, then let the model choose.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '全量目录', s: '300+ 技能', tone: 'muted' },
        { t: '权限过滤', s: '租户可见 + 角色', tone: 'blue' },
        { t: '混合检索', s: '关键词 + 向量', tone: 'accent' },
        { t: '重排截断', s: 'Top-8 注入上下文', tone: 'lime' },
        { t: '模型选择', s: '调用 / 追问 / 放弃', tone: 'coral' },
      ],
      edges: ['先砍', '再搜', '后截', '终选'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Full catalogue', s: '300+ skills', tone: 'muted' },
        { t: 'Permission filter', s: 'tenant + role', tone: 'blue' },
        { t: 'Hybrid search', s: 'keyword + vector', tone: 'accent' },
        { t: 'Rerank + truncate', s: 'top 8 into context', tone: 'lime' },
        { t: 'Model picks', s: 'call / ask / skip', tone: 'coral' },
      ],
      edges: ['cut', 'search', 'trim', 'choose'],
    },
  },
  'lazy-load': {
    kind: 'flow',
    caption: {
      zh: '动态加载：上下文里先只放「技能目录摘要」，等模型表达意图后再拉完整 Schema。',
      en: 'Lazy loading: keep only a catalogue summary in context, fetch the full schema once intent appears.',
    },
    zh: {
      dir: 'v',
      nodes: [
        { t: '启动', s: '拉目录：name + 一行描述', tone: 'blue' },
        { t: '对话中', s: '模型看到「有这类能力」', tone: 'accent' },
        { t: '意图出现', s: 'skills.search("退款")', tone: 'lime' },
        { t: '加载详情', s: '完整 schema + 示例', tone: 'coral' },
        { t: '调用', s: '只这一次带上完整定义', tone: 'muted' },
      ],
      edges: ['~2k tokens', '命中', '拉取', '执行'],
    },
    en: {
      dir: 'v',
      nodes: [
        { t: 'Startup', s: 'catalogue: name + one line', tone: 'blue' },
        { t: 'Conversation', s: 'the model knows the category exists', tone: 'accent' },
        { t: 'Intent', s: 'skills.search("refund")', tone: 'lime' },
        { t: 'Load detail', s: 'full schema + examples', tone: 'coral' },
        { t: 'Call', s: 'full definition for this turn only', tone: 'muted' },
      ],
      edges: ['~2k tokens', 'hit', 'fetch', 'run'],
    },
  },
  ranking: {
    kind: 'matrix',
    caption: {
      zh: '排序别只按调用量：冷门但高成功率的技能，才是真正该被推荐的那个。',
      en: 'Do not rank by volume alone: a niche skill with a high success rate is often the right recommendation.',
    },
    zh: {
      head: ['信号', '权重建议', '为什么'],
      rows: [
        ['语义相关度', '0.40', '先得对题，其他都是修饰'],
        ['成功率', '0.25', '失败率高的技能越用越糟'],
        ['调用量', '0.15', '人气是弱信号，容易被刷'],
        ['近期活跃', '0.10', '过期技能不该排前面'],
        ['评分 / 投诉率', '0.10', '人工反馈纠正模型偏好'],
      ],
      highlight: [0],
    },
    en: {
      head: ['Signal', 'Suggested weight', 'Why'],
      rows: [
        ['Semantic relevance', '0.40', 'Relevance first; the rest is decoration'],
        ['Success rate', '0.25', 'A flaky skill gets worse with use'],
        ['Volume', '0.15', 'Popularity is weak and gameable'],
        ['Recency', '0.10', 'Stale skills should not lead'],
        ['Ratings / complaints', '0.10', 'Human feedback corrects the model'],
      ],
      highlight: [0],
    },
  },

  /* ---------------- 08 MCP ---------------- */
  'mcp-bridge': {
    kind: 'sequence',
    caption: {
      zh: 'MCP Server 接入 Hub：Hub 充当客户端去握手、拉能力清单，然后把它包装成平台里的一个技能。',
      en: 'Onboarding an MCP server: the hub acts as the client, handshakes, lists capabilities and wraps them as skills.',
    },
    zh: {
      actors: ['运维', 'Hub', 'MCP Server', 'Agent'],
      steps: [
        { from: 1, to: 2, t: '提交 server 地址 + 凭证' },
        { from: 2, to: 3, t: 'initialize / initialized' },
        { from: 3, to: 2, t: 'serverInfo + capabilities', dashed: true },
        { from: 2, to: 3, t: 'tools/list, resources/list' },
        { from: 3, to: 2, t: '能力清单', dashed: true },
        { from: 2, to: 2, t: '生成技能包 + 权限默认值' },
        { from: 4, to: 2, t: '按技能名调用（不认识 MCP）' },
      ],
    },
    en: {
      actors: ['Operator', 'Hub', 'MCP server', 'Agent'],
      steps: [
        { from: 1, to: 2, t: 'server URL + credentials' },
        { from: 2, to: 3, t: 'initialize / initialized' },
        { from: 3, to: 2, t: 'serverInfo + capabilities', dashed: true },
        { from: 2, to: 3, t: 'tools/list, resources/list' },
        { from: 3, to: 2, t: 'capability list', dashed: true },
        { from: 2, to: 2, t: 'build skill packs + default policy' },
        { from: 4, to: 2, t: 'calls by skill name (MCP-agnostic)' },
      ],
    },
  },
  'mcp-registry': {
    kind: 'hub',
    caption: {
      zh: 'Hub 当 MCP 注册中心：所有 Server 只注册一次，所有 Agent 只连一个地址。',
      en: 'The hub as an MCP registry: servers register once, agents connect to one address.',
    },
    zh: {
      center: 'MCP 注册中心',
      nodes: ['CRM Server', '搜索 Server', '数据库 Server', '文件 Server', '内部工具 Server', '第三方 SaaS'],
      mode: 'star',
      note: '聚合后对外只暴露一个 MCP 端点，按租户裁剪能力清单。',
    },
    en: {
      center: 'MCP registry',
      nodes: ['CRM server', 'Search server', 'Database server', 'Files server', 'Internal tools', 'Vendor SaaS'],
      mode: 'star',
      note: 'One MCP endpoint outwards, with a per-tenant capability list.',
    },
  },

  /* ---------------- 09 生态 ---------------- */
  'eco-wiring': {
    kind: 'layers',
    caption: {
      zh: '技能中心不是孤岛：调度层决定「什么时候调」，观测层回答「为什么慢」，评估层决定「能不能上线」。',
      en: 'The hub is no island: orchestration decides when, observability explains why it is slow, evaluation decides whether it ships.',
    },
    zh: {
      layers: [
        { t: '入口', items: ['llm-gateway：统一鉴权、限流、成本'], tone: 'blue' },
        { t: '调度', items: ['better-agent：技能发现与调用编排'], tone: 'accent' },
        { t: '协作', items: ['a2a-patterns：跨 Agent 技能委派'], tone: 'lime' },
        { t: '能力', items: ['skill hub：注册、版本、沙箱、计费', 'agent-memory：记忆型技能'], tone: 'coral', note: '本层是能力供给方' },
        { t: '反馈', items: ['observability：trace / 指标', 'evaluation：回归与门禁'], tone: 'muted' },
      ],
    },
    en: {
      layers: [
        { t: 'Edge', items: ['llm-gateway: auth, limits, cost'], tone: 'blue' },
        { t: 'Orchestration', items: ['better-agent: discovery and call planning'], tone: 'accent' },
        { t: 'Collaboration', items: ['a2a-patterns: cross-agent delegation'], tone: 'lime' },
        { t: 'Capability', items: ['skill hub: registry, versions, sandbox, billing', 'agent-memory: memory skills'], tone: 'coral', note: 'this layer supplies capability' },
        { t: 'Feedback', items: ['observability: traces and metrics', 'evaluation: regressions and gates'], tone: 'muted' },
      ],
    },
  },
  'obs-trace': {
    kind: 'sequence',
    caption: {
      zh: '全链路追踪：网关生成 trace_id，Agent 带上 span，Hub 把它写进每一次技能调用。',
      en: 'End-to-end tracing: the gateway mints a trace_id, the agent carries a span, the hub stamps every skill call.',
    },
    zh: {
      actors: ['客户端', '网关', 'Agent', 'Skill Hub', '追踪后端'],
      steps: [
        { from: 1, to: 2, t: 'request + request_id' },
        { from: 2, to: 3, t: 'trace_id / span_id' },
        { from: 3, to: 4, t: 'call(skill, trace_id)' },
        { from: 4, to: 4, t: '子 span：鉴权、转发、沙箱' },
        { from: 4, to: 5, t: 'span 批量上报' },
        { from: 2, to: 5, t: '网关 span', dashed: true },
      ],
    },
    en: {
      actors: ['Client', 'Gateway', 'Agent', 'Skill hub', 'Trace backend'],
      steps: [
        { from: 1, to: 2, t: 'request + request_id' },
        { from: 2, to: 3, t: 'trace_id / span_id' },
        { from: 3, to: 4, t: 'call(skill, trace_id)' },
        { from: 4, to: 4, t: 'child spans: auth, proxy, sandbox' },
        { from: 4, to: 5, t: 'batched spans' },
        { from: 2, to: 5, t: 'gateway span', dashed: true },
      ],
    },
  },

  /* ---------------- 10 选型 ---------------- */
  selection: {
    kind: 'matrix',
    caption: {
      zh: '选型不是选「最强」，是选「你的团队能维护到明年」的那一个。',
      en: 'Choose what your team can still operate next year, not what benchmarks best.',
    },
    zh: {
      head: ['方案', '上手成本', '可控性', '适合谁'],
      rows: [
        ['纯 MCP 公共生态', '极低', '低（依赖外部）', '原型、个人项目'],
        ['平台自带市场', '低', '中（受平台约束）', '已在用该平台的团队'],
        ['自研轻量 Hub', '中', '高', '有后端团队、要审计计费'],
        ['云厂商方案', '中', '中（绑定云）', '已在云上、要合规'],
        ['完整商用平台', '高', '中', '大企业、有采购流程'],
      ],
      highlight: [2],
    },
    en: {
      head: ['Option', 'Effort', 'Control', 'Who it fits'],
      rows: [
        ['Public MCP ecosystem', 'Very low', 'Low (external)', 'Prototypes, personal projects'],
        ['Platform marketplace', 'Low', 'Medium (platform rules)', 'Teams already on that platform'],
        ['Light DIY hub', 'Medium', 'High', 'Backend teams needing audit and billing'],
        ['Cloud vendor offering', 'Medium', 'Medium (cloud lock-in)', 'Cloud-native, compliance-driven'],
        ['Full commercial suite', 'High', 'Medium', 'Large enterprises with procurement'],
      ],
      highlight: [2],
    },
  },

  /* ---------------- 11 部署 ---------------- */
  deploy: {
    kind: 'layers',
    caption: {
      zh: '生产拓扑：接入层无状态可横扩，执行层按技能分池，数据层必须是有状态的高可用。',
      en: 'Production topology: stateless access scales out, execution pools by skill type, data stays stateful and HA.',
    },
    zh: {
      layers: [
        { t: '边缘', items: ['CDN / WAF', 'TLS 终止', '全局限流'], tone: 'blue' },
        { t: '接入集群', items: ['Hub API × N', '会话无状态', '健康检查'], tone: 'accent' },
        { t: '执行池', items: ['可信池（直连）', '沙箱池（隔离）', '异步池（长任务）'], tone: 'lime' },
        { t: '数据层', items: ['Postgres 主从', 'Redis 集群', '对象存储', '审计归档'], tone: 'coral' },
        { t: '观测', items: ['Prometheus', '日志聚合', '追踪后端', '告警通道'], tone: 'muted' },
      ],
    },
    en: {
      layers: [
        { t: 'Edge', items: ['CDN / WAF', 'TLS termination', 'Global rate limits'], tone: 'blue' },
        { t: 'Access cluster', items: ['Hub API × N', 'Stateless sessions', 'Health checks'], tone: 'accent' },
        { t: 'Execution pools', items: ['Trusted (direct)', 'Sandboxed (isolated)', 'Async (long jobs)'], tone: 'lime' },
        { t: 'Data', items: ['Postgres primary/replica', 'Redis cluster', 'Object storage', 'Audit archive'], tone: 'coral' },
        { t: 'Observability', items: ['Prometheus', 'Log aggregation', 'Tracing backend', 'Alerting'], tone: 'muted' },
      ],
    },
  },
  'sre-loop': {
    kind: 'lifecycle',
    caption: {
      zh: '运维闭环：指标 → 告警 → 处置 → 复盘 → 改进，缺了复盘这一步，同样的故障会按月重播。',
      en: 'The ops loop: metrics, alerts, response, review, improvement. Skip the review and the same outage returns monthly.',
    },
    zh: {
      states: [
        { t: '采集', s: 'QPS、P95、错误率、配额', tone: 'blue' },
        { t: '告警', s: '阈值 + 同比 + 多窗口', tone: 'coral' },
        { t: '处置', s: '降级 / 熔断 / 回滚', tone: 'accent' },
        { t: '复盘', s: '时间线 + 根因 + 影响面', tone: 'lime' },
        { t: '改进', s: '门禁、预案、容量', tone: 'muted' },
      ],
      note: '没有复盘模板的团队，事故只会变成故事。',
    },
    en: {
      states: [
        { t: 'Collect', s: 'QPS, P95, errors, quota', tone: 'blue' },
        { t: 'Alert', s: 'thresholds + deltas + windows', tone: 'coral' },
        { t: 'Respond', s: 'degrade / break / roll back', tone: 'accent' },
        { t: 'Review', s: 'timeline, root cause, blast radius', tone: 'lime' },
        { t: 'Improve', s: 'gates, runbooks, capacity', tone: 'muted' },
      ],
      note: 'Without a review template, incidents become anecdotes.',
    },
  },
  'retry-storm': {
    kind: 'flow',
    caption: {
      zh: '重试风暴：下游只是慢了一秒，三层各自重试三次，27 倍流量瞬间把服务打死。',
      en: 'Retry storm: downstream is one second slow, three layers retry three times, 27× traffic kills it.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '下游变慢', s: 'P95 从 300ms → 1.2s', tone: 'coral' },
        { t: 'Agent 重试', s: '3 次，无退避', tone: 'accent' },
        { t: 'Hub 重试', s: '又是 3 次', tone: 'blue' },
        { t: '客户端重试', s: '再来 3 次', tone: 'lime' },
        { t: '雪崩', s: '27× 流量，全挂', tone: 'coral' },
      ],
      edges: ['超时', '放大', '再放大', '不可恢复'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Downstream slows', s: 'P95 300ms → 1.2s', tone: 'coral' },
        { t: 'Agent retries', s: '3×, no backoff', tone: 'accent' },
        { t: 'Hub retries', s: 'another 3×', tone: 'blue' },
        { t: 'Client retries', s: '3× more', tone: 'lime' },
        { t: 'Avalanche', s: '27× traffic, all down', tone: 'coral' },
      ],
      edges: ['timeout', 'amplify', 'amplify', 'unrecoverable'],
    },
  },

  /* ---------------- 13 Demo ---------------- */
  'demo-topo': {
    kind: 'sequence',
    caption: {
      zh: 'Demo 拓扑：一个 400 行的 Hub、一个 MCP Server、一个 LangGraph Agent，全部跑在 Compose 里。',
      en: 'Demo topology: a 400-line hub, an MCP server and a LangGraph agent, all under Compose.',
    },
    zh: {
      actors: ['LangGraph Agent', 'skill-hub', 'Postgres', 'mcp-server'],
      steps: [
        { from: 1, to: 2, t: 'GET /skills?tenant=demo' },
        { from: 2, to: 3, t: '查元数据与权限' },
        { from: 3, to: 2, t: '技能清单', dashed: true },
        { from: 1, to: 2, t: 'POST /invoke { skill, args }' },
        { from: 2, to: 4, t: 'JSON-RPC tools/call' },
        { from: 4, to: 2, t: 'result', dashed: true },
        { from: 2, to: 3, t: '写审计与计量' },
        { from: 2, to: 1, t: 'result + trace_id' },
      ],
    },
    en: {
      actors: ['LangGraph agent', 'skill-hub', 'Postgres', 'mcp-server'],
      steps: [
        { from: 1, to: 2, t: 'GET /skills?tenant=demo' },
        { from: 2, to: 3, t: 'metadata and policy lookup' },
        { from: 3, to: 2, t: 'skill list', dashed: true },
        { from: 1, to: 2, t: 'POST /invoke { skill, args }' },
        { from: 2, to: 4, t: 'JSON-RPC tools/call' },
        { from: 4, to: 2, t: 'result', dashed: true },
        { from: 2, to: 3, t: 'audit and metering writes' },
        { from: 2, to: 1, t: 'result + trace_id' },
      ],
    },
  },

  /* ---------------- 14 性能 ---------------- */
  'cache-tiers': {
    kind: 'layers',
    caption: {
      zh: '缓存要分层：元数据在进程内，热点结果在 Redis，历史归档在对象存储。放错层的缓存只会制造不一致。',
      en: 'Cache in tiers: metadata in-process, hot results in Redis, history in object storage. Misplaced caches only create inconsistency.',
    },
    zh: {
      layers: [
        { t: 'L1 进程内', items: ['技能元数据', '权限位图', 'TTL 30~60s'], tone: 'accent', note: '命中率最高，必须能失效广播' },
        { t: 'L2 Redis', items: ['热门查询结果', '限流计数器', '会话级缓存'], tone: 'blue' },
        { t: 'L3 数据层', items: ['Postgres 元数据', '调用日志分区表'], tone: 'lime' },
        { t: 'L4 归档', items: ['对象存储', '审计原文', '冷查询走离线'], tone: 'muted' },
      ],
    },
    en: {
      layers: [
        { t: 'L1 in-process', items: ['Skill metadata', 'Permission bits', '30~60s TTL'], tone: 'accent', note: 'highest hit rate, needs invalidation broadcast' },
        { t: 'L2 Redis', items: ['Hot query results', 'Rate-limit counters', 'Session cache'], tone: 'blue' },
        { t: 'L3 data', items: ['Postgres metadata', 'Partitioned invocation logs'], tone: 'lime' },
        { t: 'L4 archive', items: ['Object storage', 'Raw audit payloads', 'Cold offline queries'], tone: 'muted' },
      ],
    },
  },
  'async-flow': {
    kind: 'sequence',
    caption: {
      zh: '长任务异步化：先接单返回 job_id，完成后用 webhook 或轮询取结果，别让 Agent 干等 90 秒。',
      en: 'Async long tasks: accept and return a job_id, deliver via webhook or polling. Never make the agent wait 90 seconds.',
    },
    zh: {
      actors: ['Agent', 'Hub', '任务队列', 'Worker', '回调地址'],
      steps: [
        { from: 1, to: 2, t: 'invoke(async=true)' },
        { from: 2, to: 3, t: '入队 + 返回 job_id' },
        { from: 2, to: 1, t: '202 Accepted + job_id', dashed: true },
        { from: 3, to: 4, t: 'Worker 取任务' },
        { from: 4, to: 2, t: '结果落库' },
        { from: 2, to: 5, t: '签名 webhook 通知' },
        { from: 1, to: 2, t: 'GET /jobs/{id}' },
      ],
    },
    en: {
      actors: ['Agent', 'Hub', 'Queue', 'Worker', 'Webhook'],
      steps: [
        { from: 1, to: 2, t: 'invoke(async=true)' },
        { from: 2, to: 3, t: 'enqueue + job_id' },
        { from: 2, to: 1, t: '202 Accepted + job_id', dashed: true },
        { from: 3, to: 4, t: 'worker picks up' },
        { from: 4, to: 2, t: 'store result' },
        { from: 2, to: 5, t: 'signed webhook' },
        { from: 1, to: 2, t: 'GET /jobs/{id}' },
      ],
    },
  },

  /* ---------------- 附录：阅读地图 ---------------- */
  'book-map': {
    kind: 'layers',
    caption: {
      zh: '全书四条阅读线：概念先立地基，工程再划边界，运营解决「技能变多以后」，横向三章把一切接回真实世界。',
      en: 'Four reading threads: concepts first, then engineering boundaries, then the everything-multiplies problem, then the three chapters that reconnect it to reality.',
    },
    zh: {
      layers: [
        { t: '概念线 00 → 01 → 03', items: ['00 开篇', '01 概念', '03 元数据'], tone: 'accent' },
        { t: '工程线 02 → 05 → 06 → 11', items: ['02 架构', '05 模式', '06 安全', '11 部署'], tone: 'blue' },
        { t: '运营线 04 → 07 → 14', items: ['04 生命周期', '07 发现', '14 性能'], tone: 'lime' },
        { t: '横向线 08 → 09 → 10', items: ['08 MCP', '09 生态', '10 选型'], tone: 'coral' },
        { t: '收尾与实战 12 → 13 → 15', items: ['12 踩坑', '13 Demo', '15 趋势'], tone: 'muted' },
      ],
    },
    en: {
      layers: [
        { t: 'Concept thread 00 → 01 → 03', items: ['00 Opening', '01 Concepts', '03 Metadata'], tone: 'accent' },
        { t: 'Engineering thread 02 → 05 → 06 → 11', items: ['02 Architecture', '05 Patterns', '06 Security', '11 Deploy'], tone: 'blue' },
        { t: 'Operations thread 04 → 07 → 14', items: ['04 Lifecycle', '07 Discovery', '14 Performance'], tone: 'lime' },
        { t: 'Cross thread 08 → 09 → 10', items: ['08 MCP', '09 Ecosystem', '10 Landscape'], tone: 'coral' },
        { t: 'Scars and demos 12 → 13 → 15', items: ['12 Pitfalls', '13 Demos', '15 Future'], tone: 'muted' },
      ],
    },
  },

  /* ---------------- 15 趋势 ---------------- */
  'future-hub': {
    kind: 'hub',
    caption: {
      zh: '下一步：技能从「内部资产」变成「可交易、可认证、可进化」的能力网络。',
      en: 'Next: skills move from internal assets to a tradable, certifiable, self-improving capability network.',
    },
    zh: {
      center: '技能网络',
      nodes: ['技能交易', '安全认证', '自主进化', '跨平台互通', '用量结算', '质量评级'],
      mode: 'star',
      note: '越开放的网络，越依赖前三章那套元数据与权限规范。',
    },
    en: {
      center: 'Skill network',
      nodes: ['Marketplaces', 'Certification', 'Self-evolution', 'Cross-platform', 'Settlement', 'Quality ratings'],
      mode: 'star',
      note: 'The more open the network, the more it depends on the metadata and policy work in the early chapters.',
    },
  },
}
