/**
 * 生态矩阵：八个站点互相导流，首页、侧边栏与章节页尾共用。
 * Ecosystem matrix shared by the home page, sidebar and chapter footers.
 */

export interface EcoItem {
  key:
    | 'better-agent'
    | 'mcp-patterns'
    | 'llm-gateway-patterns'
    | 'a2a-patterns'
    | 'agent-memory-patterns'
    | 'agent-observability-patterns'
    | 'agent-evaluation-patterns'
    | 'agent-skillhub-patterns'
  name: string
  url: string
  glyph: string
  zhRole: string
  enRole: string
  zhDesc: string
  enDesc: string
  current?: boolean
}

export const ecosystem: EcoItem[] = [
  {
    key: 'better-agent',
    name: 'better-agent',
    url: 'https://yuxinrun.github.io/better-agent/',
    glyph: 'BA',
    zhRole: 'Agent 调度核心',
    enRole: 'Agent orchestration core',
    zhDesc: '单智能体怎么造：循环、工具、上下文、评测与上线。',
    enDesc: 'How to build one great agent: loop, tools, context, evals, shipping.',
  },
  {
    key: 'mcp-patterns',
    name: 'mcp-patterns',
    url: 'https://yuxinrun.github.io/mcp-patterns/',
    glyph: 'MCP',
    zhRole: 'Agent 工具调用',
    enRole: 'Tool calling protocol',
    zhDesc: 'Agent 怎么用工具：Server、资源、提示、权限与工程化。',
    enDesc: 'How agents use tools: servers, resources, prompts, permissions.',
  },
  {
    key: 'agent-skillhub-patterns',
    name: 'agent-skillhub-patterns',
    url: 'https://yuxinrun.github.io/agent-skillhub-patterns/',
    glyph: 'HUB',
    zhRole: '技能注册分发',
    enRole: 'Skill registry and delivery',
    zhDesc: '能力怎么被管起来：注册、版本、权限、沙箱、审计与计费。',
    enDesc: 'How capabilities get managed: registry, versions, permissions, sandboxes, audit.',
    current: true,
  },
  {
    key: 'a2a-patterns',
    name: 'a2a-patterns',
    url: 'https://yuxinrun.github.io/a2a-patterns/',
    glyph: 'A2A',
    zhRole: 'Agent 横向通信',
    enRole: 'Agent-to-agent messaging',
    zhDesc: '多个 Agent 怎么互相说话：发现、委派、任务、流式、安全。',
    enDesc: 'How agents talk to each other: discovery, delegation, tasks, streams, safety.',
  },
  {
    key: 'agent-memory-patterns',
    name: 'agent-memory-patterns',
    url: 'https://yuxinrun.github.io/agent-memory-patterns/',
    glyph: 'MEM',
    zhRole: 'Agent 记忆工程',
    enRole: 'Agent memory engineering',
    zhDesc: 'Agent 怎么记住事：分层记忆、检索、压缩、遗忘与隔离。',
    enDesc: 'How agents remember: tiers, retrieval, compression, forgetting, isolation.',
  },
  {
    key: 'agent-observability-patterns',
    name: 'agent-observability-patterns',
    url: 'https://yuxinrun.github.io/agent-observability-patterns/',
    glyph: 'OBS',
    zhRole: 'Agent 可观测性',
    enRole: 'Agent observability',
    zhDesc: 'Agent 为什么这么干：追踪、指标、日志、成本与告警。',
    enDesc: 'Why the agent did that: traces, metrics, logs, cost, alerting.',
  },
  {
    key: 'agent-evaluation-patterns',
    name: 'agent-evaluation-patterns',
    url: 'https://yuxinrun.github.io/agent-evaluation-patterns/',
    glyph: 'EVAL',
    zhRole: 'Agent 质量评估',
    enRole: 'Agent evaluation',
    zhDesc: 'Agent 到底行不行：数据集、判分器、回归与上线门禁。',
    enDesc: 'Whether the agent works: datasets, graders, regressions, release gates.',
  },
  {
    key: 'llm-gateway-patterns',
    name: 'llm-gateway-patterns',
    url: 'https://yuxinrun.github.io/llm-gateway-patterns/',
    glyph: 'GW',
    zhRole: '模型流量网关',
    enRole: 'Model traffic gateway',
    zhDesc: '模型怎么被安全地调用：路由、限流、成本、审计与灰度。',
    enDesc: 'How models get called safely: routing, rate limits, cost, audit, rollouts.',
  },
]

export const siteMeta = {
  nameZh: 'Skill Hub 手册',
  nameEn: 'Agent Skill Hub Patterns',
  sloganZh: '不是 Agent 不会干活，是没人把能力装进工具箱。',
  sloganEn: 'Your agent is not incapable. Nobody put the tools in a toolbox.',
  taglineZh:
    '面向工程师与平台架构师的 Agent 技能中心工程手册：注册、版本、权限、沙箱、发现与计费，一层层拆开讲，全部可落地。',
  taglineEn:
    'An engineering field guide to agent skill hubs: registry, versions, permissions, sandboxes, discovery and billing — layer by layer, ready to ship.',
  author: '鱼心',
  authorEn: 'Yuxin',
  authorUrl: 'https://yuxin.run',
  repo: 'https://github.com/yuxinrun/agent-skillhub-patterns',
  license: 'MIT',
}
