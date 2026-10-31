---
title: 15 · Where this is going
description: Skill marketplaces and revenue share, autonomous skill evolution, A2A interop, certification and trust ratings.
outline: [2, 3]
---

# 15 · Where this is going

The first fourteen chapters were about running your own skills. This one changes the lens: **what happens when skills start moving between teams and between companies.**

::: tip The chapter in one line
The more open the network, the more it leans on the groundwork from earlier chapters — metadata, policy, audit. **Openness without groundwork is just an incident waiting for a date.**
:::

<Diagram id="future-hub" />

## 00 What changes, and what does not {#baseline}

| Changes | Does not change |
| --- | --- |
| Where skills come from (internal → marketplace) | The metadata contract (input/output schemas) |
| How they are priced (internal cost → external charge) | "Who called what" must stay traceable |
| The trust model (colleague → stranger) | Untrusted code must run isolated |
| The boundary (one agent → many platforms) | Permission by subject, scope, and volume |

So this chapter is not new material — it is **the earlier conclusions pushed to a bigger scale**.

## 01 Marketplaces and revenue share {#market}

### The everyday analogy

A neighbourhood pick-up locker versus a wet market. The locker holds only what your household ordered, so mistakes are yours. The market holds strangers' stalls: you check the scale, the origin, the inspection stamp. **A marketplace adds three things: a price tag, a quality claim, and someone accountable when it breaks.**

### What internal metering is missing

