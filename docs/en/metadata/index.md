---
title: 03 · Skill metadata and schemas
description: Required fields, description craft, JSON Schema validation, standard error codes, taxonomy, and both a minimal and a production manifest.
outline: [2, 3]
---

# 03 · Skill metadata and schemas

The least glamorous layer, and the one that decides whether your agent picks the right skill. **Almost every wrong tool call has a metadata cause.**

::: tip The chapter in one line
Metadata is a contract with three readers: **the agent reads description and schema, the platform reads policy and quota, humans read docs and ownership.** Write for one and the other two will haunt you.
:::

## 01 Required fields {#fields}

<Diagram id="manifest" />

<Source href="https://modelcontextprotocol.io/specification/latest/server/tools" org="MCP" label="Tools: minimum name / description / inputSchema" />

Four groups. Each missing group produces a specific class of incident:

| Group | Fields | Read by | If missing |
| --- | --- | --- | --- |
| Identity | `name` `version` `owner` | Platform, humans | Nobody to page |
| Contract | `description` `input_schema` `output_schema` `error_codes` | The agent | Wrong picks, bad arguments, no retries |
| Policy | `scopes` `tenant_scope` `quota` `timeout_ms` | The platform | Privilege abuse, overload |
| Ops | `changelog` `deprecation` `sla` `cost_model` | Humans | No canary, no billing |

Naming convention (put this in CI):

```text
^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+(@\d+\.\d+\.\d+)?$
e.g. order.lookup, order.refund.create@1.4.0
```

- Use **domain.action**, not team names: `order.lookup` ✅, `cs_team_tool_2` ❌
- Verb last, so prefix search works
- **Never rename after release.** A rename is a new skill; the old one is deprecated.

::: warning The name is a permanent id, not a label
Renaming breaks audit, billing, caches and caller config. Want a prettier label? Change `display_name`.
:::

## 02 Descriptions that prevent misuse {#describe}

<Diagram id="desc-quality" />

<Source href="https://www.anthropic.com/engineering/writing-tools-for-agents" org="Anthropic" label="Writing effective tools for agents" />

A description is not a blurb; it is **the selection signal**. Four parts:

1. **What it does** — one verb-object sentence.
2. **When to use it** — the user utterances that should trigger it.
3. **When not to** — name the correct alternative. This is the most skipped and most valuable part.
4. **What it returns / how it fails** — so the model knows whether the answer suffices.

| Bad | Good |
| --- | --- |
| Queries order information | Look up status, payment result and shipping milestones for one order id. Use when the user gives a 12–20 digit order id or asks "where is my order" / "has this been paid". Do not use for search by phone (`order.search`) or address changes (`order.address.update`). Returns `status`/`paid_at`/`shipping`; returns `ORDER_NOT_FOUND` when absent — do not retry, ask the user to confirm the id. |

```yaml
description: |
  Look up status, payment result and shipping milestones for one order id.
  Use when: the user supplies a 12-20 digit order id, or asks "where is my order" / "has this been paid".
  Do not use for: search by phone or name (order.search); address changes (order.address.update).
  Returns: status (created|paid|shipped|done|cancelled), paid_at, shipping (array, may be empty).
  Failure: ORDER_NOT_FOUND (do not retry, confirm the id), ORDER_LOCKED (retry later).
```

::: tip The cheapest improvement available
State **"do not use for…"** and name the alternative skill. In practice this removes a large share of wrong calls, far more reliably than prompt tweaking.
:::

::: warning Keep business rules out of descriptions
"If the user is VIP and the order exceeds 500…" belongs in the implementation. Rules in the description teach the model to invent branches.
:::

## 03 Input validation {#validate}

<Source href="https://json-schema.org/" org="JSON Schema" label="Validation keywords" />
<Source href="https://platform.openai.com/docs/guides/function-calling" org="OpenAI" label="Function calling: strict mode" />

Three layers, all required:

1. **Model-side constraints** (`strict`, structured outputs) — encourage valid output.
2. **Hub-side validation** (JSON Schema) — trust nothing.
3. **Implementation guards** — types, lengths, business rules.

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
    return apply_defaults(args, INPUT)   # defaults are the hub's job, not the model's
