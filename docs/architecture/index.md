---
title: 02 · 技能中心核心架构分层
description: 接入、注册发现、权限、执行、运营、数据六层的职责、接口设计、失败模式与最小实现。
outline: [2, 3]
---

# 02 · 技能中心核心架构分层

分层不是为了画图好看，是为了**出了问题能立刻定位到哪一层**。

::: tip 全章一句话
六个层，每层只回答一个问题：**谁能进来（接入）、有什么（注册）、让不让（权限）、怎么跑（执行）、怎么管（运营）、记什么（数据）。**
:::

## 00 全景 {#overview}

<Diagram id="arch" />

一个请求从上到下穿过六层。任何一层偷懒，都会在别处以事故形式偿还：

| 层 | 只回答一个问题 | 偷懒的后果 |
| --- | --- | --- |
| 接入 | 调用方怎么找到我 | 每个客户端各写一套，行为不一致 |
| 注册发现 | 有什么技能、怎么搜 | Agent 选不中，或者只能全量塞上下文 |
| 权限 | 这次调用该不该放行 | 越权、数据串租户 |
| 执行 | 请求怎么真正跑起来 | 超时不生效、错误不可读 |
| 运营 | 谁改了什么、怎么放量 | 升级即事故，无法回滚 |
| 数据 | 留下什么证据 | 出事后查不到人 |

## 01 接入层：SDK、MCP、REST {#access}

<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="规范：JSON-RPC 与初始化流程" />

接入层是**唯一允许有多个入口、但只能有一个内部契约**的地方。三扇门，通向同一个大厅：

1. **Agent SDK**：给自家 Agent 用，封装重试、幂等、trace 注入。
2. **MCP 适配器**：把 Hub 的技能按 MCP 协议暴露出去，让任何支持 MCP 的客户端接入。
3. **REST / JSON-RPC**：给后端服务、低代码平台、脚本用。

内部契约建议只留三个动作：

```http
POST /v1/skills/resolve    # 查技能（含 schema、版本、可见性）
POST /v1/skills/invoke     # 调技能
POST /v1/skills/feedback   # 回传结果质量（供评测与排序）
```

```python
# SDK 的 invoke 应该长这样：一个函数，四件事
def invoke(skill: str, args: dict, *, tenant: str, subject: str,
           version: str | None = None, idempotency_key: str | None = None):
    payload = {
        "skill": skill,
        "version": version or "stable",     # 永不默认 latest
        "args": args,
        "tenant": tenant,                  # 从 token 取，不信请求体
        "trace_id": current_trace(),
        "idempotency_key": idempotency_key or uuid4().hex,
    }
    return http.post("/v1/skills/invoke", json=payload, timeout=30)
```

| 入口 | 适合 | 不适合 |
| --- | --- | --- |
| SDK | 自有 Agent、需要统一埋点 | 第三方、多语言客户端 |
| MCP | 跨厂商、桌面客户端、IDE | 高并发内部服务调用 |
| REST | 服务间、脚本、低代码 | 需要流式与长连接的场景 |

::: warning 别让入口决定语义
同一技能从 REST 和从 MCP 调用，**必须得到同样的权限结果和同样的错误码**。做不到，说明业务逻辑写在了适配器里，而不是核心里。
:::

## 02 注册发现层：元数据与检索 {#registry}

注册层的核心不是「存一份 JSON」，而是**让 Agent 能在一堆技能里选中正确的那一个**。

最小元数据表长这样：

```sql
create table skills (
  skill_id      text primary key,          -- ulid，永不变
  name          text not null,             -- order.lookup
  display_name  text,
  description   text not null,             -- 给模型看的那段
  input_schema  jsonb not null,
  output_schema jsonb,
  scopes        text[] not null,
  owner         text not null,
  tenant_scope  text[] not null,           -- ['cs','ops'] 或 ['*']
  tags          text[] not null,
  status        text not null,             -- draft/canary/ga/deprecated
  created_at    timestamptz default now()
);

create table skill_versions (
  skill_id   text references skills(skill_id),
  version    text not null,                -- semver
  channel    text not null,                -- stable / canary / lts
  manifest   jsonb not null,               -- 完整清单快照
  checksum   text not null,
  primary key (skill_id, version)
);
```

