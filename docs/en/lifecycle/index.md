---
title: 04 · The skill lifecycle
description: Seven stages — develop, publish, canary, launch, operate, sunset, roll back — with entry gates, checklists and commands.
outline: [2, 3]
---

# 04 · The skill lifecycle

A skill is not something you finish and forget. It is born, ages and dies like software. The difference: **its patients are agents, and agents do not complain, they fail silently.**

::: tip The chapter in one line
Seven stages, **one gate each**. Install the gates and you will not spend 3am asking why every agent suddenly calls the wrong skill.
:::

## 00 The seven stages {#overview}

<Diagram id="lifecycle" />

| Stage | Goal in one line | Exit condition |
| --- | --- | --- |
| Develop | Runs locally, contract tests pass | Schema checks, unit tests, fixture replay all green |
| Publish | Versioned with a changelog | Complete manifest, compatibility decision made |
| Canary | Small traffic proves it | Error rate, P95, misuse rate within bounds |
| Launch | Full rollout with notice | Docs synced, callers informed |
| Operate | Stays healthy | SLOs met, alerts reach someone |
| Sunset | Exits gracefully | Traffic near zero or migrated |
| Roll back | One switch back | Reverts in one action, data compatible |

::: warning 90% of incidents happen at two seams
**Publish → canary** (version not pinned, so it went 100%) and **sunset → rollback** (old version deleted, cannot go back). Both need automation.
:::

## 01 Develop locally {#dev}

The hard part is not the logic. It is **proving it works without touching real systems**.

Minimum layout:

```text
skills/order.lookup/
├── skill.yaml            # manifest
├── handler.py            # implementation
├── fixtures/             # inputs and expected outputs
│   ├── ok.json
│   ├── not_found.json
│   └── upstream_timeout.json
└── tests/test_contract.py
```

Contract tests must cover five classes:

```python
import pytest, json
from hub.local import LocalRuntime

runtime = LocalRuntime("skills/order.lookup/skill.yaml")

@pytest.mark.parametrize("case", ["ok", "not_found", "upstream_timeout"])
def test_fixtures(case):
    fx = json.load(open(f"skills/order.lookup/fixtures/{case}.json"))
    out = runtime.invoke(fx["args"], mocks=fx.get("mocks", {}))
    assert out["ok"] == fx["expect"]["ok"]
    if not out["ok"]:
        assert out["error"]["code"] == fx["expect"]["code"]

def test_schema_rejects_extra_field():
    out = runtime.invoke({"order_id": "123456789012", "foo": 1})
    assert out["error"]["code"] == "INVALID_ARGUMENTS"
```

The mandatory list:

| Case | Why it is mandatory |
| --- | --- |
| Happy path | The baseline |
| Invalid args (extra field, wrong type, too long) | The model will eventually send these |
| Downstream timeout | Verifies `retryable` is right |
| Downstream 5xx | Verifies no stack trace leaks to users |
| Empty result | Verifies no `null` that breaks the agent |
| Permission denied | Verifies the denial path leaks nothing |

::: tip In plain words
The output of development is not "code that runs", it is **code that can prove it is right**. Fixtures are the proof.
:::

## 02 Publish: versions and compatibility {#publish}

SemVer is not ceremony; it is **a promise to callers**:

| What changed | Bump | Example |
| --- | --- | --- |
| Bug fix, same behaviour | patch | 1.4.0 → 1.4.1 |
| New optional argument / new output field | minor | 1.4.0 → 1.5.0 |
| Removed field, changed type, changed error semantics | major | 1.4.0 → 2.0.0 |
| Description only | patch (but dangerous) | see below |

::: danger A description-only change can still break things
The description is the model's **selection signal**. Changing "look up orders" to "look up orders and refunds" sends refund questions to a skill whose implementation never changed. **Treat description changes as minor and run the eval set.**
:::

Automated pre-publish check:

```bash
hub publish skills/order.lookup --dry-run
```

```text
✔ manifest schema valid
✔ semver consistent with changelog
✔ breaking change detected? no
✔ error_codes all in shared catalogue
✔ scopes declared and owned by team
✔ description length 320 chars (<= 1024)
✔ fixtures replayed: 3/3 pass
✘ quota missing per_tenant_day  -> publish blocked
```

Compatibility classification (script it, do not memorise it):

```python
def classify(old, new) -> str:
    if set(old.output_schema) - set(new.output_schema):
        return "major"                       # removed field
    if changed_types(old, new):
        return "major"                       # changed type
    if set(old.error_codes) - set(new.error_codes):
        return "major"                       # callers cannot handle the loss
    if new.input_schema.required - old.input_schema.required:
        return "major"                       # new required argument
    if new.description != old.description or new.output_schema - old.output_schema:
        return "minor"
    return "patch"
```

::: warning New required arguments are the sneakiest break
Existing callers do not send them, so everything returns `INVALID_ARGUMENTS`. **If it can have a default, it must not be required.**
:::

## 03 Canary: whitelist ramps {#canary}

<Diagram id="canary" />

Canary is not "10% random traffic". It is **cutting traffic along controllable dimensions** with a clear pass/fail.

```python
def pick_version(skill, ctx) -> str:
    plan = canary_plan(skill.name)               # from config service, hot reloadable
    if not plan or not plan.active:
        return skill.channels["stable"]

    # 1. internal teams first: breakage stays inside
    if ctx.tenant in plan.internal_tenants:
        return skill.channels["canary"]

    # 2. willing tenants
    if ctx.tenant in plan.allowlist:
        return skill.channels["canary"]

    # 3. percentage, stable-hashed by tenant so a tenant never flaps
    if hash_bucket(ctx.tenant, buckets=100) < plan.percent:
        return skill.channels["canary"]

    return skill.channels["stable"]
```

