---
title: 12 · The production pitfall catalog
description: Bad descriptions, skill overload, untrusted vendors, version drift, missing audit, privilege creep and retry storms — symptom, cause, containment, cure.
outline: [2, 3]
---

# 12 · The production pitfall catalog

Every entry here comes from a **real postmortem**. Symptom, cause, containment, cure — in that order, because that is the order you need during an incident.

::: tip The chapter in one line
All seven share one root: **a constraint was missing** — never a hard technical problem. The constraint always costs less than the incident.
:::

## 01 Bad descriptions, wrong calls {#desc}

**Symptom**: logs show phone numbers passed to `order.lookup`; `order.search` exists and is never called. Users complain the agent answers the wrong question.

**Cause**: the description said "queries order information" and nothing about *how* to look it up or *when not* to use it.

**Containment**: add trigger conditions and exclusions to the description.

```yaml
# before
description: Queries order information

# after
description: |
  Look up status, payment result and shipping milestones for one order id (12-20 digits).
  Use when the user supplies an order id or asks "where is my order" / "has this been paid".
  Do not use for search by phone or name; that is order.search.
```

**Cure**:

| Action | Effect |
| --- | --- |
| Four-part descriptions (what / when / when not / returns) | Misroutes drop quickly |
| A 100-utterance "should select" eval set | Run it before editing any description |
| Treat description edits as minor versions | Rollbackable and comparable |

::: warning Easy to misdiagnose
"The model is dumb" is the most common wrong conclusion. **Read the description first, count the similar skills second, suspect the model last.**
:::

## 02 Too many skills, no context {#explosion}

**Symptom**: input tokens go from 4k to 40k, cost up tenfold, accuracy down. The model wavers between three similar skills.

**Cause**: every request stuffed all skill schemas into the context.

**Containment**: cap visible skills now, optimise later.

```python
# Containment: Top-K plus a catalogue summary only
tools = build_tool_context(query, tenant)     # see chapter 07 pack_by_budget
assert token_count(tools) < 2500, "tool context budget exceeded"
```

**Cure**:

| Action | Note |
| --- | --- |
| Catalogue plus on-demand fetch | Send domains and counts by default |
| Merge similar skills | Eight `order.*` into three with an `action` argument |
| Retire anything with zero calls in 90 days | The library needs spring cleaning too |
| Layered routing | Domain skill first, route internally |

::: tip One hard budget
Cap tool-definition context at **2000 tokens**. Above that, retrieval is the problem, not the prompt.
:::

## 03 Untrusted skills exfiltrating data {#untrusted}

**Symptom**: days after adding a "web summarise" skill, an alert shows a machine POSTing user questions to an unknown domain.

**Cause**: the vendor skill ran inside the hub worker with network access and full arguments.

**Containment**: disable the skill, block egress, investigate what leaked.

```bash
hub skills disable web.summarize --reason "suspected exfiltration"
# also block egress at the network layer for that skill's runtime
```

**Cure**:

| Action | Note |
| --- | --- |
| Run in a sandbox | No network or an egress allowlist |
| Minimise arguments | Only the fields that task needs |
| Verify the supply chain | Pinned dependencies plus checksums |
| Vendor onboarding | Certifications, DPA, security review |

::: danger "They look legitimate"
A legitimate SaaS can be breached, and can train on your data. **Trust comes from isolation and contracts, not from impressions.**
:::

## 04 No versions, global outage {#version}

**Symptom**: a skill changed `status` from a string to an object; six agents failed to parse it the next morning.

**Cause**: no version, no compatibility check, edited in place.

**Containment**: restore the old shape or roll back immediately.

```python
# Compatibility shim: new shape in a new field, old field unchanged
return {
    "status": raw["status"]["code"],     # old field, same semantics
    "status_detail": raw["status"],      # new shape
}
```

**Cure**:

| Action | Note |
| --- | --- |
| Immutable versions per release | `1.4.0` artefacts are never overwritten |
| Automated compatibility classification | Removed field or changed type → major (chapter 04 script) |
| Callers pin versions | `latest` is refused |
| Keep the old version ≥ 7 days | Room to roll back |

::: warning The sneakiest break
"New required argument". Existing callers omit it and everything returns `INVALID_ARGUMENTS`. **If a default is possible, it must not be required.**
:::

## 05 No audit, no accountability {#noaudit}

