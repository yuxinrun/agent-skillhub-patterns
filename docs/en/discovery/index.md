---
title: 07 · Discovery, matching and ranking
description: Hybrid retrieval, startup discovery, lazy loading under a context budget, personalisation, a ranking formula and the skill-overload anti-pattern.
outline: [2, 3]
---

# 07 · Discovery, matching and ranking

Discovery is not a problem with five skills. Past fifty, **discovery becomes the top bottleneck on agent quality**.

::: tip The chapter in one line
Discovery does not exist to list everything. It exists to put **the five skills most likely to be right** in front of the model, inside a limited context.
:::

## 01 Keyword plus semantic matching {#hybrid}

<Diagram id="discover" />

<Source href="https://python.langchain.com/docs/concepts/tool_calling/" org="LangChain" label="How models select tools" />

Either method alone breaks:

| Method | Strength | Weakness |
| --- | --- | --- |
| Keyword (BM25) | Exact tokens like `refund`, `order_id` | Misses "can I get my money back" |
| Vector | Understands paraphrase | Confuses refund with exchange |
| Hybrid plus rerank | Complementary | Two indexes to maintain |

```python
def recall(query: str, tenant: str, k: int = 30) -> list[Candidate]:
    # 1. keyword recall over name / tags / description
    kw = bm25.search(query, filter={"tenant": tenant, "status": "ga"}, top_k=20)

    # 2. semantic recall on description embeddings
    vec = embed(query)
    sem = vector_store.search(vec, filter={"tenant": tenant, "status": "ga"}, top_k=20)

    # 3. fuse with reciprocal rank fusion; no score normalisation needed
    scores = {}
    for rank, hit in enumerate(kw):
        scores[hit.id] = scores.get(hit.id, 0) + 1 / (60 + rank)
    for rank, hit in enumerate(sem):
        scores[hit.id] = scores.get(hit.id, 0) + 1 / (60 + rank)
    return sorted(scores.items(), key=lambda x: -x[1])[:k]
```

::: tip Why RRF instead of a weighted sum
Keyword and vector scores live on different scales, so weighting means endless tuning. **Rank fusion only looks at positions**, which is far more stable across skill types.
:::

::: warning Filter before you search
Filter by tenant, status and permission first, then embed. **Search first, filter later returns invisible skills and wastes context.**
:::

## 02 Discovery at startup {#autodiscover}

An agent should not pull every skill at boot. It should pull a **catalogue**:

```json
GET /v1/catalogue?tenant=cs&locale=en
{
  "revision": "2026-10-31T09:12:00Z#af31",
  "domains": [
    {"id": "cs", "name": "Support", "count": 18,
     "capabilities": ["read", "write"], "top_tags": ["order", "refund", "logistics"]}
  ],
  "pinned": ["order.lookup@1.4.0", "ticket.create@2.0.0"],
  "etag": "\"af31\""
}
```

A few kilobytes is enough for the model to decide *which domain to look in*, then fetch details on demand. Three details:

| Detail | Practice |
| --- | --- |
| Delta | Ship `revision` / `etag`; refetch only when it changes |
| Cache | Local cache for 5–15 minutes with jitter to avoid stampedes |
| Degrade | If the hub is down, use the last cache and say so |

::: danger Never stuff 300 skill schemas into the system prompt
It burns money and reduces accuracy. **Context is a workbench, not a warehouse.**
:::

## 03 Lazy loading under a budget {#lazy}

<Diagram id="lazy-load" />

<Source href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview" org="Anthropic" label="Agent Skills: progressive disclosure" />

Progressive disclosure is the idea:

```python
BUDGET_TOKENS = 2000            # total budget for skill descriptions

def build_tool_context(query: str, tenant: str) -> list[dict]:
    # 1. domain-level information first (~150 tokens)
    ctx = [catalogue_summary(tenant)]

    # 2. decide whether detail is needed
    if needs_detail(query):
        cands = recall(query, tenant, k=30)
        ranked = rerank(query, cands)          # see section 05
        # 3. pack by budget: top skills get full schema, the rest one line
        ctx += pack_by_budget(ranked, BUDGET_TOKENS)
    return ctx

def pack_by_budget(ranked, budget):
    out, used = [], 0
    for i, c in enumerate(ranked):
        full = schema_tokens(c)
        if i < 5 and used + full <= budget:      # top 5 get full definitions
            out.append(c.to_tool_schema()); used += full
        elif used + 40 <= budget:                 # the rest get name plus one line
            out.append({"name": c.name, "description": c.short}); used += 40
        else:
            break
    return out
```

