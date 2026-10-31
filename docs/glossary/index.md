---
title: 术语表
description: 技能中心相关的 36 个核心术语，中英对照 + 人话解释，附对应章节。
outline: [2, 3]
---

# 术语表

术语按主题分组。每条都给了「人话」版本——如果你只记得人话，也不影响做决策。

## 01 能力与角色 {#capability}

| 术语 | English | 人话解释 | 章节 |
| --- | --- | --- | --- |
| 工具 | Tool | 一个能被调用的函数，只管输入输出 | [01](/concepts/#toolskill) |
| 技能 | Skill | 工具 + 说明 + 参数约束 + 权限 + 版本的可复用能力包 | [01](/concepts/#toolskill) |
| 技能中心 | Skill Hub | 管理技能注册、发现、权限、版本、执行、计费的平台 | [02](/architecture/) |
| 技能市场 | Marketplace | 面向外部生态的技能分发与交易场所 | [01](/concepts/#marketvscenter) |
| Agent | Agent | 会规划、会挑技能、会处理失败的执行者 | [00](/intro/#relation) |
| 原子技能 | Atomic skill | 只做一件事、可独立测试的最小技能 | [05](/patterns/#compose) |
| 组合技能 | Composite skill | 把多个原子技能按固定逻辑打包成一个对外承诺 | [05](/patterns/#compose) |
| 工作流技能 | Workflow skill | 步骤写死、含分支与人工审批的技能 | [05](/patterns/#workflow) |

## 02 协议与规范 {#protocol}

| 术语 | English | 人话解释 | 章节 |
| --- | --- | --- | --- |
| MCP | Model Context Protocol | 把工具、资源、提示暴露给模型的通信标准 | [08](/mcp/) |
| MCP Server | MCP Server | 按 MCP 协议对外提供能力的一方 | [08](/mcp/#bridge) |
| MCP Client | MCP Client | 连接 MCP Server 并调用能力的一方（常常是 Hub） | [08](/mcp/#bridge) |
| 工具调用 | Function / Tool calling | 模型输出结构化参数、由宿主执行函数 | [01](/concepts/#toolskill) |
| Actions | GPT Actions | OpenAI 用 OpenAPI Schema 描述外部 API 的调用方式 | [03](/metadata/#examples) |
| 清单 | Manifest | 描述技能身份、契约、策略、运营信息的结构化文档 | [03](/metadata/#fields) |
| JSON Schema | JSON Schema | 描述 JSON 结构与校验规则的通用标准 | [03](/metadata/#validate) |
| JSON-RPC | JSON-RPC | MCP 使用的请求/响应编码格式 | [08](/mcp/#bridge) |
| 语义化版本 | SemVer | 主.次.修订，用来表达「这次改动会不会弄坏别人」 | [04](/lifecycle/#publish) |

## 03 治理与权限 {#governance}

| 术语 | English | 人话解释 | 章节 |
| --- | --- | --- | --- |
| 租户 | Tenant | 数据与配额的最小隔离单位，通常是客户或部门 | [05](/patterns/#tenancy) |
| 权限范围 | Scope | 一个技能被允许做什么，例如 `orders:read` | [06](/security/#model) |
| 最小权限 | Least privilege | 只给完成当前任务必需的权限，多一分都不给 | [06](/security/#model) |
| 配额 | Quota | 单位时间内的调用量或成本上限 | [05](/patterns/#billing) |
| 灰度 | Canary | 先让一小部分真实流量用新版本，观察后再放量 | [04](/lifecycle/#canary) |
| 弃用 | Deprecation | 不再推荐使用，但还允许调用，给定过渡期 | [04](/lifecycle/#sunset) |
| 回滚 | Rollback | 出问题时把流量切回上一个可用版本 | [04](/lifecycle/#rollback) |
| 审批门禁 | Release gate | 高风险技能上线前必须经过的人或自动检查 | [06](/security/#approval) |

## 04 执行与安全 {#execution}

| 术语 | English | 人话解释 | 章节 |
| --- | --- | --- | --- |
| 沙箱 | Sandbox | 把不可信代码关起来跑，限制它能碰什么 | [06](/security/#sandbox) |
| 出网白名单 | Egress allowlist | 只允许技能访问指定域名，防止偷偷外传数据 | [06](/security/#abuse) |
| 脱敏 | Masking | 把身份证号、手机号等敏感字段替换掉再返回 | [06](/security/#data) |
| 提示注入 | Prompt injection | 把指令藏在数据里，诱导模型做别的事 | [06](/security/#abuse) |
| 熔断 | Circuit breaker | 下游连续失败时先断开，别再往上加压 | [14](/performance/#ratelimit) |
| 舱壁隔离 | Bulkhead | 不同租户/技能用独立资源池，一个挂了不拖垮全部 | [14](/performance/#ratelimit) |
| 幂等 | Idempotency | 同样的请求重复执行，结果一致、不重复扣款 | [12](/pitfalls/#retry) |
| 冷启动 | Cold start | 实例从零拉起到能处理请求的那段等待 | [14](/performance/#coldstart) |

## 05 运营与观测 {#operations}

| 术语 | English | 人话解释 | 章节 |
| --- | --- | --- | --- |
| 审计 | Audit | 记录谁在什么时候调了什么、传了什么、拿走了什么 | [06](/security/#audit) |
| 计量 | Metering | 按调用次数、token、时长统计用量 | [05](/patterns/#billing) |
| 追踪 | Tracing | 用 trace_id 串起一次请求经过的所有组件 | [09](/ecosystem/#observability) |
| 召回 | Recall / retrieval | 从一堆技能里找出「可能相关」的那几个 | [07](/discovery/#hybrid) |
| 重排 | Rerank | 对召回的候选再排一次序，把最该用的放前面 | [07](/discovery/#ranking) |
| 技能过载 | Skill overload | 技能太多，模型反而选不对、上下文还爆了 | [07](/discovery/#antipattern) |
| 复用率 | Reuse rate | 有多少团队/项目在使用同一个技能 | [10](/landscape/#matrix) |
| 上线门禁 | Quality gate | 评测不达标就不许发版 | [09](/ecosystem/#evaluation) |

::: tip 记不住也没关系
真正需要背下来的只有三条：**技能是能力包、Hub 是治理层、MCP 是协议**。其余的用到再查。
:::
