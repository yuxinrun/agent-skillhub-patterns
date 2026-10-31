---
title: 01 · Core concepts, settled
description: Tool versus skill, the three values of a hub, public marketplace versus internal registry, the five-rung evolution, and four boundaries people blur.
outline: [2, 3]
---

# 01 · Core concepts, settled

No code in this chapter. Just words. Because most design mistakes later trace back to two people defining one word differently.

::: tip The chapter in one line
**A tool is the smallest unit of capability, a skill is a governable capability pack, a hub is the governance itself, and MCP is the transport.** Learn those four and everything else follows.
:::

## 01 Tool versus skill {#toolskill}

<Diagram id="tool-vs-skill" />

Start with the plainest code. This is a **tool**:

```python
def get_order(order_id: str) -> dict:
    row = db.query("select * from orders where id = %s", order_id)
    return {"id": row.id, "status": row.status}
```

Now the same thing as a **skill** — notice what appears:

```yaml
name: order.lookup
version: 1.4.0
display_name: Look up an order
description: >
  Look up the current status, payment result and shipping milestones for one order id.
  Use when the user supplies an order id or asks whether an order has been paid.
  Do not use for searching by phone number; that is order.search.
input_schema:  { order_id: {type: string, pattern: "^[0-9]{12,20}$"} }
output_schema: { status, paid_at, shipping }
scopes: [orders:read]            # what it may do
tenant_visibility: [cs, ops]     # who may see it
quota: { per_minute: 600, per_tenant_day: 200000 }
timeout_ms: 2000
error_codes: [ORDER_NOT_FOUND, ORDER_LOCKED, UPSTREAM_TIMEOUT]
owner: cs-platform
```

The difference is not the code, it is the **contract**. A tool has a signature; a skill has a manual, validation, permissions, quotas, a version, an owner and error semantics.

| Dimension | Tool | Skill |
| --- | --- | --- |
| Focus | Can it run | Should it run, by whom, how often |
| Change impact | Changes silently under callers | Versioned: canary and rollback |
| Permissions | Usually hard-coded | Declared policy, per tenant or role |
| Failure semantics | Raises an exception | Standard codes the agent can reason about |
| Metering | None | Calls, latency and cost are billable |
| Ownership | Unknown | Owner, SLA and deprecation plan on record |

::: tip In plain words
A tool knows how to cook one dish. A skill is the dish on the menu: the recipe, who may order it, how many per day, and what happens when the chef changes. Restaurants put things on menus because of the second part.
:::

::: warning A common shortcut
"We put the functions in a shared package, so we have a hub now." No. **A shared package solves reuse; it does not solve control.** Without versions, permissions and audit, it becomes a company-wide outage on the second upgrade.
:::

## 02 The three values of a hub {#value}

<Diagram id="hub-values" />

**Reuse (saves people)** — build once, call everywhere. The payoff is not the five builds avoided; it is the bug you fix once.

**Governance (saves incidents)** — versions, canaries, quotas, launch and sunset notices. Without it, one upgrade takes every agent down together.

**Security (the floor)** — least privilege, sandboxes, audit. Nobody praises this layer, and it is the only thing that saves you when something goes wrong.

They cannot exist alone:

| Only this | You get | Looks like |
| --- | --- | --- |
| Reuse | A shared package anyone can break | A common code repo |
| Governance | Approval forms nobody wants to fill | Process hell |
| Security | Everything locked, nothing usable | Compliance theatre |

::: tip Is it really a hub?
Ask three questions. Does upgrading a skill require changing caller code? Can you find out who called the refund skill last month? Does a new skill need human review? Three yeses, and it qualifies.
:::

## 03 Public versus private hubs {#publicprivate}

<Diagram id="public-private" />

| Dimension | Public hub | Private hub |
| --- | --- | --- |
| Typical form | Open marketplace, public MCP index | Internal capability platform |
| Who publishes | Anyone | Internal teams plus vetted vendors |
| Hard problem | Trust and uneven quality | Permissions, isolation, duplication |
| How it pays | Subscription, revenue share, traffic | Cost saving, reuse, compliance |
| Cold start | Needs volume | Needs one real business case |

