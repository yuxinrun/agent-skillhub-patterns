---
title: 05 · Eight production patterns
description: Proxy, local execution, remote service, sandbox, composition, workflow, multi-tenancy and metering — each with code, cost and boundaries.
outline: [2, 3]
---

# 05 · Eight production patterns

The core of the book. Each pattern answers four questions: **what it solves, how to build it, what it costs, when not to use it**.

::: tip Keep this table
| Your problem | Use |
| --- | --- |
| Every call must be controlled and billable | 01 Proxy |
| Low latency, offline capable | 02 Local execution |
| Another team owns the skill | 03 Remote service |
| The code is untrusted | 04 Sandbox |
| "One button, three steps done" | 05 Composition / 06 Workflow |
| Many customers, one platform | 07 Multi-tenancy |
| Charge by usage, cap cost | 08 Metering |
:::

## 01 Proxy forwarding {#proxy}

<Diagram id="proxy" />

**Solves**: agents connect directly to N downstreams, so auth, rate limits, timeouts and logs are reimplemented everywhere and billing is impossible.

**How**: the hub is the only exit. The agent carries user identity; the hub swaps in downstream credentials.

```python
import httpx

async def forward(skill, args, ctx):
    impl = skill.implementation                      # url, method, auth_mode
    headers = {
        "x-trace-id": ctx.trace_id,
        "x-tenant": ctx.tenant,
        "x-idempotency-key": ctx.idempotency_key,
    }

    # Credentials come from the secret store, never from the manifest
    if impl.auth_mode == "service_token":
        headers["authorization"] = f"Bearer {secrets.get(impl.secret_ref)}"
    elif impl.auth_mode == "user_delegated":
        headers["authorization"] = f"Bearer {ctx.subject.delegated_token}"

    async with httpx.AsyncClient(timeout=skill.timeout_ms / 1000) as c:
        r = await c.request(impl.method, impl.url, json=args, headers=headers)
    return normalise(r, skill.output_schema)
```

Four things you must get right:

| Concern | Do this | Cost of getting it wrong |
| --- | --- | --- |
| Credentials | Secret manager plus short-lived tokens | A leaked manifest is a full breach |
| Idempotency | Forward `idempotency_key` | Retries double-charge or double-refund |
| Timeout | Enforce at the hub, slightly below the caller's | The caller gives up, the hub keeps retrying |
| Normalisation | One envelope, never change field meaning | Every agent writes its own adapter |

**Cost**: one extra hop (+5–20ms); the hub becomes a single point, so multiple replicas and health checks are mandatory; large payloads need streaming or trimming.

::: warning Do not build a transparent tunnel
Passing arbitrary URLs and headers through is an SSRF backdoor into your intranet. **Targets must be allowlisted in the registry and come only from the manifest.**
:::

## 02 Local execution {#local}

**Solves**: high-frequency, low-risk capabilities where a network round trip is not worth it.

**How**: the hub only **distributes and signs**; the code loads on the agent side.

```python
# Agent-side loader: only signed packs
import hashlib, json

def load_pack(pack_path: str, manifest_pubkey: str):
    pack = json.load(open(pack_path))
    payload = json.dumps(pack["files"], sort_keys=True).encode()
    if not verify(payload, pack["signature"], manifest_pubkey):
        raise SecurityError("pack signature invalid")
    if pack["manifest"]["checksum"] != hashlib.sha256(payload).hexdigest():
        raise SecurityError("checksum mismatch")
    ns = {"__name__": f"skill_{pack['manifest']['name']}"}
    exec(compile(pack["files"]["handler.py"], "<skill>", "exec"), ns)   # trusted packs only
    return ns["run"]
```

| Good for | Bad for |
| --- | --- |
| Text cleanup, format conversion, local files | Anything needing internal databases |
| High-frequency reads with caching | Sensitive operations needing per-call audit |
| Unstable or offline networks | Teams with many languages and versions |

**Cost**: version consistency is the hard part — you cannot guarantee 500 machines share one version; shipping code widens the attack surface; metering depends on callbacks that get lost.

::: tip Hybrid is the norm
Control plane (who may use it, which version) stays in the hub; the data plane (actual execution) is tiered: sensitive through the proxy, hot reads locally.
:::

## 03 Remote service {#remote}

**Solves**: another team or a vendor operates the skill; the hub should not and cannot host its code.

**How**: the owner deploys a service, **registers** it with the hub, and the hub only discovers, authenticates and forwards.

```json
{
  "name": "crm.contact.enrich",
  "version": "2.1.0",
  "endpoint": {
    "url": "https://crm-vendor.example.com/mcp",
    "protocol": "mcp",
    "health": "https://crm-vendor.example.com/healthz"
  },
  "identity": {
    "mode": "signed_request",
    "key_id": "hub-prod-2026",
    "audience": "crm-vendor"
  },
  "ownership": {"team": "vendor-crm", "sla": "99.5%"}
}
```

Four checks at registration:

