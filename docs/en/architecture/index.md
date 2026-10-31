---
title: 02 · The layered architecture
description: Six layers — access, registry, permissions, execution, operations, data — with interfaces, failure modes and a minimum implementation.
outline: [2, 3]
---

# 02 · The layered architecture

Layering is not for the diagram. It is so that when something breaks you know **which layer to open first**.

::: tip The chapter in one line
Six layers, one question each: **who may enter (access), what exists (registry), may they (permissions), how does it run (execution), how is it managed (operations), what is kept (data).**
:::

## 00 The whole picture {#overview}

<Diagram id="arch" />

One request falls through all six layers. Skipping any one is repaid as an incident:

| Layer | The one question | Cost of skipping |
| --- | --- | --- |
| Access | How does a caller reach me | Every client behaves differently |
| Registry | What exists, how is it found | The agent picks wrong or you dump everything into context |
| Permissions | Should this call be allowed | Privilege abuse, cross-tenant data |
| Execution | How does it actually run | Timeouts ignored, errors unreadable |
| Operations | Who changed what, how does it roll out | Every upgrade is an outage; no rollback |
| Data | What evidence remains | After an incident, no suspect |

## 01 Access: SDK, MCP, REST {#access}

<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="Specification: JSON-RPC and initialisation" />

The access layer is where **many doors are fine but only one internal contract is allowed**. Three doors, one hall:

1. **Agent SDK** — for your own agents; wraps retries, idempotency, trace injection.
2. **MCP adapter** — exposes hub skills over MCP so any compliant client can connect.
3. **REST / JSON-RPC** — for backends, low-code platforms and scripts.

Keep the internal contract to three actions:

```http
POST /v1/skills/resolve    # find a skill: schema, version, visibility
POST /v1/skills/invoke     # call it
POST /v1/skills/feedback   # return quality signal for evaluation and ranking
```

```python
# What invoke should look like: one function, four responsibilities
def invoke(skill: str, args: dict, *, tenant: str, subject: str,
           version: str | None = None, idempotency_key: str | None = None):
    payload = {
        "skill": skill,
        "version": version or "stable",     # never default to latest
        "args": args,
        "tenant": tenant,                  # from the token, not the body
        "trace_id": current_trace(),
        "idempotency_key": idempotency_key or uuid4().hex,
    }
    return http.post("/v1/skills/invoke", json=payload, timeout=30)
```

| Door | Good for | Bad for |
| --- | --- | --- |
| SDK | Own agents, unified telemetry | Third parties, many languages |
| MCP | Cross-vendor clients, IDEs, desktop | High-volume internal service calls |
| REST | Service-to-service, scripts, low-code | Streaming and long connections |

::: warning Do not let the door define the semantics
The same skill must return the **same permission outcome and the same error codes** from REST and from MCP. If it does not, your business logic lives in the adapter, not the core.
:::

## 02 Registry: metadata and search {#registry}

The registry is not "a JSON table". It is **the thing that lets an agent pick the right skill out of many**.

A minimal schema:

```sql
create table skills (
  skill_id      text primary key,          -- ulid, never changes
  name          text not null,             -- order.lookup
  display_name  text,
  description   text not null,             -- the part the model reads
  input_schema  jsonb not null,
  output_schema jsonb,
  scopes        text[] not null,
  owner         text not null,
  tenant_scope  text[] not null,           -- ['cs','ops'] or ['*']
  tags          text[] not null,
  status        text not null,             -- draft/canary/ga/deprecated
  created_at    timestamptz default now()
);

create table skill_versions (
  skill_id   text references skills(skill_id),
  version    text not null,                -- semver
  channel    text not null,                -- stable / canary / lts
  manifest   jsonb not null,               -- full manifest snapshot
  checksum   text not null,
  primary key (skill_id, version)
);
```

Two design decisions matter:

- **Split skill from version.** `skills` means "this thing exists"; `skill_versions` means "this shape of it". Merge them and canary becomes impossible.
- **Snapshot the manifest.** Publish a full manifest per version, so a rollback is a pointer move, not a rebuild.

Retrieval is hybrid (keyword plus vector) — chapter 07 covers it. The registry only has to guarantee: filter by `tenant_scope`, filter by `status`, filter by `tags`, then rank.

::: tip In plain words
The registry is the library catalogue, not the shelves. A messy shelf is survivable; a wrong catalogue means the book is lost forever.
:::

## 03 Permissions: auth and tenancy {#permission}

<Diagram id="call-seq" />

Authorisation must live in **exactly one place**, or every executor grows its own copy and they diverge.

