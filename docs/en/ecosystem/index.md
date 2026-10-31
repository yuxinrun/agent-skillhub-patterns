---
title: 09 · Wiring into the ecosystem
description: How orchestration loads skills dynamically, cross-agent sharing, memory skills, gateway traffic, full-chain tracing and evaluation gates.
outline: [2, 3]
---

# 09 · Wiring into the ecosystem

A hub is not an island. It shares **one set of ids, one contract and one trace** with six sibling projects.

::: tip The chapter in one line
Eight repos compose into one system not because the interfaces are elegant, but because **three ids line up: tenant_id, skill_id, trace_id**. When they do not, bills do not reconcile, traces break and evaluations are wasted.
:::

## 00 The wiring diagram {#overview}

<Diagram id="eco-wiring" />

| Sibling | Owns | Interface with the hub | If misaligned |
| --- | --- | --- | --- |
| [better-agent](https://yuxinrun.github.io/better-agent/) | Agent loop, tool choice | `resolve` + `invoke` | Blown context, repeated wrong picks |
| [mcp-patterns](https://yuxinrun.github.io/mcp-patterns/) | Protocol exposure | MCP adapter | Every client differs |
| [a2a-patterns](https://yuxinrun.github.io/a2a-patterns/) | Agent-to-agent delegation | Capability card plus delegation token | Privilege abuse, no accountability |
| [agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/) | Memory read/write | Memory-shaped skills | PII leaks, memory poisoning |
| [llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/) | Model traffic and cost | Model calls inside skills | Cost cannot be attributed |
| [agent-observability-patterns](https://yuxinrun.github.io/agent-observability-patterns/) | Traces and metrics | trace injection | Debugging by guesswork |
| [agent-evaluation-patterns](https://yuxinrun.github.io/agent-evaluation-patterns/) | Evals and gates | Eval suites plus release block | Shipping on vibes |

## 01 better-agent: loading skills in the loop {#betteragent}

The loop has three steps: **read the catalogue, pick a skill, execute and digest the result**.

```python
# Minimal agent loop: always start from the catalogue, fetch schemas on demand
async def step(state):
    cat = await hub.catalogue(tenant=state.tenant, revision=state.rev)   # delta
    state.rev = cat["revision"]

    plan = await llm.plan(state.messages, catalogue=cat,
                          tools_hint=state.pinned)          # catalogue-level info only

    if plan.kind == "call":
        tools = await hub.resolve(plan.skill, tenant=state.tenant)       # full schema
        args = await llm.fill_args(plan, tools.input_schema)
        result = await hub.invoke(plan.skill, args,
                                  tenant=state.tenant, subject=state.subject,
                                  version=state.pins.get(plan.skill))    # pinned version
        state.messages.append(result.as_message())
    return state
```

Four conventions you must keep:

| Convention | Reason |
| --- | --- |
| Fetch catalogue and schema separately | Saves context and tokens per request |
| Pin versions for the session | Behaviour stays reproducible inside one conversation |
| Put error codes into the context | The model decides retry versus reroute |
| Summarise results before storing | Large payloads eat the window |

::: warning Do not retry in the orchestration layer
Agent-level retries stack on top of hub retries and become 3×3=9. **Retry exactly once, in the execution layer.** The agent's job is to change approach.
:::

## 02 a2a-patterns: sharing and delegation {#a2a}

<Source href="https://a2a-protocol.org/" org="A2A" label="Agent2Agent: capability cards and task delegation" />

Two things happen across agents: **discovering what the other can do**, and **asking it to act on the user's behalf**.

```json
// Capability cards should map directly from hub manifests
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
    # Key: exchange for a short-lived "on behalf of" token, never forward the caller's token
    return token_exchange(
        subject_token=caller_ctx.token,
        audience=target_agent,
        scope=scopes,                 # only what this task needs
        ttl=600,
        act={"sub": caller_ctx.subject, "agent": caller_ctx.agent_id},
    )
```

::: danger The one thing delegation must never do
Forwarding the caller's token hands over the user's full permissions and leaves the audit trail unable to show who acted. **Always exchange, narrow and shorten.**
:::

## 03 agent-memory-patterns: memory skills {#memory}

<Source href="https://yuxinrun.github.io/agent-memory-patterns/" org="Series" label="agent-memory-patterns: memory types and governance" />

Memory is rarely "a database". It usually surfaces as skills: `memory.recall`, `memory.write`, `profile.get`.

Three governance points:

| Point | Practice |
| --- | --- |
| Namespace isolation | `tenant/user/agent`; drop one and data crosses over |
| Writes need authorisation | A memory write is a side effect: scope plus audit |
| Reads need masking | Memory is where PII lives longest |

```yaml
name: memory.recall
version: 2.0.0
description: Retrieve long-term memory relevant to the current user (preferences, past conclusions). Use before answering personalised questions.
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

::: warning Memory writes are the most abused write
"Remember I like red" is harmless. "Remember my ID number" is an incident. **Memory writes need a field allowlist, PII interception and a user-visible delete.**
:::

## 04 llm-gateway-patterns: traffic through the gateway {#gateway}

Many skills call a model internally (summarise, classify, extract). Those calls **must not bypass the gateway**, or cost is invisible and rate limits do not apply.

```python
# A model call inside a skill: carry the skill dimension so cost can be attributed
def call_model(prompt, ctx, model="fast"):
    return gateway.complete(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        headers={
            "x-trace-id": ctx.trace_id,
            "x-tenant": ctx.tenant,
            "x-skill": ctx.skill_name,          # key: cost attribution
            "x-skill-version": ctx.skill_version,
        },
        budget=ctx.skill.cost_model.model_budget,   # per-call model budget cap
    )
```

| Dimension | Use |
| --- | --- |
| `x-skill` + `version` | "How much model spend did each skill consume" |
| `x-tenant` | Multi-tenant chargeback |
| `x-trace-id` | Align with invocation logs |

::: tip One field that answers the boss's question
"Rank this month's model spend by skill." With `x-skill` on every internal call it is one SQL query. Without it, it is two weeks of archaeology.
:::

## 05 agent-observability-patterns: tracing {#observability}

<Diagram id="obs-trace" />

<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="GenAI semantic conventions" />

One invocation should produce one span and propagate context downstream:

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

Four attributes that must be present:

| Attribute | Use |
| --- | --- |
| `trace_id` | Thread agent → hub → downstream → model |
| `skill.name` + `version` | Pinpoint the version |
| `tenant.id` | Latency and errors per tenant |
| `skill.error_code` | Separate business failure from system failure |

::: warning Sample in tiers
Full sampling at volume is bankrupting. **Sample 100% of errors and slow requests, 1–5% of successes** — but never sample the audit log (chapter 06).
:::

## 06 agent-evaluation-patterns: release gates {#evaluation}

<Source href="https://yuxinrun.github.io/agent-evaluation-patterns/" org="Series" label="agent-evaluation-patterns: suites and gates" />

Skill evaluation differs from agent evaluation: **it tests "picks right, passes right, result suffices"**.

| What | How | Pass line |
| --- | --- | --- |
| Selection accuracy | 100 utterances; did it pick this skill | ≥ 95%, wrong-pick ≤ 2% |
| Argument correctness | Are the args valid and semantically right | ≥ 98% |
| Result usefulness | Human or model rating: can the task finish | ≥ 90% |
| Regression | Compare with the previous version | No significant drop |
| Cost | Average tokens and latency | ≤ baseline × 1.2 |

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

::: danger A description change requires an eval run
The description is the selection signal. **Even with zero code changes, a description edit must pass selection accuracy**, or "improving the copy" becomes live misroutes.
:::

## 07 Suggested wiring order {#order}

Do not wire all eight at once. Order by immediate value:

1. **observability** — you cannot optimise what you cannot see
2. **gateway** — cost attribution; the boss will ask
3. **evaluation** — release gate against regressions
4. **better-agent** — dynamic loading for UX
5. **a2a** — cross-agent, the most complex
6. **memory** — memory skills, watch the PII

::: tip In plain words
Install the monitoring and the ledger before discussing performance or ecosystem. **Optimisation without telemetry is superstition; cost without a ledger is guesswork.**
:::

## 08 Sources {#refs}

<Source href="https://a2a-protocol.org/" org="A2A" label="Agent2Agent: capability discovery and delegation" />
<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="GenAI semantic conventions" />
<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="Protocol adaptation and capability negotiation" />
<Source href="https://yuxinrun.github.io/agent-memory-patterns/" org="Series" label="Memory layering and governance" />
<Source href="https://yuxinrun.github.io/agent-evaluation-patterns/" org="Series" label="Eval suites and quality gates" />

## Next {#next}

Ecosystem wired. Back to the practical question: which stack should you actually use? [10 · The landscape and how to choose](/en/landscape/).
