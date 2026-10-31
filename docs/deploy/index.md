---
title: 11 · 生产级部署与运维
description: Compose 单机起步、无状态集群扩展、监控告警四件套、备份容灾、运营看板与灰度切流。
outline: [2, 3]
---

# 11 · 生产级部署与运维

上线不是终点，是**你开始为它半夜被叫醒的起点**。这一章让那个电话尽量不要来。

::: tip 全章一句话
生产部署只有三件事：**无状态能扩、数据能恢复、出事能看见**。其余都是优化。
:::

## 00 部署拓扑 {#overview}

<Diagram id="deploy" />

```text
            ┌────────────┐
  Agent ───▶│  LB / GW   │   TLS、限流、鉴权前置
            └─────┬──────┘
        ┌─────────┼─────────┐
        ▼         ▼         ▼
   ┌────────┐┌────────┐┌────────┐
   │ hub-1  ││ hub-2  ││ hub-3  │   无状态 API
   └───┬────┘└───┬────┘└───┬────┘
       └─────────┼─────────┘
        ┌────────┴────────┐
        ▼                 ▼
  ┌──────────┐     ┌──────────┐
  │ Postgres │     │  Redis   │   元数据/日志 / 配额与缓存
  │  + 只读  │     │  cluster │
  └──────────┘     └──────────┘
        │
        ▼
  ┌──────────────┐
  │ worker 池    │  执行、沙箱、异步任务
  └──────────────┘
```

## 01 单机部署：Compose 起步 {#single}

先能跑，再谈高可用。这是最小可用的一套：

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
    volumes: ["/var/run/docker.sock:/var/run/docker.sock"]   # 仅单机演示！
    depends_on: [hub]

volumes:
  pgdata:
  redisdata:
```

启动与验证：

```bash
cp .env.example .env && echo "PG_PASSWORD=$(openssl rand -hex 16)" >> .env
docker compose up -d
curl -s localhost:8080/healthz          # {"ok":true,"version":"1.9.0"}
curl -s localhost:8080/v1/catalogue -H "authorization: Bearer $TOKEN"
```

::: danger 单机版绝不能直接对外
上面那个 worker 挂载了 `docker.sock`，等于把宿主机交给沙箱。**只用于本地验证**；生产必须用独立沙箱集群或托管沙箱服务。
:::

## 02 集群部署：无状态扩展 {#cluster}

三条硬规则：

| 规则 | 做法 | 违反的后果 |
| --- | --- | --- |
| API 无状态 | 会话放 Redis / JWT，进程内不存 | 扩容后请求打到别的实例就丢上下文 |
| 缓存可丢 | 缓存只加速，不作真相来源 | 一次重启引发缓存雪崩 |
| 执行可重入 | 任务带幂等键，可被重投 | 扩容时任务被跑两遍，重复扣款 |

```yaml
# k8s 片段：只保留关键字段
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

::: tip 扩容看什么指标
别看 CPU。跑 Agent 的服务是 **IO 密集**，CPU 常年 20% 但延迟已经上天。看**在途请求数**和**P95 延迟**，这两个才反映真实排队。
:::

## 03 监控告警四件套 {#monitor}

<Diagram id="sre-loop" />

<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="GenAI 语义约定" />

四类信号，对应四种问题：

| 信号 | 看什么 | 工具 |
| --- | --- | --- |
| 指标 | QPS、错误率、P95、在途、配额水位 | Prometheus |
| 日志 | 错误码分布、慢请求明细 | Loki / ES |
| 链路 | 一次调用卡在哪一跳 | Tempo / Jaeger |
| 事件 | 发布、回滚、配置变更 | 发布系统 |

必须有的五条告警：

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

::: warning 告警要能指向动作
「错误率高」不是告警，「`order.lookup` 的 `UPSTREAM_TIMEOUT` 占比 > 20%，可能下游 3s 超时，先查 payment 服务」才是。**没有处置建议的告警等于噪音。**
:::

## 04 备份容灾与归档 {#backup}

