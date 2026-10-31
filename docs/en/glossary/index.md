---
title: Glossary
description: Thirty-six core terms about skill hubs, with plain-language definitions and chapter links.
outline: [2, 3]
---

# Glossary

Grouped by theme. Each entry has a plain-language version — if that is all you remember, you can still make decisions.

## 01 Capabilities and roles {#capability}

| Term | Plain language | Chapter |
| --- | --- | --- |
| Tool | A callable function; input and output only | [01](/en/concepts/#toolskill) |
| Skill | Tool plus description, schema, policy, version: a reusable capability pack | [01](/en/concepts/#toolskill) |
| Skill hub | The platform managing registry, discovery, permissions, versions, execution and billing | [02](/en/architecture/) |
| Marketplace | A place to distribute and trade skills with an external ecosystem | [01](/en/concepts/#marketvscenter) |
| Agent | The planner that picks skills and handles failures | [00](/en/intro/#relation) |
| Atomic skill | The smallest skill that does one thing and can be tested alone | [05](/en/patterns/#compose) |
| Composite skill | Several atomic skills wrapped into one outward promise | [05](/en/patterns/#compose) |
| Workflow skill | Fixed steps, branches and human approvals | [05](/en/patterns/#workflow) |

## 02 Protocols and schemas {#protocol}

| Term | Plain language | Chapter |
| --- | --- | --- |
| MCP | A standard for exposing tools, resources and prompts to models | [08](/en/mcp/) |
| MCP server | The side that offers capabilities over MCP | [08](/en/mcp/#bridge) |
| MCP client | The side that connects and calls (often the hub) | [08](/en/mcp/#bridge) |
| Tool calling | The model emits structured arguments, the host runs the function | [01](/en/concepts/#toolskill) |
| Actions | OpenAI's way of describing an external API with an OpenAPI schema | [03](/en/metadata/#examples) |
| Manifest | Structured document covering identity, contract, policy and operations | [03](/en/metadata/#fields) |
| JSON Schema | The standard for describing and validating JSON | [03](/en/metadata/#validate) |
| JSON-RPC | The request/response encoding MCP uses | [08](/en/mcp/#bridge) |
| SemVer | Major.minor.patch, expressing whether a change breaks callers | [04](/en/lifecycle/#publish) |

## 03 Governance and permissions {#governance}

| Term | Plain language | Chapter |
| --- | --- | --- |
| Tenant | The smallest isolation unit for data and quota | [05](/en/patterns/#tenancy) |
| Scope | What a skill may do, e.g. `orders:read` | [06](/en/security/#model) |
| Least privilege | Only the permissions this task needs, not one more | [06](/en/security/#model) |
| Quota | A cap on calls or cost per unit of time | [05](/en/patterns/#billing) |
| Canary | Let a small slice of real traffic try the new version first | [04](/en/lifecycle/#canary) |
| Deprecation | Discouraged but still callable, with a transition window | [04](/en/lifecycle/#sunset) |
| Rollback | Point traffic back at the last good version | [04](/en/lifecycle/#rollback) |
| Release gate | A human or automated check before risky skills ship | [06](/en/security/#approval) |

## 04 Execution and security {#execution}

| Term | Plain language | Chapter |
| --- | --- | --- |
| Sandbox | Run untrusted code boxed in, with limits on what it can touch | [06](/en/security/#sandbox) |
| Egress allowlist | Only allow listed domains, so data cannot be smuggled out | [06](/en/security/#abuse) |
| Masking | Replace sensitive fields before returning them | [06](/en/security/#data) |
| Prompt injection | Instructions hidden inside data, hijacking the model | [06](/en/security/#abuse) |
| Circuit breaker | Stop sending traffic to a failing dependency | [14](/en/performance/#ratelimit) |
| Bulkhead | Separate resource pools so one tenant cannot sink the rest | [14](/en/performance/#ratelimit) |
| Idempotency | The same request repeated produces the same result, charged once | [12](/en/pitfalls/#retry) |
| Cold start | The wait between spawning an instance and serving requests | [14](/en/performance/#coldstart) |

## 05 Operations and observability {#operations}

| Term | Plain language | Chapter |
| --- | --- | --- |
| Audit | Who called what, with which arguments, and what came back | [06](/en/security/#audit) |
| Metering | Counting calls, tokens and duration | [05](/en/patterns/#billing) |
| Tracing | One trace_id threading a request through every component | [09](/en/ecosystem/#observability) |
| Recall | Finding the plausibly relevant skills out of many | [07](/en/discovery/#hybrid) |
| Rerank | Ordering the candidates so the right one leads | [07](/en/discovery/#ranking) |
| Skill overload | Too many skills: wrong picks and a blown context window | [07](/en/discovery/#antipattern) |
| Reuse rate | How many teams or projects use the same skill | [10](/en/landscape/#matrix) |
| Quality gate | No release if evaluations do not pass | [09](/en/ecosystem/#evaluation) |

::: tip If you forget everything else
Three lines: **a skill is a capability pack, a hub is the governance layer, MCP is the protocol.** Look up the rest when needed.
:::
