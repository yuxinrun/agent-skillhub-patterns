---
title: 03 · 技能元数据与标准化规范
description: 必填字段、描述写法、JSON Schema 校验、统一错误码、分类标签体系，以及最小与生产两份完整清单。
outline: [2, 3]
---

# 03 · 技能元数据与标准化规范

技能中心里最不性感、但最决定成败的一层。因为**模型的每一次选错，几乎都能在元数据里找到原因**。

::: tip 全章一句话
元数据是给三个读者看的合同：**Agent 看描述和 Schema，平台看权限和配额，人看文档和负责人。** 只写给其中一个看，另外两个就会来折磨你。
:::

## 01 元数据必填字段 {#fields}

<Diagram id="manifest" />

<Source href="https://modelcontextprotocol.io/specification/latest/server/tools" org="MCP" label="Tools：name / description / inputSchema 的最小要求" />

四层字段，少一层就有一类事故：

| 层 | 字段 | 谁读 | 缺了会怎样 |
| --- | --- | --- | --- |
| 身份 | `name` `version` `owner` | 平台、人 | 出问题找不到负责人 |
| 契约 | `description` `input_schema` `output_schema` `error_codes` | Agent | 选错、传错、不会重试 |
| 策略 | `scopes` `tenant_scope` `quota` `timeout_ms` | 平台 | 越权、被打爆 |
| 运营 | `changelog` `deprecation` `sla` `cost_model` | 人 | 无法灰度、无法计费 |

命名规范（建议写进 CI 检查）：

```text
^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+(@\d+\.\d+\.\d+)?$
例：order.lookup、order.refund.create@1.4.0
```

- 用**领域.动作**，不要用团队名：`order.lookup` ✅，`cs_team_tool_2` ❌
- 动词放后面，方便按前缀检索
- 一经发布**永不改名**，改名等于新技能（旧技能走弃用）

::: warning 名字是永久 ID，不是标签
改名会打断审计、账本、缓存、调用方配置。要「更好听的名字」，改 `display_name`，别改 `name`。
:::

## 02 描述怎么写，Agent 才不乱调 {#describe}

<Diagram id="desc-quality" />

<Source href="https://www.anthropic.com/engineering/writing-tools-for-agents" org="Anthropic" label="Writing effective tools for agents" />

描述不是简介，是**选择依据**。一个可用的描述包含四段：

1. **做什么**：一句话，动宾结构。
2. **什么时候用**：触发条件，具体到用户会说的话。
3. **什么时候别用**：指向正确的替代技能——这条最容易被省略，也最能减少误调用。
4. **返回什么 / 失败什么样**：让模型知道结果够不够用。

| 差 | 好 |
| --- | --- |
| 查询订单信息 | 按订单号查询订单状态、支付结果与物流节点。用户提供 12~20 位订单号，或询问「我的订单到哪了」「这单付了吗」时使用。不要用于按手机号查单（用 `order.search`）或修改地址（用 `order.address.update`）。返回 `status`/`paid_at`/`shipping`；订单不存在返回 `ORDER_NOT_FOUND`，此时不要重试，应向用户确认订单号。 |

```yaml
description: |
  按订单号查询订单状态、支付结果与物流节点。
  使用场景：用户提供 12~20 位订单号；用户问「订单到哪了」「这笔付了吗」。
  不要用于：按手机号/姓名查单（用 order.search）；修改收货地址（用 order.address.update）。
  返回：status（created|paid|shipped|done|cancelled）、paid_at、shipping（数组，可为空）。
  失败：ORDER_NOT_FOUND（不要重试，向用户确认单号）、ORDER_LOCKED（稍后重试）。
```

::: tip 一个能立刻见效的写法
在描述里明确写 **「不要用于……」** 并给出替代技能名。实测这一句能砍掉相当一部分误调用，比反复调提示词有效。
:::

::: warning 别在描述里塞业务规则
「如果用户是 VIP 且订单超过 500 元则……」这类逻辑应该写在技能实现里。描述里塞规则，模型会开始自己发明分支。
:::

## 03 入参校验规范 {#validate}

<Source href="https://json-schema.org/" org="JSON Schema" label="规范的校验关键字" />
<Source href="https://platform.openai.com/docs/guides/function-calling" org="OpenAI" label="Function calling：strict 模式与参数约束" />

三层防线，缺一不可：