Rules of thumb:

- **External customers, ecosystem and long-tail capability** → marketplace thinking; invest in review, ratings and liability.
- **Internal efficiency with data obligations** → private registry; invest in permissions, tenancy and audit.
- Most enterprises: **build the private hub first, then expose a few generic skills**. The reverse order almost always fails.

::: danger Do not reverse the order
Building a marketplace first and hoping internal teams will populate it is "pave the motorway, then look for cars". Without a mandate to reuse, the shelves stay empty.
:::

## 04 Marketplace versus registry {#marketvscenter}

The words are used interchangeably; the goals are opposite:

| | Marketplace | Registry |
| --- | --- | --- |
| Audience | External developers | Internal teams and tenants |
| Optimises for | Discovery, transactions, growth | Compliance, stability, accountability |
| Quality control | Tiers, ratings, trials | Allowlists, approvals, gates |
| Failure cost | Bad reviews, refunds | Incidents, money loss, audit findings |
| Key metric | GMV, active developers | Reuse rate, incident rate, time to integrate |

One overlooked fact: **a marketplace needs a registry**. The marketplace answers "what exists"; the registry answers "may you use it". You can buy things online because someone runs the risk engine.

::: tip In plain words
The marketplace is the food market; the registry is your building's lock and building manager. However lively the market, you do not let strangers into your kitchen.
:::

## 05 From one call to a hub {#evolution}

<Diagram id="evolve" />

Five rungs. Do not skip any.

| Rung | Shape | What you gain | Symptom that you need the next rung |
| --- | --- | --- | --- |
| L1 | Each agent hard-codes functions | Speed | The same tool exists three times |
| L2 | A shared package | Reuse | An upgrade breaks someone else |
| L3 | A tool gateway | Central auth and rate limits | Nobody knows who calls what, or how much |
| L4 | A skill hub | Metadata, versions, tenants, billing | Hundreds of skills; the agent picks wrong |
| L5 | A skill ecosystem | Cross-team and cross-company distribution | Certification, revenue share, liability |

**Most teams stall at L2**: code is shared, governance is not. It looks like "we have a tools package", and nobody knows which functions inside are still used.

::: tip Upgrade triggers
Do not build architecture for its own sake. Any of these means move up a rung:

- A second implementation of the same capability appears
- One upstream change breaks two or more agents
- Someone asks who owns a tool
- Finance asks what this month's model and API spend was, split by team
:::

## 06 Four boundaries people blur {#boundary}

**1. MCP is not a hub.** MCP defines how to describe and transport a tool. It knows nothing about tenants, billing or who may call. The hub does.

**2. A skill is not a prompt.** A skill may contain prompt templates, but it must bind an **executable contract** — input, output, error codes. Prompts alone are templates, not skills.

**3. A tool is not an API.** A REST endpoint usually needs wrapping before a model can use it: fewer parameters, trimmed payloads, real error codes, a timeout. Handing an OpenAPI document straight to a model usually means forty parameters and a wall of JSON.

**4. An agent is not a scheduler.** The agent decides *which* skill; the scheduler decides *in what order*. Moving orchestration into the prompt is how maintenance hell begins.

::: warning The three-question boundary test
1. Will this be charged for? → Then it must be a skill, because metering must exist.
2. Will another team call it directly? → Then it needs versions and permissions.
3. Can failure cost money or data? → Then it needs error codes, timeouts and audit.
:::

## 07 Sources {#refs}

<Source href="https://python.langchain.com/docs/concepts/tools/" org="LangChain" label="Tools: definitions and args_schema" />
<Source href="https://platform.openai.com/docs/guides/function-calling" org="OpenAI" label="Function calling: from Plugins to Actions to Tools" />
<Source href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview" org="Anthropic" label="Agent Skills: how skills relate to tools" />
<Source href="https://modelcontextprotocol.io/specification/latest/server/tools" org="MCP" label="Tools: inputSchema and call semantics" />

## Next {#next}

Words settled; now structure: [02 · The layered architecture](/en/architecture/). Six layers, each owning one job, each skipping repaid elsewhere.
