---
title: 01 · 核心概念彻底搞懂
description: Tool 与 Skill 的边界、技能中心的三大价值、公共市场与内部中心、从工具调用到技能中心的五级演进，以及四条最容易踩错的边界。
outline: [2, 3]
---

# 01 · 核心概念彻底搞懂

这一章不写代码，只拆词。因为后面 90% 的设计错误，都能追溯到一个词被两个人理解成了两件事。

::: tip 全章一句话
**Tool 是能力的最小单位，Skill 是可治理的能力包，Hub 是治理本身，MCP 是传输协议。** 四句话记牢，后面全是推论。
:::

## 01 Tool 工具 vs Skill 技能 {#toolskill}

<Diagram id="tool-vs-skill" />

先看最朴素的代码。这是一个**工具**：

```python
def get_order(order_id: str) -> dict:
    row = db.query("select * from orders where id = %s", order_id)
    return {"id": row.id, "status": row.status}
```

再看同一件事包成**技能**之后，多了什么：

```yaml
name: order.lookup
version: 1.4.0
display_name: 查询订单
description: >
  按订单号查询订单当前状态、支付结果和物流节点。
  当用户提供订单号、或需要确认某笔订单是否已支付时使用。
  不要用于按手机号批量查单，那属于 order.search 技能。
input_schema:  { order_id: {type: string, pattern: "^[0-9]{12,20}$"} }
output_schema: { status, paid_at, shipping }
scopes: [orders:read]            # 能力边界
tenant_visibility: [cs, ops]     # 谁能看见
quota: { per_minute: 600, per_tenant_day: 200000 }
timeout_ms: 2000
error_codes: [ORDER_NOT_FOUND, ORDER_LOCKED, UPSTREAM_TIMEOUT]
owner: cs-platform
```

差别不在代码，在**合同**。工具只有函数签名，技能有：说明书、校验、权限、配额、版本、负责人、错误语义。

| 维度 | Tool | Skill |
| --- | --- | --- |
| 关注点 | 能不能执行 | 该不该执行、谁能执行、执行几次 |
| 变更影响 | 改了就变，调用方无感 | 版本号，可灰度、可回滚 |
| 权限 | 通常在代码里写死 | 独立策略，按租户/角色下发 |
| 失败语义 | 抛异常 | 标准错误码，Agent 可判断是否重试 |
| 计量 | 无 | 调用次数、耗时、成本可记账 |
| 归属 | 谁写的不知道 | owner、SLA、弃用计划都写清楚 |

::: tip 人话翻译
Tool 是「会做这道菜」，Skill 是「这道菜的菜谱 + 谁可以点 + 一天限点几份 + 换厨师了要怎么通知」。餐厅敢把菜放进菜单，靠的是后者。
:::

::: warning 一个常见的偷懒
「我已经把函数放进共享包了，这就是技能中心了吧？」
不是。**共享包只解决复用，不解决管控。** 没有版本、权限、审计的共享包，会在第二次升级时变成全公司事故。
:::

## 02 技能中心的三大价值 {#value}

<Diagram id="hub-values" />

**复用（省人力）**：一次开发，多处调用。真正的收益不是省了那 5 次开发，而是 bug 只需要修一次。

**管控（省事故）**：版本、灰度、配额、上下线通知。没有这层，一个技能升级能把全公司 Agent 一起带走。

**安全（兜底线）**：最小权限、沙箱、审计。这层平时没人夸，出事时是唯一能救你的。

三者的关系是**不能只剩一个**：

| 只剩 | 结果 | 像什么 |
| --- | --- | --- |
| 复用 | 一个共享包，谁都能改 | 公共代码仓库 |
| 管控 | 一堆审批表，没人愿意上架 | 内部流程地狱 |
| 安全 | 全都锁死，没人能用 | 合规摆设 |

::: tip 判断一个平台是不是真 Hub
问它三个问题：技能升级要不要改调用方代码？能不能查到上个月谁调了退款技能？新技能上架要不要人审？三个都答得上来，才算。
:::

## 03 公共 Hub vs 私有 Hub {#publicprivate}

<Diagram id="public-private" />

| 维度 | 公共 Skill Hub | 私有 Skill Hub |
| --- | --- | --- |
| 典型形态 | 开源市场、公共 MCP 目录 | 企业内部能力平台 |
| 技能来源 | 任何人可提交 | 内部团队 + 审核过的三方 |
| 核心难题 | 不可信、质量参差 | 权限、隔离、重复建设 |
| 变现方式 | 订阅 / 分成 / 引流 | 降本、复用率、合规 |
| 冷启动 | 靠规模 | 靠第一个真实业务场景 |

