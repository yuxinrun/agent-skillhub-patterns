---
title: 14 · Performance at scale
description: Metadata caches and delta sync, hot-result caches, async calls and callbacks, rate limits and breakers, multi-region, and cold starts.
outline: [2, 3]
---

# 14 · Performance at scale

Hub performance has one signature: **when it is slow, every agent is slow**. So the goal is not a faster single call, but a system that fails collectively less often.

::: tip The chapter in one line
Six techniques, two ideas: **cache what need not be recomputed, go async when you would otherwise wait; then give every tenant its own lifebuoy.**
:::

## 01 Metadata caches and delta sync {#cache}

<Diagram id="cache-tiers" />

Skill metadata is read-heavy and write-rare: changed a few times a day, read millions. Three cache tiers:

| Tier | Where | TTL | Invalidation |
| --- | --- | --- | --- |
| L1 | Agent process | 5–15 min plus jitter | On `revision` change |
| L2 | Hub process (memory) | 60s | Publish event |
| L3 | Shared cache (Redis) | 5 min | Delete on publish |

```python
import random, time

CACHE = {}   # L2: in-process

def catalogue(tenant: str) -> dict:
    key = f"cat:{tenant}"
    hit = CACHE.get(key)
    if hit and hit["exp"] > time.time():
        return hit["data"]

    # Delta: send the local revision, get "unchanged" when nothing moved
    rev = hit["data"]["revision"] if hit else None
    data = registry.fetch_catalogue(tenant, since=rev) if rev else registry.fetch_catalogue(tenant)
    if data is None:                        # unchanged
        data = hit["data"]
    ttl = 60 + random.uniform(-10, 10)      # jitter: avoid simultaneous expiry
    CACHE[key] = {"data": data, "exp": time.time() + ttl}
    return data
```

::: warning Three ways to cause a stampede
1. Every key shares one TTL → they all expire together.
2. Invalidate by deleting first → the empty window sends everything to the origin.
3. No single-flight → 100 concurrent requests hit the origin 100 times.

**Add jitter, use single-flight, keep the stale value until the new one lands.**
:::

```python
import threading
_locks = {}

def singleflight(key, fn):
    lock = _locks.setdefault(key, threading.Lock())
    with lock:
        return fn()
```

## 02 Hot result caching {#hotcache}

**Cache results only when three conditions hold**: read-only, idempotent, and result independent of the caller (or keyed by tenant).

```python
def cache_key(skill, version, args, tenant):
    payload = json.dumps({"s": skill, "v": version, "t": tenant,
                          "a": args}, sort_keys=True, ensure_ascii=False)
    return "res:" + hashlib.sha256(payload.encode()).hexdigest()

def invoke_cached(skill, args, ctx):
    if not (skill.cacheable and skill.scopes and "read" in skill.scopes[0]):
        return execute(skill, ctx.version, args, ctx)

    key = cache_key(skill.name, ctx.version, args, ctx.tenant)
    if (hit := redis.get(key)):
        metrics.inc("skill_cache_hit", {"skill": skill.name})
        return json.loads(hit)

    out = execute(skill, ctx.version, args, ctx)
    redis.set(key, json.dumps(out), ex=skill.cache_ttl or 30)
    return out
```

| Safe to cache | Never cache |
| --- | --- |
| FX rates, dictionaries, config lookups | Balances, stock levels (oversell) |
| Knowledge retrieval (short TTL) | Writes: refunds, orders |
| Geo and region tables | Endpoints with one-time tokens |

::: danger A cache key missing tenant is a data leak
Without `tenant` or `subject` in the key, customer A reads customer B's result. **Every dimension that affects the result belongs in the key**, even at the cost of hit rate.
:::

## 03 Async calls and callbacks {#async}

<Diagram id="async-flow" />

Long tasks (bulk exports, large file analysis) must not block:

```python
@app.post("/v1/skills/invoke")
def invoke(body: Invoke):
    if body.skill in LONG_RUNNING:
        job_id = jobs.create(body)                 # enqueue
        return {"ok": True, "accepted": True, "job_id": job_id,
                "poll": f"/v1/jobs/{job_id}"}      # 202 semantics
    return execute_sync(body)

@app.get("/v1/jobs/{job_id}")
def job_status(job_id: str):
    j = jobs.get(job_id)
    if j.state == "running":
        return {"ok": True, "state": "running", "progress": j.progress}
    if j.state == "failed":
        return {"ok": False, "state": "failed", "error": j.error}
    return {"ok": True, "state": "done", "data": j.result}

@app.post("/internal/jobs/callback")
def callback(payload: dict, x_signature: str = Header(default="")):
    verify_hmac(payload, x_signature, secret=WEBHOOK_SECRET)   # signature is mandatory
    jobs.complete(payload["job_id"], payload["result"])
    return {"ok": True}
```

