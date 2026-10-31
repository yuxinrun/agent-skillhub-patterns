---
title: 11 · Deploying and operating
description: Start with Compose, scale with stateless services, then monitoring, backups, dashboards and traffic-shaped rollouts.
outline: [2, 3]
---

# 11 · Deploying and operating

Shipping is not the finish line. It is where you start getting woken at night. This chapter is about making that call rare.

::: tip The chapter in one line
Production is three things: **stateless things scale, data comes back, failures are visible.** Everything else is optimisation.
:::

## 00 Topology {#overview}

<Diagram id="deploy" />

```text
            ┌────────────┐
  Agent ───▶│  LB / GW   │  TLS, rate limits, auth front door
            └─────┬──────┘
        ┌─────────┼─────────┐
        ▼         ▼         ▼
   ┌────────┐┌────────┐┌────────┐
   │ hub-1  ││ hub-2  ││ hub-3  │   stateless API
   └───┬────┘└───┬────┘└───┬────┘
       └─────────┼─────────┘
        ┌────────┴────────┐
        ▼                 ▼
  ┌──────────┐     ┌──────────┐
  │ Postgres │     │  Redis   │   metadata/logs / quota & cache
  │ + replica│     │  cluster │
  └──────────┘     └──────────┘
        │
        ▼
  ┌──────────────┐
  │ worker pool  │  execution, sandboxes, async jobs
  └──────────────┘
```

## 01 Single node with Compose {#single}

Run first, then talk about high availability. This is the minimum viable set:

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: skillhub
      POSTGRES_USER: hub
      POSTGRES_PASSWORD: ${PG_PASSWORD:?required}
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hub -d skillhub"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes", "--maxmemory-policy", "noeviction"]
    volumes: [redisdata:/data]

  hub:
    image: ghcr.io/yuxinrun/skillhub:1.9.0
    environment:
      DATABASE_URL: postgres://hub:${PG_PASSWORD}@postgres:5432/skillhub
      REDIS_URL: redis://redis:6379/0
      JWT_PUBLIC_KEY_FILE: /run/secrets/jwt_pub
      LOG_LEVEL: info
    depends_on:
      postgres: {condition: service_healthy}
      redis: {condition: service_started}
    ports: ["8080:8080"]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/healthz"]
      interval: 10s

  worker:
    image: ghcr.io/yuxinrun/skillhub-worker:1.9.0
    environment:
      DATABASE_URL: postgres://hub:${PG_PASSWORD}@postgres:5432/skillhub
      REDIS_URL: redis://redis:6379/0
      SANDBOX_IMAGE: skill-sandbox:py312
    volumes: ["/var/run/docker.sock:/var/run/docker.sock"]   # single-node demo only!
    depends_on: [hub]

volumes:
  pgdata:
  redisdata:
```

Start and verify:

```bash
cp .env.example .env && echo "PG_PASSWORD=$(openssl rand -hex 16)" >> .env
docker compose up -d
curl -s localhost:8080/healthz          # {"ok":true,"version":"1.9.0"}
curl -s localhost:8080/v1/catalogue -H "authorization: Bearer $TOKEN"
```

::: danger The single-node build must never face the internet
That worker mounts `docker.sock`, which hands the host to the sandbox. **Local validation only.** Production needs a dedicated sandbox cluster or a managed sandbox service.
:::

## 02 Cluster: stateless scale-out {#cluster}

Three hard rules:

| Rule | Practice | Cost of breaking it |
| --- | --- | --- |
| Stateless API | Sessions in Redis or JWT; nothing in-process | Scale-out loses context as requests bounce |
| Cache can vanish | Cache accelerates, never becomes truth | One restart triggers a stampede |
| Execution re-entrant | Idempotency keys, safe redelivery | Scale-out runs a job twice and charges twice |

```yaml
# k8s fragment: only the essentials
apiVersion: apps/v1
kind: Deployment
metadata: {name: hub}
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: hub
          image: ghcr.io/yuxinrun/skillhub:1.9.0
          readinessProbe:
            httpGet: {path: /readyz, port: 8080}
            initialDelaySeconds: 3
          resources:
            requests: {cpu: "500m", memory: "512Mi"}
            limits:   {cpu: "2",    memory: "1Gi"}
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: {name: hub}
spec:
  scaleTargetRef: {kind: Deployment, name: hub}
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Pods
      pods:
        metric: {name: skill_inflight_requests}
        target: {type: AverageValue, averageValue: "40"}
```

::: tip Scale on the right metric
Not CPU. Agent-serving workloads are **IO-bound**: CPU sits at 20% while latency is already terrible. Watch **in-flight requests** and **P95 latency** — those reflect actual queueing.
:::

## 03 Monitoring and alerting {#monitor}

<Diagram id="sre-loop" />

<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="GenAI semantic conventions" />

Four signal types, four questions:

| Signal | What to look at | Tooling |
| --- | --- | --- |
| Metrics | QPS, error rate, P95, in-flight, quota level | Prometheus |
| Logs | Error-code distribution, slow call detail | Loki / ES |
| Traces | Which hop the call stalled on | Tempo / Jaeger |
| Events | Releases, rollbacks, config changes | Release system |

Five alerts you must have:

```yaml
- name: hub_error_rate
  expr: sum(rate(skill_invoke_total{status="error"}[5m])) / sum(rate(skill_invoke_total[5m])) > 0.03
  for: 10m