Four metrics to watch:

| Metric | Pass line (example) | Note |
| --- | --- | --- |
| Error rate | ≤ old version + 0.5pp | Absolute thresholds produce false alarms; compare deltas |
| P95 latency | ≤ old × 1.2 | New versions quietly slow down |
| Misuse rate | No increase | Eval set plus manual sampling |
| Quota burn | No spike | Catches retry amplification |

::: danger Three classic canary mistakes
1. **Percentage without tenant stickiness** — the same user flips between versions and files duplicate tickets.
2. **No automatic abort** — metrics breach, nobody looks, and you run two versions for a quarter.
3. **No expiry** — three months later 30% of traffic is still on canary.
:::

```yaml
# A canary plan should carry its own exit conditions
canary:
  skill: order.lookup
  from: 1.4.0
  to: 1.5.0
  percent: 10
  internal_tenants: [cs, ops]
  allowlist: [tenant_a]
  abort_if:
    error_rate_delta: "> 0.005"
    p95_delta: "> 20%"
  max_duration_hours: 72
```

## 04 Launch: full rollout with notice {#ga}

Full rollout is not "set the percentage to 100". It is a **change with communication**:

- [ ] Caller list exported (who is on `1.4.x`)
- [ ] Changelog posted to the internal channel
- [ ] Docs site synced (description, examples, error codes)
- [ ] Dashboards split by version
- [ ] Old version kept for at least 7 days as a rollback window
- [ ] Eval results archived

```bash
hub release order.lookup@1.5.0 --to stable --notify cs-team,ops-team
```

::: tip One notice that saves a week
"`order.lookup` goes fully to 1.5.0 on Thursday. New `shipping` field, no breaking changes, rollback plan on the wiki. Ping @cs-platform with questions."
That beats ten pages of design docs.
:::

## 05 Operate: monitoring and capacity {#ops}

Four metrics, four failure shapes:

| Metric | Failure shape | Response |
| --- | --- | --- |
| Call volume spike | Upstream loop / retry storm | Rate limit, break, read traces |
| Error rate rise | Downstream change / expired credential | Look at the code distribution, not the total |
| P95 rise | Slow query / exhausted pool | Check downstream, degrade if needed |
| Quota burn | One noisy tenant | Limit that tenant, not everyone |

```yaml
alerts:
  - name: skill_error_rate
    expr: rate(invoke_error[5m]) / rate(invoke_total[5m]) > 0.02
    for: 10m
    action: page-oncall
  - name: skill_quota_burn
    expr: tenant_daily_usage / tenant_daily_quota > 0.9
    for: 30m
    action: notify-owner
```

::: warning Alert on codes, not totals
Error rate moving from 1% to 3% could be downstream jitter (wait) or a spike of `INVALID_ARGUMENTS` (your description or schema changed). The responses are opposites.
:::

## 06 Sunset: deprecate and archive {#sunset}

Correct order: **announce, degrade, delete.**

```text
T+0     mark deprecated: warning header on calls plus email to owner
T+30d   read-only / visible to legacy tenants only
T+60d   once traffic < 0.1%, return DEPRECATED_SKILL (still callable, loud warning)
T+90d   retire: return SKILL_RETIRED; keep metadata and audit, delete executables
```

```python
def check_deprecation(skill, ctx):
    d = skill.deprecation
    if not d:
        return
    if d.phase == "retired":
        raise SkillRetired(alternative=d.replacement)   # always offer a replacement
    ctx.warnings.append({
        "code": "DEPRECATED_SKILL",
        "sunset_at": d.sunset_at,
        "replacement": d.replacement,
    })
```

::: danger A sunset must name the replacement
Returning "this skill is retired" alone deadlocks the agent. Return `replacement: order.lookup@2` so the model can repair itself.
:::

## 07 Rollback in one action {#rollback}

A rollback needs three preconditions, otherwise it is just a restart:

1. **Snapshot exists** — the old version's full manifest is retrievable.
2. **Data compatible** — what the new version wrote, the old one can still read (or at least not crash on).
3. **Traffic cut is immediate** — the config lives in the registry, not in client caches.

```python
def rollback(skill_name: str, to_version: str, reason: str):
    skill = registry.get(skill_name)
    assert to_version in skill.versions, "target version missing"
    registry.set_channel(skill_name, "stable", to_version)
    registry.invalidate_cache(skill_name, scope="all")     # critical: every node
    audit.log(actor=current_user(), action="ROLLBACK",
              skill=skill_name, to=to_version, reason=reason)
```

| Type | Time | When |
| --- | --- | --- |
| Pointer rollback (switch channel) | Seconds | Code unchanged, new version is wrong |
| Image rollback (deploy old build) | Minutes | Execution container changed |
| Data rollback | Hours, careful | New version corrupted data; needs a repair script |

::: tip Rehearse it
Once a quarter, pick a random skill and roll it back within five minutes without reading docs. If you cannot, your rollback exists only in slides.
:::

## 08 Sources {#refs}

<Source href="https://semver.org/" org="SemVer" label="Semantic Versioning 2.0.0" />
<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="Capability negotiation and version compatibility" />
<Source href="https://docs.dify.ai/" org="Dify" label="Reference: platform-side version and release management" />
<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="Standard names for call and latency metrics" />

## Next {#next}

Process is clear. Now the core of the book: [05 · Eight production patterns](/en/patterns/). Eight patterns, eight pieces of copyable code.