1. **模型侧约束**（`strict` / structured outputs）：让模型尽量输出合法结构。
2. **Hub 侧校验**（JSON Schema）：不信模型，一律校验。
3. **实现侧兜底**（类型、长度、业务规则）：最后一道。

```python
from jsonschema import Draft202012Validator

INPUT = {
    "type": "object",
    "additionalProperties": False,
    "required": ["order_id"],
    "properties": {
        "order_id": {"type": "string", "pattern": "^[0-9]{12,20}$"},
        "include": {
            "type": "array",
            "items": {"enum": ["payment", "shipping"]},
            "maxItems": 2,
            "default": ["payment"],
        },
    },
}

validator = Draft202012Validator(INPUT)

def validate_args(args: dict) -> dict:
    errors = sorted(validator.iter_errors(args), key=lambda e: e.path)
    if errors:
        raise InvalidArgs(
            code="INVALID_ARGUMENTS",
            detail=[{"path": list(e.path), "msg": e.message} for e in errors[:5]],
        )
    return apply_defaults(args, INPUT)   # 默认值由 Hub 补，别指望模型
```

四个必须做到的细节：

| 细节 | 为什么 |
| --- | --- |
| `additionalProperties: false` | 否则模型会塞你没定义的字段，实现侧静默忽略，bug 极难查 |
| `enum` 而不是自由字符串 | 收敛取值，减少实现侧分支 |
| `default` 由 Hub 补 | 模型经常漏字段 |
| 错误信息带 `path` | 「哪个字段错了」比「参数错误」有用一百倍 |

::: danger 校验失败不要重试同一份参数
`INVALID_ARGUMENTS` 是不可重试错误。让模型看到具体字段错误后**重新生成参数**，而不是原样重发——原样重发只会烧钱。
:::

## 04 错误码标准化 {#errors}

<Diagram id="error-flow" />

<Source href="https://www.rfc-editor.org/rfc/rfc9457" org="RFC 9457" label="Problem Details for HTTP APIs" />

统一错误信封，让 Agent 能判断「要不要重试」：

```json
{
  "ok": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "No order with this id",
    "retryable": false,
    "http_status": 404,
    "trace_id": "01J9Z0K3...",
    "detail": {"field": "order_id"}
  }
}
```

标准错误码表（建议全站共用这套，不要各技能自造）：

| code | 含义 | retryable | Agent 应该做什么 |
| --- | --- | --- | --- |
| `INVALID_ARGUMENTS` | 参数不合 schema | false | 修正参数后重试 |
| `UNAUTHENTICATED` | 未登录 / token 失效 | false | 走登录流程 |
| `MISSING_SCOPE` | 权限不足 | false | 告知用户申请权限 |
| `SKILL_NOT_VISIBLE` | 当前租户不可见 | false | 不要提示「不存在」，避免探测 |
| `QUOTA_EXCEEDED` | 配额用尽 | false（当天） | 换降级方案或提示限额 |
| `NOT_FOUND` | 目标资源不存在 | false | 核对标识 |
| `CONFLICT` | 状态冲突（已退款再退） | false | 查当前状态再决定 |
| `UPSTREAM_TIMEOUT` | 下游超时 | true（退避） | 指数退避重试 1~2 次 |
| `UPSTREAM_UNAVAILABLE` | 下游不可用 | true（有限） | 熔断期内不要重试 |
| `INTERNAL` | Hub 内部错误 | maybe | 带 trace_id 上报 |

::: tip 人话翻译
错误码不是给运维看的日志，是**给模型看的操作说明**。`retryable: false` 告诉它「别白费力气」，`retryable: true` 告诉它「等一下再来」。
:::

::: warning 不要用 HTTP 状态码代替错误码
502 既可能是下游超时，也可能是网关配置错。模型没法从 502 判断该不该重试，你必须给语义。
:::

## 05 分类与标签体系 {#taxonomy}

标签是给**人和检索**用的，不是给模型自由发挥用的。三层结构最稳：

```text
domain      财务 / 客服 / 研发 / 营销          （一级目录，数量 ≤ 10）
capability  read / write / compute / search   （动作类别，数量 ≤ 8）
attribute   敏感数据 / 需审批 / 有副作用 / 幂等  （风险与行为标记，可多选）
```

```yaml
taxonomy:
  domain: cs
  capability: read
  attributes: [idempotent, pii]
```

