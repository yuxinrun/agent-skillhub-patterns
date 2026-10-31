---
title: 07 · 技能发现、匹配与推荐
description: 关键词与语义混合检索、启动时发现、按需加载与上下文预算、个性化推荐、评分排序公式，以及技能过载反模式。
outline: [2, 3]
---

# 07 · 技能发现、匹配与推荐

技能少的时候，发现不是问题；技能超过 50 个，**发现就成了 Agent 表现的第一瓶颈**。

::: tip 全章一句话
发现层的目标不是「把技能都列出来」，而是**在有限的上下文里，把最该用的那 5 个放到模型眼前**。
:::

## 01 关键词 + 语义混合匹配 {#hybrid}

<Diagram id="discover" />

<Source href="https://python.langchain.com/docs/concepts/tool_calling/" org="LangChain" label="Tool calling：模型如何选择工具" />

单用任何一种都会翻车：

| 方式 | 强项 | 弱项 |
| --- | --- | --- |
| 关键词（BM25） | 精确命名词，如 `refund`、`order_id` | 用户说「钱能退吗」就找不到 |
| 语义（向量） | 理解同义表达 | 会把「退款」和「换货」混在一起 |
| 混合 + 重排 | 两者互补 | 要维护两套索引 |

```python
def recall(query: str, tenant: str, k: int = 30) -> list[Candidate]:
    # 1. 关键词召回：按 name / tags / description 分词匹配
    kw = bm25.search(query, filter={"tenant": tenant, "status": "ga"}, top_k=20)

    # 2. 语义召回：描述向量相似度
    vec = embed(query)
    sem = vector_store.search(vec, filter={"tenant": tenant, "status": "ga"}, top_k=20)

    # 3. 融合：RRF（倒数排名融合），不依赖分数可比性
    scores = {}
    for rank, hit in enumerate(kw):
        scores[hit.id] = scores.get(hit.id, 0) + 1 / (60 + rank)
    for rank, hit in enumerate(sem):
        scores[hit.id] = scores.get(hit.id, 0) + 1 / (60 + rank)
    return sorted(scores.items(), key=lambda x: -x[1])[:k]
```

::: tip 为什么用 RRF 而不是加权求和
关键词分和向量分的量纲完全不同，直接加权要不停调参。**倒数排名融合只看名次，不看绝对分数**，跨技能类型更稳。
:::

::: warning 过滤要在召回之前
先按租户、状态、权限过滤，再做向量检索。**先检索再过滤，会返回一堆你看不见的技能，还浪费上下文。**
:::

## 02 Agent 启动时自动发现 {#autodiscover}

Agent 启动时不该拉全量技能清单，而是拉**一份能力目录（catalogue）**：

```json
GET /v1/catalogue?tenant=cs&locale=zh
{
  "revision": "2026-10-31T09:12:00Z#af31",
  "domains": [
    {"id": "cs", "name": "客服", "count": 18,
     "capabilities": ["read", "write"], "top_tags": ["order", "refund", "logistics"]}
  ],
  "pinned": ["order.lookup@1.4.0", "ticket.create@2.0.0"],
  "etag": "\"af31\""
}
```

只有几 KB，模型可以据此判断「大概该往哪个领域找」，再按需拉具体技能。三个要点：

| 要点 | 做法 |
| --- | --- |
| 增量 | 带 `revision` / `etag`，变了才拉全量 |
| 缓存 | 本地缓存 5~15 分钟，加 jitter 防雪崩 |
| 降级 | Hub 不可用时用上次缓存 + 明确告知 |

::: danger 不要在启动时把 300 个技能塞进 system prompt
这既烧钱又降低准确率。**上下文不是仓库，是工作台。**
:::

## 03 动态加载与上下文预算 {#lazy}

<Diagram id="lazy-load" />

<Source href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview" org="Anthropic" label="Agent Skills：渐进式披露" />

渐进式披露（progressive disclosure）是这一节的核心思想：

```python
BUDGET_TOKENS = 2000            # 给技能描述的总预算

def build_tool_context(query: str, tenant: str) -> list[dict]:
    # 1. 先给「目录级」信息：领域 + 能力 + 数量（约 150 tokens）
    ctx = [catalogue_summary(tenant)]

    # 2. 判断是否需要明细
    if needs_detail(query):
        cands = recall(query, tenant, k=30)
        ranked = rerank(query, cands)          # 见 05 节
        # 3. 按预算装：高分技能给完整 schema，低分只给一行描述
        ctx += pack_by_budget(ranked, BUDGET_TOKENS)
    return ctx

def pack_by_budget(ranked, budget):
    out, used = [], 0
    for i, c in enumerate(ranked):
        full = schema_tokens(c)
        if i < 5 and used + full <= budget:      # 前 5 个给完整定义
            out.append(c.to_tool_schema()); used += full
        elif used + 40 <= budget:                 # 其余只给名字 + 一句话
            out.append({"name": c.name, "description": c.short}); used += 40
        else:
            break
    return out
```