**决策经验**：

- 面向**外部客户**、需要生态和长尾能力 → 公共市场思路，重点做审核、评分、责任划分。
- 面向**内部效率**、有数据合规要求 → 私有中心，重点做权限、租户、审计。
- 绝大多数企业：**先做私有中心，再把少数通用能力对外**。反过来几乎都失败。

::: danger 顺序别搞反
先建公共市场、再指望内部团队来上架，是典型的「先修高速公路再想有没有车」。内部没有强制复用机制，市场就会空着。
:::

## 04 技能市场 vs 技能中心 {#marketvscenter}

两个词经常被当成同义词，其实目标相反：

| | 技能市场 Marketplace | 技能中心 Registry |
| --- | --- | --- |
| 面向 | 外部开发者、生态 | 内部团队、租户 |
| 优化目标 | 发现、交易、增长 | 合规、稳定、可追责 |
| 技能质量 | 分层、评级、试用 | 白名单、审批、门禁 |
| 失败代价 | 差评、退款 | 事故、资损、审计问题 |
| 关键指标 | GMV、活跃开发者 | 复用率、事故率、平均接入时长 |

一个常被忽略的事实：**市场需要中心**。市场负责「有什么」，中心负责「能不能用」。支付宝能买东西，是因为背后有风控。

::: tip 人话翻译
市场是菜市场，中心是小区的门禁 + 物业。菜市场再热闹，你也不会让任何人直接进你家厨房。
:::

## 05 从工具调用到技能中心的演进 {#evolution}

<Diagram id="evolve" />

五级台阶，一级都不能跳：

| 级别 | 形态 | 你获得了什么 | 典型症状（该升级了） |
| --- | --- | --- | --- |
| L1 | 每个 Agent 硬编码函数 | 快 | 同一个工具写了三遍 |
| L2 | 抽成公共包 | 复用 | 升级把别人搞挂了 |
| L3 | 工具网关 | 统一鉴权、限流 | 不知道谁在调、调多少 |
| L4 | 技能中心 | 元数据、版本、租户、计费 | 技能上百，Agent 选不对 |
| L5 | 技能生态 | 跨团队/跨公司分发 | 需要认证、分成、责任划分 |

**大多数团队卡在 L2**：代码复用了，治理没有。表现出来就是「我们有个 tools 包」，但没人知道里面哪个函数还有人在用。

::: tip 升级的触发条件
不要为了架构而架构。看到下面任一信号，就该升一级：

- 同一个能力出现第 2 个实现
- 一次上游改动导致 ≥2 个 Agent 出问题
- 有人问「这个工具谁负责」
- 财务问「这个月模型/接口花了多少，按团队拆」
:::

## 06 四条最容易踩错的边界 {#boundary}

**1. MCP ≠ Skill Hub。**
MCP 定义「怎么把工具说清楚、传过去」。它不管租户、不管计费、不管谁能调。Hub 管这些。

**2. Skill ≠ Prompt。**
Skill 可以有提示词模板，但它必须绑定一个**可执行契约**（输入、输出、错误码）。只有提示词的是「提示模板」，不是技能。

**3. Tool ≠ API。**
一个 REST API 常常需要被包装才能当工具用：收敛参数、裁剪返回、补齐错误码、加超时。直接把 OpenAPI 丢给模型，通常参数太多、返回太大。

**4. Agent ≠ 调度器。**
Agent 负责「决定用哪个技能」，调度器负责「按什么顺序执行」。把编排逻辑写进 Agent 的提示词，是维护地狱的开始。

::: warning 边界测试三问
1. 这个能力要收费吗？→ 要，就必须是 Skill（要有计量）。
2. 这个能力会被别的团队直接调吗？→ 会，就必须有版本和权限。
3. 这个能力出错会伤到钱或数据吗？→ 会，就必须有错误码、超时和审计。
:::

## 参考来源 {#refs}

<Source href="https://python.langchain.com/docs/concepts/tools/" org="LangChain" label="Tools：工具定义与 args_schema" />
<Source href="https://platform.openai.com/docs/guides/function-calling" org="OpenAI" label="Function calling：从 Plugins 到 Actions 到 Tools 的演进" />
<Source href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview" org="Anthropic" label="Agent Skills：技能与工具的关系" />
<Source href="https://modelcontextprotocol.io/specification/latest/server/tools" org="MCP" label="Tools 规范：inputSchema 与调用语义" />

## 下一章 {#next}

概念分清了，接着看结构：[02 · 核心架构分层](/architecture/)。六层各管一段，缺一层就在别处加倍偿还。