设计原则：

| 原则 | 原因 |
| --- | --- |
| 目录不超过三层 | 再深就没人维护，检索也不准 |
| 标签有受控词表 | 自由标签三个月后会出现「订单」「order」「单」三种 |
| 风险标记与权限联动 | `requires_approval` 应自动触发审批流 |
| 允许一个技能多标签 | 但主分类只能有一个 |

::: warning 标签不是越多越好
一个技能挂 15 个标签，检索排序会被稀释。**主分类 1 个 + 属性 ≤ 4 个**，够用。
:::

## 06 最小示例与生产示例 {#examples}

**最小可用**（够跑通，不够上线）：

```json
{
  "name": "order.lookup",
  "version": "0.1.0",
  "description": "按订单号查询订单状态。用户提供订单号时使用；不要用于按手机号查单。",
  "input_schema": {
    "type": "object",
    "required": ["order_id"],
    "additionalProperties": false,
    "properties": {"order_id": {"type": "string", "pattern": "^[0-9]{12,20}$"}}
  }
}
```

**生产级**（可直接进 CI 做 schema 校验）：

```json
{
  "name": "order.lookup",
  "version": "1.4.0",
  "channel": "stable",
  "display_name": "查询订单",
  "description": "按订单号查询订单状态、支付结果与物流节点。用户提供 12~20 位订单号，或询问订单进度、是否已支付时使用。不要用于按手机号查单（order.search）或修改地址（order.address.update）。返回 status、paid_at、shipping；失败返回 ORDER_NOT_FOUND 或 ORDER_LOCKED。",
  "owner": {"team": "cs-platform", "oncall": "cs-oncall@example.com"},
  "homepage": "https://wiki.example.com/skills/order.lookup",
  "input_schema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["order_id"],
    "properties": {
      "order_id": {"type": "string", "pattern": "^[0-9]{12,20}$", "description": "12~20 位纯数字订单号"},
      "include": {"type": "array", "items": {"enum": ["payment", "shipping"]}, "default": ["payment"]}
    }
  },
  "output_schema": {
    "type": "object",
    "required": ["status"],
    "properties": {
      "status": {"enum": ["created", "paid", "shipped", "done", "cancelled"]},
      "paid_at": {"type": ["string", "null"], "format": "date-time"},
      "shipping": {"type": "array", "items": {"type": "object"}}
    }
  },
  "error_codes": ["ORDER_NOT_FOUND", "ORDER_LOCKED", "UPSTREAM_TIMEOUT"],
  "scopes": ["orders:read"],
  "tenant_scope": ["cs", "ops"],
  "quota": {"per_minute": 600, "per_tenant_day": 200000},
  "timeout_ms": 2000,
  "retry": {"max_attempts": 2, "backoff": "exponential", "on": ["UPSTREAM_TIMEOUT"]},
  "cost_model": {"type": "per_call", "price": 0.0002},
  "sla": {"p95_ms": 400, "availability": "99.9%"},
  "taxonomy": {"domain": "cs", "capability": "read", "attributes": ["idempotent", "pii"]},
  "changelog": [
    {"version": "1.4.0", "date": "2026-03-02", "note": "新增 shipping 节点，兼容旧调用"},
    {"version": "1.0.0", "date": "2025-11-18", "note": "首个 GA 版本"}
  ]
}
```

::: tip 一份清单，五处复用
这份 JSON 同时喂给：注册层（存快照）、MCP 适配器（转 `inputSchema`）、OpenAI tools 数组（转 `parameters`）、文档站（生成页面）、CI（跑 schema 校验）。**写一次，到处用**是元数据最大的杠杆。
:::

## 参考来源 {#refs}

<Source href="https://modelcontextprotocol.io/specification/latest/server/tools" org="MCP" label="Tools：inputSchema 与 list/call 语义" />
<Source href="https://platform.openai.com/docs/guides/function-calling" org="OpenAI" label="Function calling：strict 与参数描述" />
<Source href="https://json-schema.org/" org="JSON Schema" label="Draft 2020-12 校验关键字" />
<Source href="https://www.anthropic.com/engineering/writing-tools-for-agents" org="Anthropic" label="工具描述、返回结构与 token 效率" />

## 下一章 {#next}

清单有了，接着回答「这份清单怎么从草稿走到下线」：[04 · 生命周期管理](/lifecycle/)。