```python
from dataclasses import dataclass

@dataclass
class Decision:
    allow: bool
    reason: str
    version: str | None = None
    remaining_quota: int | None = None

def authorise(skill, version, ctx) -> Decision:
    # 1. identity: subject comes from a signed token, never the body
    if not ctx.token.verified:
        return Decision(False, "UNAUTHENTICATED")

    # 2. visibility: tenant dimension
    if "*" not in skill.tenant_scope and ctx.tenant not in skill.tenant_scope:
        return Decision(False, "SKILL_NOT_VISIBLE")

    # 3. capability: scopes must be a subset of the subject's scopes
    missing = set(skill.scopes) - set(ctx.subject.scopes)
    if missing:
        return Decision(False, f"MISSING_SCOPE:{','.join(sorted(missing))}")

    # 4. quota: reserve, then refund on failure
    q = quota.reserve(ctx.tenant, skill.name, cost=skill.cost_model.estimate(ctx.args))
    if q.denied:
        return Decision(False, "QUOTA_EXCEEDED")

    return Decision(True, "OK", version=pick_version(skill, ctx), remaining_quota=q.left)
```

The order cannot change: **identity, visibility, capability, quota**. Reversed, you get two classic incidents: unauthorised callers burn the quota, or you charge before discovering they were never allowed.

::: danger Three rules that belong in code review
1. `tenant` comes from the token. **Never from request parameters.**
2. The version comes from the registry's `pick_version`. Callers may pin, but only to a whitelisted version.
3. Denials return a clear reason **to the platform**, and a sanitised one to end users — do not leak your internal scope taxonomy.
:::

## 04 Execution: sandbox and proxy {#execute}

<Diagram id="exec-modes" />

Four responsibilities: **pick the execution mode, enforce the timeout, normalise the result, record usage**.

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

    out = normalise(raw, skill.output_schema)      # trim and coerce types
    meter.record(ctx, skill, version, latency=now() - ctx.start)
    return Ok(out, trace_id=ctx.trace_id)
```

Choosing a mode:

| Mode | Latency | Security boundary | Good for |
| --- | --- | --- | --- |
| Proxy | +5–20ms | Strong: the hub is the only door | Internal APIs, billing, audit |
| Local | Lowest | Weak: code lands on the caller | High-frequency reads, offline |
| Sandbox | +50–300ms | Strongest: process and network limits | Vendors, user-supplied code |

::: warning Execution must enforce the timeout
A timeout configured only on the client is not a timeout. The execution layer **cuts the call** and returns `UPSTREAM_TIMEOUT` (retryable) rather than a generic 500.
:::

## 05 Operations: versions and billing {#ops}

Operations turns technical objects into operable assets:

| Capability | Minimum implementation | Without it |
| --- | --- | --- |
| Versions and channels | `stable / canary / lts` | Only full-fleet upgrades |
| Canary | Tenant allowlist plus percentage | Incidents force a global rollback |
| Approval | Risky scopes need a human | Someone ships a drop-table skill |
| Metering | Per call, per token, per second | Costs cannot be attributed |
| Reporting | Volume, error rate, P95, top callers | Operations by vibes |

Fix the billing formula up front instead of retrofitting it:

```text
cost = calls × price_per_call
     + (input_tokens + output_tokens) / 1000 × price_per_1k_tokens
     + ceil(duration_ms / 1000) × price_per_second
```

::: tip In plain words
Operations is HR plus finance for skills: onboarding (publish), probation (canary), permanent (GA), performance review (dashboards), offboarding (sunset), payroll (billing).
:::

## 06 Data: metadata, logs, audit {#data}

<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="GenAI semantic conventions" />

Three stores, never one table:

| Store | Content | Retention | Access pattern |
| --- | --- | --- | --- |
| Metadata DB | Skills, versions, policies, tenants | Forever | Low writes, high reads |
| Invocation log | Args digest, latency, result code, usage | 30–180 days | High writes, time-partitioned |
| Audit store | Who did what to what, including sensitive ops | 1–3 years per policy | Append-only, immutable |

```sql
-- Invocation log: partition by day, not by tenant (tenant counts change)
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
  args_digest   text,               -- hash plus masked summary, never raw
  created_at    timestamptz default now()
) partition by range (created_at);
```

::: danger Never log raw arguments
"Store the whole request so debugging is easier" is the number one source of leaks. Store a **digest, masked key fields and a hash**; reproduce with a controlled replay keyed by trace_id.
:::

## 07 Failure modes by layer {#failures}

| Layer | Typical failure | How to locate it fast |
| --- | --- | --- |
| Access | Client versions diverge in behaviour | SDK version plus request headers |
| Registry | Skill missing or stale | `skill_versions.status` and cache TTL |
| Permissions | Intermittent `DENIED` | Token scope snapshot versus current policy |
| Execution | Timeouts ignored, error codes messy | Execution logs and downstream P99 |
| Operations | Canary has no effect | Inputs to `pick_version` |
| Data | Missing log rows | Async writer backlog |

## 08 Sources {#refs}

<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="Specification: capability negotiation" />
<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="GenAI semantic conventions" />
<Source href="https://docs.dify.ai/" org="Dify" label="Reference implementation: tools and workflows" />
<Source href="https://platform.openai.com/docs/actions" org="OpenAI" label="GPT Actions: describing external capability" />

## Next {#next}

Architecture settled. Next comes the layer people skip and agents suffer for: [03 · Metadata and schemas](/en/metadata/).