```

Four details that pay for themselves:

| Detail | Why |
| --- | --- |
| `additionalProperties: false` | Otherwise the model adds fields your code silently ignores, and the bug is invisible |
| `enum` over free strings | Narrows values, removes implementation branches |
| Defaults applied by the hub | The model forgets fields constantly |
| Errors carry `path` | "Which field" beats "bad request" every time |

::: danger Never retry the same invalid arguments
`INVALID_ARGUMENTS` is not retryable. Show the model the field-level error so it **regenerates**, otherwise you pay twice for the same mistake.
:::

## 04 Standard error codes {#errors}

<Diagram id="error-flow" />

<Source href="https://www.rfc-editor.org/rfc/rfc9457" org="RFC 9457" label="Problem Details for HTTP APIs" />

One error envelope, so the agent can decide "retry or not":

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

Shared catalogue (do not let each skill invent its own):

| code | Meaning | retryable | What the agent should do |
| --- | --- | --- | --- |
| `INVALID_ARGUMENTS` | Args violate the schema | false | Fix arguments, then retry |
| `UNAUTHENTICATED` | No or expired token | false | Start the login flow |
| `MISSING_SCOPE` | Permission denied | false | Tell the user how to request access |
| `SKILL_NOT_VISIBLE` | Not visible to this tenant | false | Do not say "does not exist": avoids probing |
| `QUOTA_EXCEEDED` | Quota exhausted | false (today) | Degrade or explain the limit |
| `NOT_FOUND` | Target resource absent | false | Verify the identifier |
| `CONFLICT` | State conflict (double refund) | false | Read current state first |
| `UPSTREAM_TIMEOUT` | Downstream timeout | true (backoff) | Retry once or twice with backoff |
| `UPSTREAM_UNAVAILABLE` | Downstream down | true (limited) | Do not retry inside the breaker window |
| `INTERNAL` | Hub bug | maybe | Report with trace_id |

::: tip In plain words
Error codes are not log lines for ops; they are **instructions for the model**. `retryable: false` means "do not waste money", `true` means "come back shortly".
:::

::: warning Do not use HTTP status codes as error codes
A 502 could be a timeout, a bad gateway config or a crashed sidecar. The model cannot decide anything from 502. Give it semantics.
:::

## 05 Categories and tags {#taxonomy}

Tags serve **humans and retrieval**, not free-form model creativity. Three layers is the sweet spot:

```text
domain      finance / support / engineering / marketing   (top level, ≤ 10)
capability  read / write / compute / search               (verb class, ≤ 8)
attribute   pii / requires_approval / side_effect / idempotent  (risk flags, multi)
```

```yaml
taxonomy:
  domain: cs
  capability: read
  attributes: [idempotent, pii]
```

Design rules:

| Rule | Reason |
| --- | --- |
| Never more than three levels | Nobody maintains depth four, and search gets worse |
| Controlled vocabulary | Open tags become "order", "订单" and "单" within three months |
| Risk flags drive policy | `requires_approval` should auto-trigger the approval flow |
| Multiple tags, one primary category | Otherwise ranking is diluted |

::: warning More tags is not better
Fifteen tags on one skill flattens relevance. **One primary category, four attributes maximum.**
:::

## 06 Minimal and production examples {#examples}

**Minimal** (runs, but do not ship it):

```json
{
  "name": "order.lookup",
  "version": "0.1.0",
  "description": "Look up order status by order id. Use when the user supplies an order id; do not use for phone-number search.",
  "input_schema": {
    "type": "object",
    "required": ["order_id"],
    "additionalProperties": false,
    "properties": {"order_id": {"type": "string", "pattern": "^[0-9]{12,20}$"}}
  }
}
```

**Production** (ready for CI validation):

```json
{
  "name": "order.lookup",
  "version": "1.4.0",
  "channel": "stable",
  "display_name": "Look up an order",
  "description": "Look up status, payment result and shipping milestones for one order id. Use when the user gives a 12-20 digit order id or asks about progress. Do not use for search by phone (order.search) or address changes (order.address.update). Returns status, paid_at, shipping; fails with ORDER_NOT_FOUND or ORDER_LOCKED.",
  "owner": {"team": "cs-platform", "oncall": "cs-oncall@example.com"},
  "homepage": "https://wiki.example.com/skills/order.lookup",
  "input_schema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["order_id"],
    "properties": {
      "order_id": {"type": "string", "pattern": "^[0-9]{12,20}$", "description": "12-20 digit numeric order id"},
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
    {"version": "1.4.0", "date": "2026-03-02", "note": "Add shipping milestones, backward compatible"},
    {"version": "1.0.0", "date": "2025-11-18", "note": "First GA"}
  ]
}
```

::: tip One manifest, five consumers
The same JSON feeds the registry (snapshot), the MCP adapter (`inputSchema`), the OpenAI tools array (`parameters`), the docs site (generated page) and CI (schema checks). **Write once, consume everywhere** is the biggest leverage in metadata.
:::

## 07 Sources {#refs}

<Source href="https://modelcontextprotocol.io/specification/latest/server/tools" org="MCP" label="Tools: inputSchema and list/call semantics" />
<Source href="https://platform.openai.com/docs/guides/function-calling" org="OpenAI" label="Function calling: strict mode and parameter docs" />
<Source href="https://json-schema.org/" org="JSON Schema" label="Draft 2020-12 validation keywords" />
<Source href="https://www.anthropic.com/engineering/writing-tools-for-agents" org="Anthropic" label="Descriptions, return shapes, token efficiency" />

## Next {#next}

The manifest exists. Now: how does it travel from draft to sunset? [04 · The skill lifecycle](/en/lifecycle/).
