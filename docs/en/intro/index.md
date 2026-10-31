---
title: "00 · Opening: why your agent keeps reinventing the wheel"
description: What a team without a skill hub actually pays, what a hub is, how Skill / Tool / MCP / Agent relate, and where the hub sits in the stack.
outline: [2, 3]
---

# 00 · Opening: why your agent keeps reinventing the wheel

A real scene.

One company ran three agents: support, operations and an internal knowledge assistant. Three months later the boss asked why refunds had risen this month. Three teams each added an "order lookup" tool.

- Support read `order_v2`, field `status`.
- Operations read the warehouse table, field `order_state`.
- The knowledge assistant called the old API, which stopped being written to last month.

All three tools "worked". All three gave different answers. The boss asked: **which one is right?**

Nobody dared answer. Because none of those tools recorded who wrote it, which version it was, who was allowed to call it, or what changed last week.

::: tip The chapter in one line
Agents do not reinvent wheels. **People** do. What is missing is not model capability, but the layer where a capability is built once and reused everywhere.
:::

## 01 What a team without a hub pays {#pain}

<Diagram id="wheel" />

Nobody in that timeline is lazy. Each team worked hard. The failure is that **capability had nowhere to live**.

It rots in five places:

| Symptom | What it looks like | What it costs |
| --- | --- | --- |
| Duplicate builds | The same "order lookup" written 3–5 times | 3–10 dev-days each, and every bug fixed 5 times |
| Version drift | One caller on `v1`, one on the newest API | One upstream change, every agent breaks at once |
| Uncontrolled permissions | Anyone can call the refund tool, nobody knows who did | A money incident with no suspect; you shut the tool down |
| Careless descriptions | Tool says "queries data" | The agent guesses; ~40% of calls land on the wrong thing |
| No reuse | Every new project starts from zero | Each new scenario feels like the first agent ever built |

::: warning A counter-intuitive fact
More tools do not make an agent stronger. **More ungoverned tools make it pick wrong.** Chapter 07 covers this anti-pattern as "skill overload".
:::

## 02 What a skill hub is: an app store for agents {#what}

A **skill hub** is the platform where every capability an agent can call is **registered, discoverable, authorised, executed and metered**.

The everyday analogy: a phone app store.

| Phone world | Skill world |
| --- | --- |
| App | Skill |
| App store | Skill hub |
| App detail page (version, permissions, rating) | Skill manifest |
| Permission prompt on install | Scope check on invoke |
| Crash reports, ratings, delisting | Audit, evaluation, deprecation |
| System APIs (camera, location) | Underlying tools / MCP servers |

A hub must answer five questions. Miss one and it is not a hub:

1. **What exists** — registry and catalogue
2. **Who may use it** — permissions, tenants, quotas
3. **Which version** — versions, canary, rollback
4. **How it runs** — proxy, local, sandbox
5. **How much and by whom** — audit and metering

::: tip In plain words
A hub is not a Git repo of code, and not a spreadsheet of tools. It is an **execution entry point with permissions, versions and a ledger**. Agents know the hub; they never talk to the service behind it.
:::

## 03 Skill, Tool, MCP, Agent {#relation}

<Diagram id="four-roles" />

Four analogies, once each:

- **Tool = screwdriver.** It turns a screw; it has no idea what you are building.
- **Skill = "fix the tap".** Shut the valve, unscrew, replace the washer, and stop before you strip the thread. It bundles a few tools with instructions, permissions and a version.
- **MCP = the socket standard.** It defines the plug and the current. It generates no power and decides nothing about what you plug in.
- **Agent = the plumber.** Reads the situation, picks tools, does the work, changes approach when it fails.

In one block:

```text
Agent  uses   →  Skill (a capability pack)
Skill  speaks →  MCP (protocol) or calls a Tool (function)
MCP    only   →  defines how a tool is described and transported
Tool   only   →  takes input, returns output
```

::: warning The sentence people blur most
**MCP is not a skill hub, and a hub is not a protocol.** MCP defines how to talk; the hub decides who may talk, whether the answer counts, and how many times. Treating a list of MCP servers as a hub collapses at the first tenant-isolation requirement.
:::