| Strategy | Effect | Cost |
| --- | --- | --- |
| Everything | Simple | Blown context, lower accuracy, higher spend |
| Top-K full schemas | Balanced | Needs good recall |
| Catalogue plus expansion | Cheapest context | One extra round trip |
| Summaries plus second lookup | Cheapest overall | Extra latency; needs a lookup skill |

::: tip In plain words
Ordering food: read the menu sections first, then ask for two pages. Do not memorise the whole recipe book.
:::

## 04 Personalised recommendations {#recommend}

The same question should rank differently for support and for finance. Signals ordered by reliability:

| Signal | Reliability | Cost |
| --- | --- | --- |
| Role / department | High | Low (already in the token) |
| Current intent | High | Low (you have the query) |
| Tenant history | Medium-high | Low (aggregate) |
| User history | Medium | Medium (needs tracking) |
| Global popularity | Low | Low |

```python
def personalise(cands, subject, tenant):
    for c in cands:
        boost = 0.0
        if c.domain in ROLE_DOMAINS[subject.primary_role]:
            boost += 0.15                     # role match
        boost += 0.10 * tenant_affinity(tenant, c.id)     # 0..1
        boost -= 0.20 * recently_failed(subject, c.id)    # demote fresh failures
        c.score *= (1 + boost)
    return cands
```

::: warning Never let personalisation outrank correctness
Keep boosts within ±20%. Over-boosting a role pushes it to the top in scenarios where it is wrong — **the classic path by which a recommender destroys accuracy**.
:::

## 05 Scoring and ranking {#ranking}

<Diagram id="ranking" />

Ranking = **relevance × quality × availability**, multiplied rather than summed (if any factor is zero, the result should be zero).

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
    cost_penalty = 1 / (1 + c.avg_cost * 10)      # expensive skills rank slightly lower
    return relevance * quality * availability * cost_penalty
```

| Factor | Source | Refresh |
| --- | --- | --- |
| Relevance | Retrieval plus reranker | Real time |
| Success rate | Invocation log aggregation | Hourly |
| Rating | Human plus feedback | Daily |
| Incident rate | Alerting system | Real time |
| Cost | Metering | Daily |

::: danger Do not equate "most calls" with "best"
High volume may just mean it is hard-coded in the prompt. **Use success and misuse rates, not raw popularity**, or new skills never surface.
:::

## 06 Anti-pattern: skill overload {#antipattern}

<Source href="https://www.anthropic.com/engineering/writing-tools-for-agents" org="Anthropic" label="Context and selection cost when tools multiply" />

More skills do not mean more capability. Three symptoms:

| Symptom | Looks like | Signal |
| --- | --- | --- |
| Indecision | The model wavers between similar skills | High variance in calls for one query |
| Context blowout | Every request is full of schemas | Input tokens grow linearly |
| Silent misuse | The plausible-looking but wrong skill gets called | Rising `MISSING_SCOPE` and `INVALID_ARGUMENTS` |

Four fixes, cheapest first:

1. **Merge** — collapse eight `order.*` skills into three with an `action` argument. Most effective.
2. **Hide** — keep low-frequency skills out of the default context; find them via catalogue plus a second lookup.
3. **Layer** — expose one domain skill (`cs.assist`) that routes internally.
4. **Delete** — retire anything with zero calls in 90 days. **Skills are liabilities, not assets.**

::: tip Two hard numbers
Keep default visible skills per agent **≤ 30**, and skills with full schemas in context **≤ 8**. Above that, fix retrieval before touching prompts.
:::

## 07 Sources {#refs}

<Source href="https://www.anthropic.com/engineering/writing-tools-for-agents" org="Anthropic" label="Tool count, description quality and selection accuracy" />
<Source href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview" org="Anthropic" label="Agent Skills: progressive disclosure" />
<Source href="https://python.langchain.com/docs/concepts/tool_calling/" org="LangChain" label="How tool selection works" />
<Source href="https://modelcontextprotocol.io/specification/latest/server/tools" org="MCP" label="tools/list filtering and pagination" />

## Next {#next}

Discovery solved. Now where this book meets the protocol: [08 · Deep integration with MCP](/en/mcp/).
