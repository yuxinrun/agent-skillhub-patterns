---
title: 10 · The landscape and how to choose
description: Pure MCP, platform marketplaces, a DIY base and cloud options compared on cost, effort, security and ecosystem, plus the smallest viable stack.
outline: [2, 3]
---

# 10 · The landscape and how to choose

Choosing is not picking the best. It is picking **the one your team can afford to run and your business can wait for**.

::: tip The chapter in one line
Four routes, three trade-offs: **run it yourself (control, expensive), let a platform run it (fast, locked in), let an ecosystem run it (rich, uncontrollable).**
:::

## 00 The decision tree {#overview}

<Diagram id="selection" />

```text
Do you have a dedicated platform team?
├─ No  → use a platform marketplace (Dify / FastGPT / cloud)
└─ Yes → who do you serve?
         ├─ A few internal teams      → pure MCP plus a thin registry (fastest)
         ├─ Many departments, compliance → build a light hub (this book)
         └─ An external ecosystem     → hub plus marketplace (hardest, last)
```

## 01 Pure MCP ecosystems {#mcp}

<Source href="https://modelcontextprotocol.io/" org="MCP" label="Official SDKs and sample servers" />
<Source href="https://github.com/modelcontextprotocol/registry" org="MCP" label="Registry: service discovery" />

**Shape**: MCP servers plus client configuration, or a public community index.

| Upside | Downside |
| --- | --- |
| Fastest start; running in a day | No tenants, quotas or billing |
| Broad client support (IDEs, desktop) | Every client configured separately; no central control |
| Standard protocol, cross-vendor | No canary; upgrades watched by hand |

**Good for**: three to five internal teams, fewer than 30 skills, no external charging.

::: warning Where pure MCP hits the ceiling
The moment any of these appears — "department A must not see department B's skills", "charge by call volume", "audit who called the refund skill" — pure MCP is done. **That is not an MCP flaw; it simply does not cover that layer.**
:::

## 02 Platform marketplaces {#platform}

<Source href="https://docs.dify.ai/" org="Dify" label="Tools and plugin marketplace" />
<Source href="https://marketplace.dify.ai/" org="Dify" label="Marketplace as a distribution pattern" />
<Source href="https://doc.fastgpt.in/" org="FastGPT" label="Skill libraries and workflows" />
<Source href="https://docs.langflow.org/" org="LangFlow" label="Components and visual flows" />

**Shape**: use Dify, FastGPT or LangFlow and their built-in tool systems.

| Upside | Downside |
| --- | --- |
| Live in a week, visually configured | The metadata model is the platform's |
| Auth, logs, workflows included | Multi-tenancy and billing vary by version |
| Rich community plugins | Deep customisation means forking, and upgrades hurt |

**Good for**: getting value fast with a thin platform team and unsettled requirements.

::: tip The right way to use a platform as a stepping stone
Validate with the platform, but **keep your skill manifests in your own repo following chapter 03**. Migrating to your own hub later becomes an import instead of a rewrite. It is the cheapest portability insurance available.
:::

## 03 A light DIY base {#diy}

<Source href="https://platform.openai.com/docs/actions" org="OpenAI" label="OpenAPI as a source of skill descriptions" />

**Shape**: an API gateway, a metadata database, a policy engine and logs. Three services minimum.

```text
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  gateway     │   │  registry    │   │  executor    │
│  auth/limits │──▶│  metadata    │──▶│  proxy/sbx   │
└──────────────┘   └──────────────┘   └──────────────┘
        │                  │                  │
        └──────────┬───────┴──────────────────┘
                   ▼
        Postgres (metadata plus partitioned logs)
```

Minimum viable build (three weeks):

| Component | Cheapest correct approach | Do not |
| --- | --- | --- |
| Gateway | Off the shelf (Kong / APISIX / Envoy) | Write your own HTTP proxy |
| Registry | Two Postgres tables (skills, versions) | Adopt a service mesh |
| Auth | JWT plus a scope table | Roll your own crypto |
| Execution | One async worker with timeouts | Build a sandbox on day one |
| Logs | Partitioned table plus scheduled archive | Push straight into ES (expensive) |