1. **Health endpoint reachable** (otherwise you list a broken skill)
2. **Signature verifiable** (the hub signs, the vendor verifies)
3. **Manifest matches reality** (`tools/list` returns what the manifest claims)
4. **Quota declaration sane** (their promised QPS matches your rate limit)

| Upside | Risk |
| --- | --- |
| Clear ownership | They change the interface without telling you |
| The hub hosts no code | Their outage is your outage |
| Cross-company possible | Data residency and compliance |

::: danger Every remote service needs a kill switch
A vendor disappears, gets compromised, or breaches policy — you must be able to remove it from every tenant's visible list in seconds, with in-flight calls failing explicitly. **No kill switch, no vendor.**
:::

## 04 Sandbox isolation {#sandbox}

<Diagram id="sandbox-flow" />

**Solves**: the code is untrusted (vendors, user uploads, model-generated) but still has to run.

**How**: process / container / microVM plus resource and network limits, read-only inputs, controlled output.

```python
import docker, json, tempfile

LIMITS = dict(mem_limit="256m", nano_cpus=500_000_000,
              network_disabled=True, read_only=True,
              pids_limit=128)

def run_in_sandbox(code: str, payload: dict, timeout=8) -> dict:
    client = docker.from_env()
    with tempfile.TemporaryDirectory() as d:
        open(f"{d}/handler.py", "w").write(code)
        json.dump(payload, open(f"{d}/input.json", "w"))
        container = client.containers.run(
            "skill-sandbox:py312", command=["python", "/work/handler.py"],
            volumes={d: {"bind": "/work", "mode": "rw"}},
            detach=True, **LIMITS,
        )
        try:
            container.wait(timeout=timeout)
        except Exception:
            container.kill()
            return {"ok": False, "error": {"code": "SANDBOX_TIMEOUT", "retryable": False}}
        finally:
            logs = container.logs(stdout=True, stderr=True).decode()[:64_000]
            container.remove(force=True)
    return parse_result(logs)
```

Six switches; leave one off and it is bypassable:

| Switch | Purpose | Common hole |
| --- | --- | --- |
| Network off / egress allowlist | Stop exfiltration | Allowing any egress gives the data away |
| Read-only root | Stop tampering | A writable `/tmp` hides payloads |
| Memory / CPU / PID limits | Stop resource exhaustion | CPU-only limits do not stop a fork bomb |
| Execution timeout | Stop infinite loops | Timeouts set only on the client |
| Unprivileged, non-root | Stop escapes | `--privileged` because it was easier |
| Output size cap | Stop context flooding | Returning 20MB of logs |

::: warning A sandbox is not a synonym for a container
Ordinary containers share the kernel. For genuinely hostile code use gVisor, Firecracker or a managed sandbox. **Running malicious code in Docker just makes it die more slowly.**
:::

## 05 Composite skills {#compose}

<Diagram id="compose" />

**Solves**: the business wants "look up the order, decide refundability, draft the reply" in one step, and those three capabilities belong to three teams.

**How**: bundle atomic skills in a **fixed order** into one outward promise. Fixed order — not "let the model figure it out".

```yaml
name: order.refund.assess
version: 1.2.0
description: Decide whether an order is refundable and draft the support reply. Use when the user asks "can this be refunded".
kind: composite
steps:
  - id: order
    use: order.lookup@1.4.0
    args: { order_id: "{{ input.order_id }}" }
  - id: paid
    use: payment.status@2.0.0
    when: "{{ steps.order.status in ['paid','shipped','done'] }}"
    args: { order_id: "{{ input.order_id }}" }
  - id: policy
    use: refund.policy.check@1.0.0
    args: { order_id: "{{ input.order_id }}", paid_at: "{{ steps.paid.paid_at }}" }
  - id: script
    use: cs.copywriting.refund@3.1.0
    args: { decision: "{{ steps.policy.decision }}", reason: "{{ steps.policy.reason }}" }
output: "{{ steps.script.text }}"
on_error: partial            # return completed parts plus the failure
```

| Upside | Cost |
| --- | --- |
| Callers need one skill only | Any child change needs a full regression |
| Permissions narrowed per composite | It inherits every child's scopes, usually too wide |
| Billable as one unit | Latency is the sum of the chain |

::: danger Never put human-approved writes inside a composite
Composites run automatically. Bundle a refund, delete or publish in one and you have deleted the human review. Writes belong in their own skill or in a workflow.
:::

## 06 Workflow skills {#workflow}

<Diagram id="workflow" />

**Solves**: multi-step processes with branches, human approvals and possibly hours of waiting.

**How**: a state machine or graph (LangGraph, for example) with checkpoints so the flow resumes.

```python
from langgraph.graph import StateGraph, END

g = StateGraph(dict)
g.add_node("assess", assess_refund)               # automatic
g.add_node("request_approval", request_approval)  # suspends for a human
g.add_node("execute", execute_refund)             # write
g.add_node("notify", notify_user)

g.set_entry_point("assess")
g.add_conditional_edges("assess", route, {
    "auto": "execute", "manual": "request_approval", "reject": "notify",
})
g.add_conditional_edges("request_approval", after_approval,
                        {"approved": "execute", "rejected": "notify"})
g.add_edge("execute", "notify")
g.add_edge("notify", END)

app = g.compile(checkpointer=checkpointer)   # the key to resuming
```