两个设计要点：

- **技能与版本分表**。`skills` 是「这个东西存在」，`skill_versions` 是「这个东西的某一个形态」。合并成一张表，灰度就没法做。
- **manifest 存快照**。每次发布存一份完整清单，回滚时不需要「重建」，直接指回去。

检索走**关键词 + 向量**双路召回，第 07 章细讲。注册层只需要保证：按 `tenant_scope` 过滤、按 `status` 过滤、按 `tags` 过滤之后再排序。

::: tip 人话翻译
注册层是图书馆的检索台，不是书架。书架乱一点还能找，检索台错了，读者永远找不到那本书。
:::

## 03 权限管控层：鉴权与租户 {#permission}

<Diagram id="call-seq" />

权限判断必须**集中在一处**，否则每个执行器都要各写一遍，早晚不一致。

```python
from dataclasses import dataclass

@dataclass
class Decision:
    allow: bool
    reason: str
    version: str | None = None
    remaining_quota: int | None = None

def authorise(skill, version, ctx) -> Decision:
    # 1. 身份：subject 来自签名 token，不接受请求体自报
    if not ctx.token.verified:
        return Decision(False, "UNAUTHENTICATED")

    # 2. 可见性：租户维度
    if "*" not in skill.tenant_scope and ctx.tenant not in skill.tenant_scope:
        return Decision(False, "SKILL_NOT_VISIBLE")

    # 3. 能力：scope 必须是用户权限的子集
    missing = set(skill.scopes) - set(ctx.subject.scopes)
    if missing:
        return Decision(False, f"MISSING_SCOPE:{','.join(sorted(missing))}")

    # 4. 配额：先扣预占，失败再退回
    q = quota.reserve(ctx.tenant, skill.name, cost=skill.cost_model.estimate(ctx.args))
    if q.denied:
        return Decision(False, "QUOTA_EXCEEDED")

    return Decision(True, "OK", version=pick_version(skill, ctx), remaining_quota=q.left)
```

四道门的顺序不能换：**先验身份，再看可见性，再看能力，最后扣配额**。反过来会出两类事故：没权限的人把配额耗光；或者先扣了钱再发现没权限。

::: danger 三个必须写进代码检查的规则
1. `tenant` 只能来自 token，**永远不能来自请求参数**。
2. 版本只能来自注册层的 `pick_version`，**调用方不能指定任意版本**（可以让调用方指定，但必须校验它在白名单里）。
3. 权限判断失败时**返回明确原因**，但要脱敏——不要把「你有 orders:read 但没有 refund:write」这种内部结构直接回给终端用户。
:::

## 04 执行层：沙箱与转发 {#execute}

<Diagram id="exec-modes" />

执行层做四件事：**选执行方式、注入超时、归一化结果、记录用量**。

```python
def execute(skill, version, args, ctx):
    impl = registry.impl(skill.name, version)     # proxy | local | sandbox
    deadline = now() + skill.timeout_ms / 1000

    try:
        raw = impl.call(args, ctx, timeout=skill.timeout_ms / 1000,
                        idempotency_key=ctx.idempotency_key)
    except TimeoutError:
        return Err("UPSTREAM_TIMEOUT", retryable=True, deadline=deadline)
    except impl.ClientError as e:
        return Err(skill.map_error(e), retryable=False)

    out = normalise(raw, skill.output_schema)      # 裁剪 + 类型收敛
    meter.record(ctx, skill, version, latency=now() - ctx.start)
    return Ok(out, trace_id=ctx.trace_id)
```

三种执行方式的选择标准：

| 方式 | 延迟 | 安全边界 | 适合 |
| --- | --- | --- | --- |
| 代理转发 | +5~20ms | 强（Hub 是唯一入口） | 内部 API、需计费、需审计 |
| 本地执行 | 最低 | 弱（代码落在调用方） | 高频只读、离线场景 |
| 沙箱运行 | +50~300ms | 最强（进程/网络受限） | 第三方、用户上传、不可信代码 |