**Symptom**: a ¥30,000 refund executed twice. Two days of digging produced only "some agent called it".

**Cause**: invocation logs recorded skill and time, but no actor, no trace, no idempotency key.

**Containment**: reconstruct from traces, and freeze related write skills.

**Cure**: four elements plus an idempotency key:

```json
{
  "ts": "2026-10-31T09:12:03.221Z",
  "actor": "user:u_8821",
  "on_behalf_of": "agent:cs-agent-3",
  "action": "invoke",
  "target": "order.refund.create",
  "version": "2.0.0",
  "decision": "allow",
  "trace_id": "01J9Z0K3...",
  "idempotency_key": "req_7f3a...",
  "args_digest": "sha256:9c1e..."
}
```

::: tip First principles of audit
It exists so that **ten minutes after an incident you can answer who approved it, who executed it, and how many times**. Anything less is decoration.
:::

## 06 Privilege creep and abuse {#privilege}

**Symptom**: a support account called `order.refund.create` through an agent and refunded ¥80,000. The skill had `tenant_scope: ["*"]` and `scopes: []`.

**Cause**: the skill declared no scopes, and the policy layer treated absence as "unrestricted".

**Containment**: declare scopes, then sweep for every skill with empty scopes.

```sql
-- Find every unguarded skill in 30 seconds
select name, version from skills
where scopes = '{}' and status = 'ga';
```

**Cure**:

| Action | Note |
| --- | --- |
| Scopes required, CI blocks empties | Default deny, not default allow |
| Risky scopes require approval | `refund:write` and friends |
| Authorisation in exactly one place | Chapter 06 |
| Periodic reverse lookup | From scope, which skills can invoke it |

::: danger Default allow is the most expensive default
"It is unrestricted unless declared" is pleasant in development and is **a backdoor for everyone** in production. The default must be deny.
:::

## 07 Retry storms take down downstream {#retry}

<Diagram id="retry-storm" />

**Symptom**: downstream times out at 3 seconds; five minutes later it is entirely down. QPS went from 200 to 4000.

**Cause**: agent retries 3× + hub 3× + SDK 3× = 27× amplification, with no backoff.

**Containment**: open the breaker at the gateway and drop retries to one.

```python
# The only retry policy: one layer, with backoff and jitter
def with_retry(fn, *, max_attempts=2, base=0.2, cap=2.0):
    for i in range(max_attempts):
        try:
            return fn()
        except RetryableError:
            if i == max_attempts - 1:
                raise
            delay = min(cap, base * 2 ** i)
            time.sleep(delay * (0.5 + random.random()))   # jitter avoids synchronised waves
```

**Cure**:

| Action | Note |
| --- | --- |
| Retry only in the execution layer | The agent reroutes instead |
| Retry only `retryable: true` | Retrying bad arguments burns money |
| Mandatory backoff and jitter | Prevents synchronised storms |
| Breakers and bulkheads | Chapter 14 |
| A retry budget | Global retries ≤ 10% of requests |

::: warning A counter-intuitive rule
**Retries are not a reliability mechanism; they are an availability amplifier.** They save you when downstream is healthy and kill you when it is not. That is why they must ship with a breaker.
:::

## 08 Quick reference {#summary}

| Pitfall | Root cause in one line | Cure in one line |
| --- | --- | --- |
| Bad descriptions | "When not to use" was missing | Four-part description plus eval set |
| Context blowout | Everything stuffed in | Catalogue, Top-K, budget |
| Vendor exfiltration | No isolation | Sandbox plus egress allowlist |
| Upgrade outage | No versions | Immutable versions plus compatibility classifier |
| No accountability | Logs are not audit | Four elements plus idempotency key |
| Privilege abuse | Default allow | Default deny, scopes required |
| Retry storms | Multiple retry layers | One layer, backoff, breaker |

## 09 Sources {#refs}

<Source href="https://www.anthropic.com/engineering/writing-tools-for-agents" org="Anthropic" label="Descriptions and selection accuracy" />
<Source href="https://owasp.org/www-project-top-10-for-large-language-model-applications/" org="OWASP" label="Data disclosure and supply chain risk" />
<Source href="https://www.rfc-editor.org/rfc/rfc9457" org="RFC 9457" label="Error semantics that prevent pointless retries" />
<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="Trace and error attribution fields" />

## Next {#next}

Pitfalls recognised. Time to build: [13 · Runnable demos](/en/demos/).