| 策略 | 效果 | 代价 |
| --- | --- | --- |
| 全量塞入 | 简单 | 上下文爆、准确率降、成本高 |
| Top-K 完整定义 | 平衡 | 需要好的召回 |
| 目录 + 按需展开 | 最省 | 多一次往返 |
| 全部摘要 + 二级调用 | 极省 | 延迟增加，需设计二次查询技能 |

::: tip 人话翻译
就像点菜：先看菜单分类（目录），再让服务员拿具体几页（Top-K），而不是把整本菜谱背下来。
:::

## 04 个性化推荐 {#recommend}

同一个问题，客服和财务应该看到不同的技能排序。个性化信号按可靠性排序：

| 信号 | 可靠性 | 获取成本 |
| --- | --- | --- |
| 角色 / 部门 | 高 | 低（token 里就有） |
| 当前会话意图 | 高 | 低（已有 query） |
| 该租户历史选择 | 中高 | 低（统计） |
| 该用户历史选择 | 中 | 中（需埋点） |
| 全局热度 | 低 | 低 |

```python
def personalise(cands, subject, tenant):
    for c in cands:
        boost = 0.0
        if c.domain in ROLE_DOMAINS[subject.primary_role]:
            boost += 0.15                     # 角色匹配
        boost += 0.10 * tenant_affinity(tenant, c.id)     # 租户偏好（0~1）
        boost -= 0.20 * recently_failed(subject, c.id)    # 最近失败过的降权
        c.score *= (1 + boost)
    return cands
```

::: warning 个性化不要压过正确性
Boost 幅度建议控制在 ±20% 以内。给某个角色加成过多，会让它在不该用的场景也排第一——**这是「推荐系统毁掉准确率」的经典路径**。
:::

## 05 评分与排序公式 {#ranking}

<Diagram id="ranking" />

排序 = **相关性 × 质量 × 可用性**，三者相乘而不是相加（任何一个为 0，结果就该是 0）。

```python
def score(c, query, ctx) -> float:
    relevance = 0.5 * c.rrf_score + 0.5 * cos_sim(query, c.description)
    quality = (0.6 * c.success_rate_30d
               + 0.2 * normalized_rating
               + 0.2 * (1 - c.incident_rate_30d))
    availability = 1.0
    if c.status == "canary":   availability *= 0.9
    if c.status == "deprecated": availability *= 0.3
    if breaker.is_open(c.id):  availability *= 0.0
    cost_penalty = 1 / (1 + c.avg_cost * 10)      # 成本高的轻微降权
    return relevance * quality * availability * cost_penalty
```

| 因子 | 数据来源 | 刷新频率 |
| --- | --- | --- |
| 相关性 | 检索 + 重排模型 | 实时 |
| 成功率 | 调用日志聚合 | 小时 |
| 评分 | 人工 + 反馈 | 天 |
| 事故率 | 告警系统 | 实时 |
| 成本 | 计量系统 | 天 |

::: danger 别把「调用量最高」当最优
调用量高可能只是因为它在提示里被写死了。**用成功率与误调用率，而不是纯热度**，否则新技能永远上不来。
:::

## 06 反模式：技能过载 {#antipattern}

<Source href="https://www.anthropic.com/engineering/writing-tools-for-agents" org="Anthropic" label="工具过多时的上下文与选择成本" />

技能越多越强？错。三个具体症状：

| 症状 | 表现 | 数据信号 |
| --- | --- | --- |
| 选择困难 | 模型在相似技能间摇摆 | 同一 query 的调用方差大 |
| 上下文爆炸 | 每次请求都塞满 schema | 输入 token 线性增长 |
| 静默误用 | 调了看起来对但不该用的技能 | `MISSING_SCOPE` 与 `INVALID_ARGUMENTS` 升高 |

四种解法，按代价排序：

1. **合**：把 8 个 `order.*` 收敛成 3 个（用 `action` 参数区分）。最有效。
2. **藏**：低频技能不进默认上下文，靠目录 + 二次检索发现。
3. **分层**：先给领域级技能（`cs.assist`），内部再路由到具体技能。
4. **删**：90 天零调用的技能直接下线。**技能不是资产，是负债。**

::: tip 一个硬指标
单个 Agent 的默认可见技能数，建议 **≤ 30**；完整 schema 塞进上下文的，建议 **≤ 8**。超过这个数，先优化检索，别调提示词。
:::

## 参考来源 {#refs}

<Source href="https://www.anthropic.com/engineering/writing-tools-for-agents" org="Anthropic" label="工具数量、描述质量与选择准确率" />
<Source href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview" org="Anthropic" label="Agent Skills：渐进式披露" />
<Source href="https://python.langchain.com/docs/concepts/tool_calling/" org="LangChain" label="Tool calling 的选择机制" />
<Source href="https://modelcontextprotocol.io/specification/latest/server/tools" org="MCP" label="tools/list 的过滤与分页" />

## 下一章 {#next}

发现搞定，接下来是本书与协议的交汇点：[08 · 与 MCP 深度融合](/mcp/)。