Four design points:

| Point | Why |
| --- | --- |
| Idempotent steps plus checkpoints | A three-hour approval pause must not double-charge on resume |
| Approval nodes with timeouts | No approver means escalate, not hang forever |
| Externalised state | A process restart must not lose the flow |
| One trace_id throughout | Cross-day flows still need one audit trail |

**Cost**: much heavier than a composite (storage, compensation, operations); harder to debug; hard-coded flows mean code changes when the process changes.

::: tip Composite or workflow?
Ask: "can it stop for an hour and wait for a person?" Yes → workflow. No, fully automatic → composite.
:::

## 07 Multi-tenant isolation {#tenancy}

**Solves**: one platform serves many customers or departments that must not see each other's skills, data or usage.

**How**: three isolations — **visibility, data, resources**.

```python
def visible_skills(tenant: str, subject) -> list[Skill]:
    return [s for s in registry.all()
            if tenant in s.tenant_scope or "*" in s.tenant_scope]

def scoped_query(sql: str, tenant: str):
    # Data isolation: the framework injects the tenant predicate, not the developer
    return db.query(f"{sql} /* tenant={tenant} */", tenant=tenant)

COMMON_LIMITS = {"per_tenant_qps": 50, "max_concurrent": 20}
```

| Level | How | Cost | Good for |
| --- | --- | --- | --- |
| Logical | Shared resources, row-level `tenant_id` | Low | Internal departments |
| Schema | One schema per tenant | Medium | SMB customers |
| Instance | One deployment per tenant | High | Finance, government |

::: danger The most expensive bug is a missing `where`
Every query in logical isolation must carry `tenant_id`. Enforce it with row-level security in the database instead of relying on memory.
:::

::: tip Tenant id comes from the token only
The moment you read `tenant` from request parameters, you have shipped an impersonation feature. **No exceptions.**
:::

## 08 Metering and quotas {#billing}

<Diagram id="billing" />

**Solves**: charge by usage per tenant and per skill, and stop one tenant from saturating the platform.

**How**: measure, aggregate over a window, limit (reserve or reject), settle.

```python
from redis import Redis
r = Redis()

def reserve(tenant: str, skill: str, cost: float) -> bool:
    day = today()
    key = f"quota:{tenant}:{day}"
    pipe = r.pipeline()
    pipe.incrbyfloat(key, cost)
    pipe.expire(key, 86400 * 2)
    used = pipe.execute()[0]
    limit = limits.for_tenant(tenant)
    if used > limit.daily:
        r.incrbyfloat(key, -cost)          # release the reservation
        return False
    return True

def settle(tenant, skill, usage, idempotency_key):
    # Idempotent: one charge per request
    if not r.set(f"billed:{idempotency_key}", 1, nx=True, ex=86400 * 3):
        return
    ledger.append({"tenant": tenant, "skill": skill, "usage": usage,
                   "cost": price(skill, usage), "at": now()})
```

| Basis | Good for | Trap |
| --- | --- | --- |
| Per call | Simple tools | A huge response costs the same as a tiny one |
| Per token | Model-backed skills | Needs an exact tokenizer |
| Per second | Compute-heavy | Slow requests are under-punished |
| Per result | Data services | Requires trustworthy result counting |

::: warning Three parts, all mandatory
**Idempotency key** (no double charge), **reserve then settle** (no overselling), **reconciliation job** (no lost charges). Skip one and somebody will be in your inbox at month end.
:::

## 09 How the eight combine {#combo}

Production is never a single choice. A typical stack:

```text
Access     REST plus MCP
Execution  internal reads → local; internal writes → proxy; vendors → sandbox
Shape      atomic skills at the base, composites outward, workflow when a human must approve
Isolation  logical by default, instance isolation for large customers
Billing    per call plus token, quota reserved up front
```

::: tip Suggested order
Ship **01 proxy + 07 tenancy + 08 billing** first (you can charge and contain risk), then **04 sandbox** (vendors), then **05 composite / 06 workflow** (experience). The reverse order usually means redoing security and accounting.
:::

## 10 Sources {#refs}

<Source href="https://docs.dify.ai/" org="Dify" label="Reference: tools and workflow nodes" />
<Source href="https://doc.fastgpt.in/" org="FastGPT" label="Skill libraries and workflow orchestration" />
<Source href="https://langchain-ai.github.io/langgraph/" org="LangGraph" label="State graphs, checkpoints, human approval" />
<Source href="https://platform.openai.com/docs/guides/function-calling" org="OpenAI" label="Parallel calls and tool results" />
<Source href="https://modelcontextprotocol.io/specification/latest/basic/security_best_practices" org="MCP" label="Proxying and token passthrough guidance" />

## Next {#next}

Every pattern touches the same question: where is the boundary? [06 · Security, permissions and sandboxes](/en/security/).