| Point | Practice |
| --- | --- |
| Idempotency | `job_id` from caller or hub; resubmission returns the same job |
| Callback signature | HMAC plus timestamp to block replay |
| Result retention | At least 24 hours, then an explicit error |
| Timeouts | No HTTP timeout for the work; set a business deadline instead |

::: tip When to go async
The practical ceiling for a synchronous call is about **10 seconds** (user patience plus gateway limits). Beyond that, return a `job_id` and let the agent do something else.
:::

## 04 Rate limits, breakers, bulkheads {#ratelimit}

Three layers; missing one leaks:

```python
class TokenBucket:
    def __init__(self, rate_per_sec: float, burst: int):
        self.rate, self.burst = rate_per_sec, burst
        self.tokens, self.ts = burst, time.time()

    def allow(self, cost: float = 1.0) -> bool:
        now = time.time()
        self.tokens = min(self.burst, self.tokens + (now - self.ts) * self.rate)
        self.ts = now
        if self.tokens >= cost:
            self.tokens -= cost
            return True
        return False

BUCKETS = {}   # key = (tenant, skill) or (skill,)

class Breaker:
    """closed → open → half_open"""
    def __init__(self, fail_threshold=5, cool_down=30):
        self.fails, self.state, self.until = 0, "closed", 0
        self.threshold, self.cool = fail_threshold, cool_down

    def allow(self) -> bool:
        if self.state == "open":
            if time.time() < self.until:
                return False
            self.state = "half_open"
        return True

    def record(self, ok: bool):
        if ok:
            self.fails, self.state = 0, "closed"
        else:
            self.fails += 1
            if self.fails >= self.threshold:
                self.state, self.until = "open", time.time() + self.cool
```

| Mechanism | Protects | Key parameters |
| --- | --- | --- |
| Token bucket | Downstream | rate, burst (per tenant and skill) |
| Concurrency bulkhead | Yourself | Max concurrency per tenant (e.g. 20) |
| Circuit breaker | Downstream and self | Failure threshold, cool-down |
| Retry budget | Everyone | Retries ≤ 10% of requests |

::: danger A global limit is not a tenant limit
With 1000 QPS global, one tenant taking 900 starves everyone else. **Bucket by tenant first**, then cap each tenant.
:::

## 05 Multi-region and locality {#region}

Three concerns, in priority order:

1. **Residency** — if regulation says data stays in-country, both implementations and logs stay regional.
2. **Latency** — a cross-continent round trip is 150ms+, multiplied across agent turns.
3. **Consistency** — metadata can be eventually consistent; quotas cannot (or you oversell).

```text
Region A (cn)              Region B (eu)
├── Hub replica (reads)    ├── Hub replica
├── Local execution        ├── Local execution
├── Read-only metadata     ├── Read-only metadata
└── Local log retention    └── Local log retention
        │                        │
        └──── metadata primary (single write region) ────┘
```

::: warning Quotas cannot be eventually consistent
If both regions decrement locally, users get double the allowance. **Use a central counter or lease-based shards**, never async replication.
:::

## 06 Cold starts and warm pools {#coldstart}

| Technique | Effect | Cost |
| --- | --- | --- |
| Warm pool (keep N hot) | Cold starts nearly vanish | Always-on spend |
| Scheduled ping | Cheap, suits low-frequency skills | Keeps warm only, cannot scale |
| Dependency preloading (pools, model clients) | 3–5× faster first call | Slower boot |
| Snapshot restore (microVM) | Millisecond starts | Platform support needed |
| Smaller images | Faster pulls | Slimmer base images |

```yaml
# Warm pool: keep 2 hot, allow 20
warmer:
  skill: report.export
  min_warm: 2
  max_instances: 20
  idle_seconds: 120
  schedule: ["0 8 * * 1-5"]     # scale up before the weekday peak
```

::: tip One rule of thumb
Above **800ms** of cold start, users feel the stall. Either warm it or make it async (section 03).
:::

## 07 Optimisation order {#priority}

Order by return on effort. Do not start with multi-region:

| Order | Optimisation | Typical gain |
| --- | --- | --- |
| 1 | Metadata cache plus delta | Removes 80%+ of registry traffic |
| 2 | Rate limits and breakers | Eliminates cascading failure (largest gain) |
| 3 | Result cache (read skills) | 10× latency reduction on hot skills |
| 4 | Async long tasks | Frees connections and threads |
| 5 | Warm pools | Kills P99 spikes |
| 6 | Multi-region | Only when cross-region business truly exists |

::: warning Do not optimise unmeasured problems
Get P95/P99 and error rates first. **"It feels slow" is not a metric; "P99 moved from 800ms to 3s" is.**
:::

## 08 Sources {#refs}

<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="Standard latency and error measurement" />
<Source href="https://www.postgresql.org/docs/current/continuous-archiving.html" org="PostgreSQL" label="Archiving and capacity planning" />
<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="Transports and timeout semantics" />
<Source href="https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/" org="Kubernetes" label="Readiness probes and traffic admission" />

## Next {#next}

One chapter left: where all of this is heading. [15 · Where this is going](/en/future/).