| 数据 | 备份方式 | RPO | RTO |
| --- | --- | --- | --- |
| 技能元数据 | 每日全量 + WAL 归档 | ≤ 5 分钟 | ≤ 30 分钟 |
| 策略与权限 | 随元数据 + Git 版本化 | 0（Git 即真相） | ≤ 10 分钟 |
| 调用日志 | 按天归档到对象存储 | ≤ 1 天 | 可接受慢恢复 |
| 审计日志 | 独立存储 + 跨区复制 | 0 | ≤ 1 小时 |

```bash
# 每日全量 + WAL 连续归档（pgBackRest 示例）
pgbackrest --stanza=skillhub --type=full backup
pgbackrest --stanza=skillhub --type=incr backup

# 恢复演练：每季度在隔离环境跑一遍，别在生产验证
pgbackrest --stanza=skillhub --delta restore
```

::: danger 没演练过的备份不算备份
「我们每天备份」和「我们能恢复」是两件事。**每季度在隔离环境做一次完整恢复，并记录耗时**——这个数字决定你敢不敢在事故中回滚数据库。
:::

## 05 运营看板：谁在用、用多少 {#dashboard}

四个必看面板，回答四个不同的问题：

| 面板 | 指标 | 回答 |
| --- | --- | --- |
| 平台健康 | QPS、错误率、P95、在途 | 现在有没有问题 |
| 技能榜单 | 调用量 Top20、成功率、P95 | 哪些技能是核心资产 |
| 租户用量 | 各租户调用量、配额水位、成本 | 谁在用、该不该收费 |
| 失败分析 | 错误码分布、Top 失败技能 | 该修什么 |

```sql
-- 技能健康榜：一眼看出该优化谁
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

::: tip 一个反直觉的看板指标
**「90 天零调用的技能数」**。这个数字涨得越快，说明你的技能库越像仓库垃圾场。目标是让它保持个位数。
:::

## 06 灰度发布与流量切分 {#canary}

网关层按权重切：

```yaml
# 以 Envoy / APISIX 的加权路由为例
routes:
  - match: {prefix: /v1/skills/invoke}
    weighted_clusters:
      clusters:
        - {name: hub_stable, weight: 90}
        - {name: hub_canary, weight: 10}
    # 关键：同一会话粘住，避免行为跳变
    hash_policy: [{header: {name: x-session-id}}]
```

三层灰度可以叠加，从粗到细：

| 层级 | 切什么 | 适合 |
| --- | --- | --- |
| 基础设施 | 新实例 / 新区域 | 验证部署本身 |
| 租户 | 内部租户 → 白名单 → 比例 | 验证业务影响 |
| 技能版本 | `channel: canary` | 验证单个技能 |

::: warning 灰度必须能一键回退
「先放 10%」不是灰度，**「放 10% 且 30 秒内能回到 0%」**才是。没有回退开关的灰度，是把事故范围从 100% 缩小到 10%，而不是避免事故。
:::

## 07 上线检查清单 {#checklist}

- [ ] `/healthz` 与 `/readyz` 分离（存活 vs 就绪）
- [ ] 数据库迁移可前滚，也可回滚（且演练过）
- [ ] 密钥来自密钥管理，不在镜像里
- [ ] 日志有租户与 trace_id，且不含原文入参
- [ ] 五条核心告警都接到人
- [ ] 备份任务有成功回执，恢复演练有记录
- [ ] 限流与配额在生产环境实测过
- [ ] 回滚脚本在预发环境跑通过

## 参考来源 {#refs}

<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="指标与追踪的标准字段" />
<Source href="https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/" org="Kubernetes" label="存活/就绪探针语义" />
<Source href="https://www.postgresql.org/docs/current/continuous-archiving.html" org="PostgreSQL" label="WAL 归档与时间点恢复" />
<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="服务端部署与传输方式" />

## 下一章 {#next}

上线之后，真正的教育开始了：[12 · 高频踩坑血泪清单](/pitfalls/)。