Internal billing (chapter 05's `reserve/settle`) only cares about quota. Charging externally needs four more answers:

| Question | Internal metering | External trade |
| --- | --- | --- |
| Unit | Calls are enough | Calls / tokens / seconds / outcome value, composable |
| Who pays | Department budget | Subscription, usage-based, prepaid, refundable |
| Author share | Does not exist | Platform cut plus author payout, reconcilable |
| Disputes | Slack message | SLA, refund rules, call receipts |

### The smallest billable manifest

```yaml
# skill.yaml — trading fields on top of the usual manifest
name: invoice.ocr
version: 2.1.0
description: Extract structured fields from invoice images. Use for scanned invoices; not for handwritten receipts.
input_schema:
  type: object
  required: [image_url]
  additionalProperties: false
  properties:
    image_url: { type: string, format: uri }

commercial:
  license: commercial-1.0          # internal / commercial-1.0 / research-only
  price:
    model: per_call                # per_call | per_token | per_second | subscription
    unit_price: 0.008              # in cents: integers, never floats
    currency: CNY
  settlement:
    platform_share: 0.30           # platform takes 30%
    author_share: 0.70             # author takes 70%
    min_payout_cents: 10000        # pay out above 100 CNY to cut transfer cost
  sla:
    availability: 0.995
    p95_ms: 2500
    refund_on_failure: true        # failures are free — the cheapest trust you can buy
```

### A minimal settlement

```python
from decimal import Decimal, ROUND_HALF_UP

def settle(call_row, skill_meta) -> dict:
    """Turn one successful call into three ledger entries"""
    price = skill_meta["commercial"]["price"]
    if price["model"] != "per_call":
        raise NotImplementedError("demo covers per-call only")

    amount = Decimal(price["unit_price"])            # unit: cents
    if call_row.status != "ok" and skill_meta["commercial"]["sla"]["refund_on_failure"]:
        amount = Decimal(0)                          # failures are not billed

    platform = (amount * Decimal(str(skill_meta["commercial"]["settlement"]["platform_share"]))
                ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    author = amount - platform

    return {
        "call_id": call_row.id,
        "tenant_charge_cents": int(amount),
        "platform_cents": int(platform),
        "author_cents": int(author),
        "author_id": skill_meta["owner"],
        "settled_at": call_row.finished_at,
    }
```

::: danger Three designs that kill a marketplace
1. **Charging for failures** — tolerable twice; by the third time the author's rating is gone.
2. **Per-call pricing with no caller ceiling** — an agent loops 300 times on one task and the bill is shocking. Always pair it with a per-task budget.
3. **Settling in floats** — one cent off and the author will email you forever. **Use integer cents or Decimal.**
:::

### Marketplace dashboard sample

| Metric | Definition | Why it matters |
| --- | --- | --- |
| GMV | Settled call volume | Market size |
| Take rate | platform_cents / total | Platform health |
| Refund rate | Failed-and-free volume / GMV | Quality signal; investigate above 3% |
| Author retention | Authors with revenue two months running | Supply-side health |
| Concentration | Top-3 skill share of revenue | Too high means a thin ecosystem |

## 02 Autonomous skill evolution {#evolution}

### The everyday analogy

A master writes the recipe (humans author skills) → an apprentice follows it and notes where the pan always burns (mine failure patterns from traces) → the apprentice rewrites a version and cooks it ten times alone (offline evaluation) → three tables get a taste (canary) → only then does it enter the menu (release).

**The whole point: the apprentice never edits the main menu directly.** That line is the difference between "self-improving" and "self-destructing in production".

<Source href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview" org="Anthropic" label="Agent Skills: progressive disclosure and file layout" />
<Source href="https://dspy.ai/" org="DSPy" label="Data-driven optimisation of prompts and programs" />

### A pipeline that can actually ship

```text
Traces and negative feedback
      │
      ▼
1. Mine: which calls keep failing? (cluster by error_code)
      │
      ▼
2. Propose: rewrite description / add examples / split the skill / tighten the schema
      │
      ▼
3. Evaluate offline: golden-set regression, new versus old (quality gate from chapter 09)
      │  fail → discard, keep the record
      ▼
4. Canary: channel=canary, 5% allow-list, watch for 48 hours
      │  error rate up → auto rollback (chapter 04)
      ▼
5. Promote: channel=ga, write the changelog, notify callers
```

```python
def propose_candidate(skill_name: str, failures: list[dict]) -> dict | None:
    """Pick a modification worth making; return None when nothing should change"""
    by_code = {}
    for f in failures:
        by_code.setdefault(f["error_code"], []).append(f)

    worst_code, rows = max(by_code.items(), key=lambda kv: len(kv[1]))
    if len(rows) < 20:                     # too few samples to verify anything
        return None

    if worst_code == "INVALID_ARGUMENTS":
        # usually the description never said what the argument looks like
        return {"change": "description", "hint": "add an example and a counter-example"}
    if worst_code == "SKILL_NOT_FOUND":
        return {"change": "split", "hint": "the skill is too coarse"}
    if worst_code == "UPSTREAM_TIMEOUT":
        return {"change": "none", "hint": "upstream problem; do not touch the skill"}
    return None


REQUIRED_GATES = {"schema_ok", "golden_set_regression", "pii_leak_scan"}

def promote(candidate: dict, gate_results: dict) -> str:
    """Canary only when every gate passes"""
    failed = REQUIRED_GATES - {k for k, v in gate_results.items() if v is True}
    if failed:
        audit("candidate_rejected", candidate["name"], failed=sorted(failed))
        return "rejected"
    audit("candidate_promoted", candidate["name"], to="canary")
    return "canary"
```

::: warning "The agent edits its own skill" belongs behind three doors
1. **Descriptions, examples and defaults only** — never permissions, pricing or outbound hosts.
2. **A golden-set regression must pass** — "feels better" is not evidence.
3. **No self-signing** — promotion is pressed by a human, or by a release service with no generation ability.
:::

### Anti-pattern: evolving into a self-congratulation loop

The model writes its own eval set, grades itself, and publishes. Scores climb; quality does not. Eval data must come from real traffic or human labels and stay **isolated from the generator**.

## 03 A2A plus skill hubs {#crossplatform}

### The everyday analogy

Every compound used to lay its own pipes. Now the street connects to the municipal mains (protocol standardisation) — but your household meter is still yours to manage.

**A2A answers "how do I find and delegate to someone else"; a skill hub answers "what do I offer, and who inside my organisation may use it".** They stack; neither replaces the other.

<Source href="https://a2a-protocol.org/latest/specification/" org="A2A" label="Agent Card, task lifecycle, message format" />
<Source href="https://www.rfc-editor.org/rfc/rfc8693.html" org="IETF" label="RFC 8693: OAuth 2.0 Token Exchange" />

### Where the boundary sits

| Layer | A2A | Skill hub |
| --- | --- | --- |
| Discovery | Agent Card (who I am, what I do) | Catalogue (what I offer, which version) |
| Contract | Message / Part / task state machine | Skill manifest (input/output schema) |
| Identity | Agent-to-agent authentication | Subject → tenant → skill authorisation |
| Long tasks | Task states: working / input-required / completed | job_id plus callback (chapter 14) |
| Billing | Not specified | reserve / settle |

### Exposing skills as A2A capabilities

```python
# agent_card.py — only the subset explicitly marked public
def public_card(hub, tenant: str) -> dict:
    skills = hub.registry.list_public(tenant)          # must be opted in
    return {
        "name": "yuxinrun-order-agent",
        "description": "Order lookup and refund assessment.",
        "url": "https://skills.example.com/a2a",
        "version": "1.0.0",
        "capabilities": {"streaming": False, "pushNotifications": True},
        "skills": [
            {
                "id": s.name,
                "name": s.name,
                "description": s.description,
                "inputModes": ["application/json"],
                "outputModes": ["application/json"],
                "examples": s.examples[:2],            # what the other agent reads
            }
            for s in skills
        ],
    }
```

### Delegation without handing over the user's token

```python
import httpx

def exchange_token(caller_token: str, target_audience: str) -> str:
    """RFC 8693: swap the caller token for a narrow token valid only at the target"""
    r = httpx.post("https://auth.example.com/oauth/token", data={
        "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
        "subject_token": caller_token,
        "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
        "audience": target_audience,          # this service only
        "scope": "skill:order.read",          # this scope only
    }, timeout=5)
    r.raise_for_status()
    return r.json()["access_token"]
```

::: danger The confused deputy lives exactly here
An external agent arrives with a token it legitimately holds for its own service and calls your high-risk skill; you assume it is internal traffic. **Validate `aud` and `scope`, and record the delegation chain** — who delegated to whom.
:::

| Cross-domain check | Skip it and… |
| --- | --- |
| Validate `aud` | A token for service A calls service B |
| Validate `scope` | Read-only access performs a refund |
| Record the delegation chain | Nobody can trace the origin |
| Quota on the remote side | One external agent saturates your skill |
| Negotiate contract version | The peer sends the old schema; everything errors |

## 04 Certification and trust ratings {#certification}

### The everyday analogy

The organic vegetable label. The sticker is worthless; what has value is **someone checked on your behalf and is liable if they checked wrong**.

### Three pillars

| Pillar | Question answered | Mechanism |
| --- | --- | --- |
| Source authenticity | Did the author really publish this? | Signing (Sigstore / cosign), release credentials |
| Reproducible build | Was this built from that source? | Provenance (SLSA), lockfiles, reproducible builds |
| Verifiable behaviour | Does it only do what it claims? | Sandboxed network allow-list testing, least-privilege audit |

<Source href="https://slsa.dev/spec/v1.0/levels" org="SLSA" label="Build levels: from scripts to reproducible and tamper-proof" />
<Source href="https://www.sigstore.dev/" org="Sigstore" label="Keyless signing and transparency logs" />
<Source href="https://genai.owasp.org/llm-top-10/" org="OWASP" label="LLM Top 10: excessive agency and supply chain" />

### Sign and verify, minimally

```bash
# Publisher side (in CI; the key never touches disk)
cosign sign-blob --yes \
  --bundle dist/invoice.ocr-2.1.0.bundle \
  dist/invoice.ocr-2.1.0.tar.gz

# The hub refuses to install without a valid bundle
cosign verify-blob \
  --bundle dist/invoice.ocr-2.1.0.bundle \
  --certificate-identity-regexp '^https://github.com/yuxinrun/.*$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  dist/invoice.ocr-2.1.0.tar.gz
```

::: tip Verify the identity, not just the signature
`--certificate-identity-regexp` is the real control: anyone's signature is a "valid signature". **Pin who signed it and which OIDC issuer vouched for them.**
:::

### A trust score: turning judgement into a sortable number

```python
WEIGHTS = {
    "signed": 25,          # release signature present
    "slsa3": 20,           # build provenance at level 3
    "sandbox_passed": 20,  # behaviour tests passed in a sandbox
    "no_network": 10,      # declares and demonstrates no egress
    "test_coverage": 10,   # contract test coverage
    "incident_free_days": 15,   # 90 days without a security event
}

def trust_score(skill) -> int:
    score = 0
    if skill.security.signed:
        score += WEIGHTS["signed"]
    if skill.security.slsa_level >= 3:
        score += WEIGHTS["slsa3"]
    if skill.security.sandbox_passed:
        score += WEIGHTS["sandbox_passed"]
    if not skill.security.declared_network:
        score += WEIGHTS["no_network"]
    if skill.quality.contract_coverage >= 0.8:
        score += WEIGHTS["test_coverage"]
    if skill.ops.days_since_incident >= 90:
        score += WEIGHTS["incident_free_days"]
    return score
```

| Score | Grade | Default policy |
| --- | --- | --- |
| 85–100 | A | Adopt directly; quarterly review |
| 70–84 | B | Read skills allowed; writes need approval |
| 50–69 | C | Sandbox with no network, trial only |
| <50 | D | Blocked in production; experiment tenants only |

::: warning Ratings expire
An expired certificate, a change of maintainer, a CVE in a dependency, one incident in 90 days — any of these drops the grade. **A rating without an expiry mechanism is decoration within six months.**
:::

## 05 Three bets worth making over the next 18 months {#bets}

| Bet | Why | What to do now |
| --- | --- | --- |
| Descriptions become the core competency | 80% of wrong-skill picks are vague descriptions (chapter 12) | A description standard, a counter-example library, automated linting |
| Registry formats converge | MCP Registry and A2A Agent Card are both settling | Keep metadata decoupled from the registry (chapter 08) |
| Isolation goes from optional to mandated | Supply-chain risk is entering regulation | Sandboxes on by default; signing in the release pipeline |

## 06 Closing: three sentences worth remembering {#takeaways}

1. **A skill hub is not a toolbox; it is a capability platform.** It governs contracts, permissions and money — not files.
2. **Every clever feature stands on the metadata.** A loose schema means a lifetime of patches.
3. **The more open you get, the more conservative you must be.** Marketplaces, evolution, interop, certification — each step forward requires the sandbox and audit to step forward first.

::: tip Where next
- Read it through in order: [reading guide](/en/reading/)
- Forgot an acronym: [glossary](/en/glossary/)
- Check the primary sources: [sources](/en/reading/#official)
- Other titles in the series: [the ecosystem](/en/intro/#eco)
:::

## 07 Sources {#refs}

<Source href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview" org="Anthropic" label="Agent Skills: structure and progressive disclosure" />
<Source href="https://a2a-protocol.org/latest/specification/" org="A2A" label="Agent Card and task lifecycle" />
<Source href="https://www.rfc-editor.org/rfc/rfc8693.html" org="IETF" label="RFC 8693 token exchange" />
<Source href="https://slsa.dev/spec/v1.0/levels" org="SLSA" label="Build levels and provenance" />
<Source href="https://www.sigstore.dev/" org="Sigstore" label="Signing and transparency logs" />
<Source href="https://github.com/modelcontextprotocol/registry" org="MCP" label="Official registry: fields and endpoints" />
<Source href="https://genai.owasp.org/llm-top-10/" org="OWASP" label="LLM Top 10: excessive agency and supply chain" />
<Source href="https://dspy.ai/" org="DSPy" label="Data-driven optimisation of prompts and programs" />

## Next {#next}

That was the last chapter. Pick up any chapter you want to read again: [reading guide](/en/reading/) · [glossary](/en/glossary/) · [ecosystem](/en/intro/#eco) · [home](/en/).