## 04 Where the hub sits in the stack {#stack}

<Diagram id="hub-stack" />

It is a **capability middle layer**: consumers above (agents, workflow engines, business apps), implementations below (internal APIs, MCP servers, serverless functions, vendor SaaS).

Why not let agents connect directly?

| Direct connection | What the hub adds |
| --- | --- |
| Every agent reimplements auth | Auth once at the hub; the agent only carries user identity |
| Upstream renames a field, everything breaks | Pinned versions plus an adapter, switched inside the hub |
| No idea who calls what, or how often | Everything passes through, so the ledger exists by construction |
| Vendor skills reach the intranet | Allowlists and sandboxes; the intranet stays unexposed |
| No gradual rollout | Version split by tenant or percentage, enforced in one place |

::: tip In plain words
A hub is the front desk. Everyone enters through it, and the desk knows who you are, who you came to see, and whether you had an appointment. Walking past the desk is faster, until something goes wrong and nobody remembers you were there.
:::

## 05 The ten problems this book solves {#promise}

| # | Problem | Where it is solved |
| --- | --- | --- |
| 1 | Duplicate tool builds | [01](/en/concepts/#value) [05](/en/patterns/) |
| 2 | Bad descriptions, wrong calls | [03](/en/metadata/#describe) [12](/en/pitfalls/#desc) |
| 3 | Too many skills, blown context | [07](/en/discovery/#antipattern) |
| 4 | Permissions you cannot control | [06](/en/security/#model) |
| 5 | Untrusted vendor skills | [06](/en/security/#sandbox) [12](/en/pitfalls/#untrusted) |
| 6 | No versions, upgrades as outages | [04](/en/lifecycle/) |
| 7 | No way to find out who did it | [06](/en/security/#audit) |
| 8 | Retry storms taking down downstream | [12](/en/pitfalls/#retry) [14](/en/performance/#ratelimit) |
| 9 | No metering, no quotas | [05](/en/patterns/#billing) |
| 10 | Choosing a design and shipping it | [10](/en/landscape/) [11](/en/deploy/) |

## 06 How the ecosystem fits {#eco}

<Diagram id="eco-hub" />

The hub is the capability warehouse: **orchestration shops here, the gateway carries its traffic, observability watches its traces, evaluation guards its releases**.

| Sibling project | Division of labour | Chapter |
| --- | --- | --- |
| [better-agent](https://yuxinrun.github.io/better-agent/) | How the agent loop loads skills dynamically | [09](/en/ecosystem/#betteragent) |
| [mcp-patterns](https://yuxinrun.github.io/mcp-patterns/) | How the protocol exposes a skill | [08](/en/mcp/) |
| [a2a-patterns](https://yuxinrun.github.io/a2a-patterns/) | Sharing and delegating skills across agents | [09](/en/ecosystem/#a2a) |
| [agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/) | Memory-shaped skills | [09](/en/ecosystem/#memory) |
| [llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/) | Model traffic and cost behind a skill call | [09](/en/ecosystem/#gateway) |
| [agent-observability-patterns](https://yuxinrun.github.io/agent-observability-patterns/) | Traces and metrics | [09](/en/ecosystem/#observability) |
| [agent-evaluation-patterns](https://yuxinrun.github.io/agent-evaluation-patterns/) | Automated evaluation before release | [09](/en/ecosystem/#evaluation) |

::: tip One engineering discipline
All eight repos share **tenant_id / skill_id / trace_id**. When the ids do not line up, the bills do not reconcile and the trace breaks in the middle.
:::

## 07 Sources {#refs}

<Source href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview" org="Anthropic" label="Agent Skills: folder layout and progressive disclosure" />
<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="Specification: tools, resources, prompts" />
<Source href="https://platform.openai.com/docs/guides/function-calling" org="OpenAI" label="Function calling: description and call contract" />
<Source href="https://www.anthropic.com/engineering/building-effective-agents" org="Anthropic" label="Building effective agents: workflows versus autonomy" />

## Next {#next}

Separate the four words for good: [01 · Core concepts](/en/concepts/). Unclear concepts produce skewed schemas.