- name: hub_p95_latency
  expr: histogram_quantile(0.95, sum(rate(skill_latency_bucket[5m])) by (le)) > 2.5
  for: 10m
- name: hub_saturation
  expr: sum(skill_inflight_requests) > 0.8 * sum(hub_worker_capacity)
  for: 5m
- name: quota_burn
  expr: tenant_daily_usage / tenant_daily_quota > 0.9
  for: 30m
- name: downstream_breaker_open
  expr: sum(skill_breaker_open) > 0
  for: 1m
```

::: warning An alert must point at an action
"High error rate" is not an alert. "`order.lookup` has `UPSTREAM_TIMEOUT` above 20%, likely a 3s downstream timeout — check the payment service first" is. **No remediation hint, no alert.**
:::

## 04 Backups and disaster recovery {#backup}

| Data | Method | RPO | RTO |
| --- | --- | --- | --- |
| Skill metadata | Nightly full plus WAL archive | ≤ 5 minutes | ≤ 30 minutes |
| Policy and permissions | Alongside metadata, versioned in Git | 0 (Git is truth) | ≤ 10 minutes |
| Invocation logs | Daily archive to object storage | ≤ 1 day | Slow restore acceptable |
| Audit logs | Dedicated store plus cross-region copy | 0 | ≤ 1 hour |

```bash
# Nightly full plus continuous WAL archiving (pgBackRest example)
pgbackrest --stanza=skillhub --type=full backup
pgbackrest --stanza=skillhub --type=incr backup

# Restore drill: run quarterly in an isolated environment, never in prod
pgbackrest --stanza=skillhub --delta restore
```

::: danger A backup you have never restored is not a backup
"We back up nightly" and "we can restore" are different claims. **Run a full restore quarterly in isolation and record the duration** — that number decides whether you dare roll back a database during an incident.
:::

## 05 Dashboards: who uses what {#dashboard}

Four panels, four different questions:

| Panel | Metrics | Answers |
| --- | --- | --- |
| Platform health | QPS, error rate, P95, in-flight | Is anything broken now |
| Skill leaderboard | Top 20 by calls, success rate, P95 | Which skills are real assets |
| Tenant usage | Calls, quota level, cost per tenant | Who uses what, should they pay |
| Failure analysis | Error-code distribution, worst skills | What to fix next |

```sql
-- Skill health board: who needs attention
select skill,
       count(*)                                   as calls,
       avg((status = 'ok')::int)                  as success_rate,
       percentile_cont(0.95) within group (order by latency_ms) as p95,
       count(*) filter (where status = 'denied')   as denials
from invocations
where created_at > now() - interval '7 days'
group by skill
having count(*) > 100
order by success_rate asc, p95 desc
limit 20;
```

::: tip One counter-intuitive metric
**"Skills with zero calls in 90 days."** The faster that number grows, the more your library resembles a junkyard. Keep it in the single digits.
:::

## 06 Canary releases and traffic splits {#canary}

Weighted routing at the gateway:

```yaml
# Envoy / APISIX weighted routing
routes:
  - match: {prefix: /v1/skills/invoke}
    weighted_clusters:
      clusters:
        - {name: hub_stable, weight: 90}
        - {name: hub_canary, weight: 10}
    # Critical: stick sessions so behaviour does not flip mid-conversation
    hash_policy: [{header: {name: x-session-id}}]
```

Three layers of canary, coarse to fine:

| Layer | Split by | Good for |
| --- | --- | --- |
| Infrastructure | New instances or region | Validating the deployment itself |
| Tenant | Internal → allowlist → percentage | Validating business impact |
| Skill version | `channel: canary` | Validating a single skill |

::: warning A canary must be reversible in seconds
"Start at 10%" is not a canary. **"Start at 10% and get back to 0% within 30 seconds"** is. Without a switch, you have only shrunk the blast radius, not avoided the incident.
:::

## 07 Launch checklist {#checklist}

- [ ] `/healthz` and `/readyz` separated (liveness versus readiness)
- [ ] Database migrations roll forward and back, and both were rehearsed
- [ ] Secrets come from a secret manager, never baked into images
- [ ] Logs carry tenant and trace_id, and contain no raw arguments
- [ ] All five core alerts reach a human
- [ ] Backup jobs emit receipts; restore drills are recorded
- [ ] Rate limits and quotas tested in production
- [ ] The rollback script has run in staging

## 08 Sources {#refs}

<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="Standard metric and trace fields" />
<Source href="https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/" org="Kubernetes" label="Liveness and readiness semantics" />
<Source href="https://www.postgresql.org/docs/current/continuous-archiving.html" org="PostgreSQL" label="WAL archiving and point-in-time recovery" />
<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="Server deployment and transports" />

## Next {#next}

After launch, the real education begins: [12 · The production pitfall catalog](/en/pitfalls/).