::: danger Where DIY runs away from you
Not technology — **scope**. People start with "marketplace plus billing plus sandbox plus recommendations" and ship nothing for six months. **Build the smallest loop that can charge and contain risk.**
:::

## 04 Cloud vendor options {#cloud}

<Source href="https://help.aliyun.com/" org="Aliyun" label="Function compute, API gateway, auth" />
<Source href="https://cloud.tencent.com/document/" org="Tencent Cloud" label="Cloud functions, API gateway, secret manager" />

**Shape**: cloud API gateway plus functions plus a secret manager plus log service.

| Upside | Downside |
| --- | --- |
| No operations burden, elastic | Vendor lock-in; migration is expensive |
| VPC, audit and secrets built in | Pricing models are complex and easy to overshoot |
| Compliance certifications in place | Cold starts and concurrency limits need measuring |

**Good for**: existing cloud footprint, high compliance demands, no appetite for running infrastructure.

::: warning The hidden costs
Function cold starts, cross-region traffic and log storage are where budgets die. **Load test with real traffic before you trust console estimates.**
:::

## 05 The full comparison matrix {#matrix}

| Dimension | Pure MCP | Platform | DIY | Cloud |
| --- | --- | --- | --- | --- |
| Time to first use | 1 day | 1 week | 3–6 weeks | 2–4 weeks |
| Metadata control | Low | Medium | High | Medium-high |
| Multi-tenancy | None | Version dependent | Buildable | Buildable (by design) |
| Billing and quotas | None | Partial | Buildable | Buildable |
| Sandboxing | None | None | Buildable | Strong (functions, containers) |
| Operations burden | Low | Low | High | Medium |
| Migration cost | Low | High | Low (you own the data) | High |
| Ecosystem richness | Medium | High | Low (you assemble it) | Medium |
| Three-year total cost | Low | Medium | High (people) | Medium-high |

::: tip How to read that table
The shortest **time to first use** usually comes with the lowest **metadata control**. That is not a coincidence: the time a platform saves you is paid for with control. The real question is whether you need that control *now*.
:::

## 06 The smallest viable stack {#smb}

If you have one to three engineers and cannot wait six months:

```text
Weeks 1-2   Platform (Dify / FastGPT) with standardised manifests (chapter 03)
Weeks 3-4   Move hot skills to MCP servers using the official SDK
Weeks 5-6   Add a thin gateway (off the shelf) for auth, rate limits and logs
Weeks 7-8   Manifests in Git; CI runs schema checks and the eval suite
After       Add billing and tenancy as needed (below 20 tenants, charge back manually)
```

**Do not build these at this size**:

| Skip | Why |
| --- | --- |
| Your own sandbox | Managed sandboxes are cheaper and safer |
| Your own vector search | Use the vector feature of a database you already run |
| Multi-tenancy from day one | Start with per-team logical isolation and refactor when tenant count grows |
| A marketplace UI | A Markdown index page is enough |

::: tip In plain words
The correct posture for a small team is **"get capability under control first, make the platform pretty later"**. The reverse means writing a login page for a platform nobody uses yet.
:::

## 07 Sources {#refs}

<Source href="https://modelcontextprotocol.io/" org="MCP" label="Official SDKs and samples" />
<Source href="https://docs.dify.ai/" org="Dify" label="Tools, plugins and workflows" />
<Source href="https://doc.fastgpt.in/" org="FastGPT" label="Skill library design" />
<Source href="https://docs.langflow.org/" org="LangFlow" label="Component-based orchestration" />
<Source href="https://help.aliyun.com/" org="Aliyun" label="API gateway and function compute" />
<Source href="https://cloud.tencent.com/document/" org="Tencent Cloud" label="Cloud functions and secret management" />

## Next {#next}

Stack chosen. Now ship it: [11 · Deploying and operating](/en/deploy/).
