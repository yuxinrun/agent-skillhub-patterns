---
title: 09 · 与全生态组件联动
description: 调度框架如何动态加载技能、跨 Agent 共享与委派、记忆型技能、网关流量与成本、全链路追踪与评测门禁。
outline: [2, 3]
---

# 09 · 与全生态组件联动

技能中心不是孤岛。它和调度、通信、记忆、网关、观测、评测六个兄弟项目**共用一套 ID、一套契约、一条链路**。

::: tip 全章一句话
八个仓库能拼成一套系统，靠的不是接口多漂亮，而是**三件事对齐：tenant_id、skill_id、trace_id**。对不齐，账对不上、链路断、评测也白做。
:::

## 00 全景接线 {#overview}

<Diagram id="eco-wiring" />

| 兄弟项目 | 它管什么 | 与 Hub 的接口 | 不对齐的后果 |
| --- | --- | --- | --- |
| [better-agent](https://yuxinrun.github.io/better-agent/) | Agent 循环、工具选择 | `resolve` + `invoke` | 上下文爆、反复选错 |
| [mcp-patterns](https://yuxinrun.github.io/mcp-patterns/) | 协议暴露方式 | MCP 适配器 | 客户端各写一套 |
| [a2a-patterns](https://yuxinrun.github.io/a2a-patterns/) | Agent 间委派 | 能力卡 + 委派令牌 | 越权、无法追责 |
| [agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/) | 记忆读写 | 记忆类技能 | PII 泄露、记忆污染 |
| [llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/) | 模型流量与成本 | 技能内模型调用 | 成本算不到技能上 |
| [agent-observability-patterns](https://yuxinrun.github.io/agent-observability-patterns/) | 链路与指标 | trace 注入 | 出问题只能猜 |
| [agent-evaluation-patterns](https://yuxinrun.github.io/agent-evaluation-patterns/) | 评测与门禁 | 评测集 + 发版卡点 | 上线靠感觉 |

## 01 better-agent：调度层如何加载技能 {#betteragent}

调度的核心循环只有三步：**看目录 → 选技能 → 执行并消化结果**。

```python
# Agent 侧的最小循环：永远先拿目录，再按需拉 schema
async def step(state):
    cat = await hub.catalogue(tenant=state.tenant, revision=state.rev)   # 增量
    state.rev = cat["revision"]

    plan = await llm.plan(state.messages, catalogue=cat,
                          tools_hint=state.pinned)          # 只给目录级别信息

    if plan.kind == "call":
        tools = await hub.resolve(plan.skill, tenant=state.tenant)       # 拉完整 schema
        args = await llm.fill_args(plan, tools.input_schema)
        result = await hub.invoke(plan.skill, args,
                                  tenant=state.tenant, subject=state.subject,
                                  version=state.pins.get(plan.skill))    # 版本固定
        state.messages.append(result.as_message())
    return state
```

四个必须遵守的约定：

| 约定 | 原因 |
| --- | --- |
| 目录与 schema 分两次拉 | 省上下文，减少一次请求的 token 成本 |
| 版本固定到会话 | 同一会话内不换版本，行为可复现 |
| 错误码进上下文 | 让模型自己判断重试还是换路 |
| 结果做摘要再入历史 | 大响应体会把上下文吃干 |

::: warning 调度层别自己实现重试
Agent 层的重试会和 Hub 的重试叠加，变成 3×3=9 次。**重试只在执行层做一次**，Agent 只负责「换方案」。
:::

## 02 a2a-patterns：跨 Agent 共享与委派 {#a2a}

<Source href="https://a2a-protocol.org/" org="A2A" label="Agent2Agent 协议：能力卡与任务委派" />

跨 Agent 的两件事：**发现对方有什么能力**、**代表用户请对方干活**。

```json
// 能力卡里声明的技能，应该直接映射自 Hub 的清单
{
  "agent": "cs-agent",
  "skills": [
    {"id": "order.lookup@1.4.0", "scopes": ["orders:read"]},
    {"id": "order.refund.assess@1.2.0", "scopes": ["orders:read", "refund:read"]}
  ],
  "delegation": {
    "accepts": ["urn:ietf:params:oauth:grant-type:token-exchange"],
    "max_ttl_seconds": 600,
    "audience": "cs-agent"
  }
}
```

```python
def delegate(caller_ctx, target_agent, skill_id, scopes):
    # 关键：换成「代表用户」的短期令牌，而不是把调用方的 token 直接转发
    return token_exchange(
        subject_token=caller_ctx.token,
        audience=target_agent,
        scope=scopes,                 # 只授予本次需要的最小集合
        ttl=600,
        act={"sub": caller_ctx.subject, "agent": caller_ctx.agent_id},
    )
```

::: danger 委托最忌讳「令牌转发」
把调用方的 token 原样传给对方 Agent，等于把用户的全部权限借出去，且审计里看不出经过了谁。**必须做令牌交换 + 权限收窄 + 短 TTL**。
:::

## 03 agent-memory-patterns：记忆型技能 {#memory}

<Source href="https://yuxinrun.github.io/agent-memory-patterns/" org="系列" label="agent-memory-patterns：记忆的类型与治理" />

记忆不是「一个数据库」，它常常以**技能**形式被调用：`memory.recall`、`memory.write`、`profile.get`。

三个治理要点：

| 要点 | 做法 |
| --- | --- |
| 命名空间隔离 | `tenant/user/agent` 三段，缺一段就会串 |
| 写入需授权 | 记忆写入是「副作用」，要走 scope 与审计 |
| 读取要脱敏 | 记忆里最容易长期驻留 PII |

```yaml
name: memory.recall
version: 2.0.0
description: 检索与当前用户相关的长期记忆（偏好、历史结论）。回答个性化问题前使用。
input_schema:
  type: object
  properties:
    namespace: {enum: [preference, project, conversation_summary]}
    query: {type: string, maxLength: 300}
    top_k: {type: integer, minimum: 1, maximum: 10, default: 5}
scopes: [memory:read]
tenant_scope: ["*"]
quota: {per_minute: 300}
```

::: warning 记忆写入是最容易被滥用的写操作
「记住我喜欢红色」无害，「记住我的身份证号」就是事故。**记忆写入必须有字段白名单 + PII 拦截 + 用户可见的删除入口。**
:::

## 04 llm-gateway-patterns：调用走网关 {#gateway}

很多技能内部会调模型（总结、分类、抽取）。这些调用**不能绕开网关**，否则成本算不清、限流不生效。

```python
# 技能内部调用模型：带上 skill 维度，让网关能按技能归集成本
def call_model(prompt, ctx, model="fast"):
    return gateway.complete(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        headers={
            "x-trace-id": ctx.trace_id,
            "x-tenant": ctx.tenant,
            "x-skill": ctx.skill_name,          # 关键：成本归因
            "x-skill-version": ctx.skill_version,
        },
        budget=ctx.skill.cost_model.model_budget,   # 单次调用的模型预算上限
    )
```

| 归集维度 | 用途 |
| --- | --- |
| `x-skill` + `version` | 算出「每个技能花了多少模型钱」 |
| `x-tenant` | 多租户分摊 |
| `x-trace-id` | 与技能调用日志对齐 |

::: tip 一个能立刻回答老板问题的字段
「这个月模型花了多少钱，按技能排个序」——只要技能内调用都带了 `x-skill`，这是一条 SQL 的事；没带，就是两周的考古。
:::

## 05 agent-observability-patterns：全链路追踪 {#observability}

<Diagram id="obs-trace" />

<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="GenAI 语义约定：标准属性名" />

一次技能调用应该产生一个 span，并把上下文传给下游：

```python
from opentelemetry import trace

tracer = trace.get_tracer("skillhub")

async def invoke_traced(skill, args, ctx):
    with tracer.start_as_current_span(
        f"skill.invoke {skill.name}",
        attributes={
            "gen_ai.operation.name": "execute_tool",
            "gen_ai.tool.name": skill.name,
            "gen_ai.tool.version": ctx.version,
            "tenant.id": ctx.tenant,
            "skill.error_code": None,
        },
    ) as span:
        try:
            out = await execute(skill, ctx.version, args, ctx)
            span.set_attribute("skill.outcome", "ok")
            return out
        except SkillError as e:
            span.set_attribute("skill.error_code", e.code)
            span.set_attribute("error.type", e.code)
            span.record_exception(e)
            raise
```

四个必须打上的字段：

| 字段 | 用途 |
| --- | --- |
| `trace_id` | 把 Agent → Hub → 下游 → 模型串起来 |
| `skill.name` + `version` | 定位到具体版本 |
| `tenant.id` | 按租户看延迟与错误 |
| `skill.error_code` | 区分「业务失败」与「系统失败」 |

::: warning 采样要分层
调用量大的时候全采样会破产。**错误与慢请求 100% 采样，成功请求 1~5%**，但审计日志不采样（见第 06 章）。
:::

## 06 agent-evaluation-patterns：上线门禁 {#evaluation}

<Source href="https://yuxinrun.github.io/agent-evaluation-patterns/" org="系列" label="agent-evaluation-patterns：评测集与门禁" />

技能的评测和 Agent 的评测不同：**它考的是「选得对 + 传得对 + 结果够用」**。

| 测什么 | 怎么测 | 通过线 |
| --- | --- | --- |
| 选择准确率 | 给 100 条用户话术，看是否选中该技能 | ≥ 95%，且误选率 ≤ 2% |
| 参数正确率 | 检查生成的 args 是否合法且语义正确 | ≥ 98% |
| 结果可用性 | 人工/模型打分：拿到结果能否完成任务 | ≥ 90% |
| 回归 | 与上一版本对比，不得下降 | 无显著下降 |
| 成本 | 平均 token 与延迟 | 不超过基线 20% |

```python
def quality_gate(skill, new_version, baseline_version):
    r_new = run_eval(skill, new_version, suites=["selection", "args", "usefulness"])
    r_old = run_eval(skill, baseline_version, suites=["selection", "args", "usefulness"])

    checks = {
        "selection": r_new.selection >= 0.95 and delta(r_new, r_old, "selection") >= -0.01,
        "args": r_new.args >= 0.98,
        "usefulness": r_new.usefulness >= 0.90,
        "cost": r_new.avg_cost <= r_old.avg_cost * 1.2,
    }
    return all(checks.values()), checks
```

::: danger 改了描述就必须跑评测
描述是选择依据。**即使代码零改动，描述变更也要过选择准确率这一关**，否则「优化文案」会变成线上误调用。
:::

## 07 接线的顺序建议 {#order}

别一次接八个。按「能立刻产生价值」排序：

1. **observability**（先能看见，才谈优化）
2. **gateway**（成本归因，老板会问）
3. **evaluation**（发版门禁，防回归）
4. **better-agent**（动态加载，提体验）
5. **a2a**（跨 Agent，复杂度最高）
6. **memory**（记忆型技能，注意 PII）

::: tip 人话翻译
先装监控和账本，再谈性能和生态。**没有观测的优化都是玄学，没有账本的成本都是猜测。**
:::

## 参考来源 {#refs}

<Source href="https://a2a-protocol.org/" org="A2A" label="Agent2Agent：能力发现与任务委派" />
<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="GenAI 语义约定" />
<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="协议适配与能力协商" />
<Source href="https://yuxinrun.github.io/agent-memory-patterns/" org="系列" label="记忆的分层与治理" />
<Source href="https://yuxinrun.github.io/agent-evaluation-patterns/" org="系列" label="评测集与质量门禁" />

## 下一章 {#next}

接完生态，回到最现实的问题：到底用哪套方案？[10 · 方案选型对比](/landscape/)。