::: warning 超时必须由执行层强制
只在客户端设超时，等于没有超时。**执行层要主动掐断**，并返回 `UPSTREAM_TIMEOUT`（可重试）而不是一个笼统的 500。
:::

## 05 运营管理层：版本与计费 {#ops}

运营层把「技术对象」变成「可运营资产」：

| 能力 | 最小实现 | 没有会怎样 |
| --- | --- | --- |
| 版本与通道 | `stable / canary / lts` 三条通道 | 只能全量升级 |
| 灰度 | 按租户白名单 + 按比例 | 出事只能全站回滚 |
| 审批 | 高风险 scope 需人工放行 | 有人上线了删库技能 |
| 计费 | 按次 / 按 token / 按时长 | 成本说不清，无法分摊 |
| 报表 | 调用量、错误率、P95、Top 调用方 | 运营全靠感觉 |

计费口径建议一开始就定死，不要事后补：

```text
cost = calls × price_per_call
     + (input_tokens + output_tokens) / 1000 × price_per_1k_tokens
     + ceil(duration_ms / 1000) × price_per_second
```

::: tip 人话翻译
运营层就是「技能的 HR + 财务」：入职（发布）、试用期（灰度）、转正（GA）、考核（报表）、离职（下线）、结算（计费）。
:::

## 06 数据层：元数据、日志、审计 {#data}

<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="GenAI 语义约定：模型与工具调用的标准字段" />

三类数据必须分开存，别混在一张表里：

| 库 | 内容 | 保留期 | 查询特征 |
| --- | --- | --- | --- |
| 元数据库 | 技能、版本、策略、租户 | 永久 | 低频写、高频读 |
| 调用日志库 | 每次调用的入参摘要、耗时、结果码、用量 | 30~180 天 | 高频写、按时间分区 |
| 审计库 | 谁在何时对什么做了什么（含敏感操作） | 按合规要求，常见 1~3 年 | 只追加、不可改 |

```sql
-- 调用日志：按天分区，不要按租户分区（租户数量会变）
create table invocations (
  id            bigserial,
  trace_id      text not null,
  tenant        text not null,
  subject       text not null,
  skill         text not null,
  version       text not null,
  status        text not null,      -- ok | denied | error
  error_code    text,
  latency_ms    int,
  args_digest   text,               -- 哈希 + 脱敏摘要，不存原文
  created_at    timestamptz default now()
) partition by range (created_at);
```

::: danger 日志不要存原始入参
「为了排查方便把完整请求存下来」是数据泄露的头号来源。存**摘要 + 脱敏后的关键字段 + 哈希**，需要复现时用 trace_id 走一次受控重放。
:::

## 07 六层的失败模式速查 {#failures}

| 层 | 最典型的失败 | 快速定位方法 |
| --- | --- | --- |
| 接入 | 客户端版本不一致，行为不同 | 看 SDK 版本 + 请求头 |
| 注册 | 技能查不到 / 查到旧版本 | 查 `skill_versions.status` 与缓存 TTL |
| 权限 | 偶发 `DENIED` | 看 token 的 scope 快照 vs 当前策略 |
| 执行 | 超时不生效、错误码混乱 | 看执行层日志与下游 P99 |
| 运营 | 灰度没生效 | 看 `pick_version` 的输入 |
| 数据 | 日志缺行 | 看异步写入队列积压 |

## 参考来源 {#refs}

<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="规范：客户端/服务端能力协商" />
<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="GenAI 语义约定" />
<Source href="https://docs.dify.ai/" org="Dify" label="开源方案参考：工具与工作流的分层实现" />
<Source href="https://platform.openai.com/docs/actions" org="OpenAI" label="GPT Actions：用 OpenAPI 描述外部能力" />

## 下一章 {#next}

架构定了，接下来填最容易被敷衍、也最影响 Agent 表现的一层：[03 · 元数据与规范](/metadata/)。
