---
title: 14 · 性能优化与大规模扩展
description: 元数据缓存与增量拉取、热门结果缓存、异步调用与回调、限流熔断与隔离、多区域部署、冷启动优化。
outline: [2, 3]
---

# 14 · 性能优化与大规模扩展

技能中心的性能问题有个特点：**它自己不快，所有 Agent 一起慢**。所以优化目标不是「单次更快」，是「集体不崩」。

::: tip 全章一句话
六个手段，两句话概括：**能缓存的不重算，能异步的不干等；再给每个租户一个独立的救生圈。**
:::

## 01 元数据缓存与增量拉取 {#cache}

<Diagram id="cache-tiers" />

技能元数据是典型的「读多写极少」：一天改几次，一天读几百万次。三层缓存：

| 层 | 位置 | TTL | 失效方式 |
| --- | --- | --- | --- |
| L1 | Agent 进程内 | 5~15 分钟 + jitter | 收到 `revision` 变化 |
| L2 | Hub 本地（内存） | 60 秒 | 发布事件主动失效 |
| L3 | 共享缓存（Redis） | 5 分钟 | 发布事件删除 key |

```python
import random, time, hashlib

CACHE = {}   # L2：进程内

def catalogue(tenant: str) -> dict:
    key = f"cat:{tenant}"
    hit = CACHE.get(key)
    if hit and hit["exp"] > time.time():
        return hit["data"]

    # 增量：带上本地 revision，没变就返回 304 语义
    rev = hit["data"]["revision"] if hit else None
    data = registry.fetch_catalogue(tenant, since=rev) if rev else registry.fetch_catalogue(tenant)
    if data is None:                        # 未变更
        data = hit["data"]
    ttl = 60 + random.uniform(-10, 10)      # jitter：防同一秒集体失效
    CACHE[key] = {"data": data, "exp": time.time() + ttl}
    return data
```

::: warning 缓存雪崩的三种写法
1. 所有 key 同一个 TTL → 同时失效，同时回源。
2. 失效时先删再加载 → 空窗期全部打穿。
3. 没有单飞（single-flight）→ 100 个并发请求回源 100 次。

**加 jitter、用 single-flight、保留旧值直到新值就绪**，三条一起做。
:::

```python
import threading
_locks = {}

def singleflight(key, fn):
    lock = _locks.setdefault(key, threading.Lock())
    with lock:
        return fn()
```

## 02 热门技能结果缓存 {#hotcache}

**只对满足三个条件的技能开结果缓存**：只读、幂等、结果与租户无关（或按租户分键）。

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

| 适合缓存 | 绝对不要缓存 |
| --- | --- |
| 汇率、字典、配置查询 | 用户余额、库存（会超卖） |
| 知识库检索结果（短 TTL） | 写操作、退款、下单 |
| 地理位置、行政区划 | 带一次性 token 的接口 |

::: danger 缓存键漏了 tenant 就等于数据泄露
少了 `tenant` 或 `subject` 的键，A 客户会读到 B 客户的结果。**缓存键必须包含所有影响结果的维度**，宁可命中率低。
:::

## 03 异步调用与回调 {#async}

<Diagram id="async-flow" />

长任务（批量导出、大文件分析）不能同步等：

```python
@app.post("/v1/skills/invoke")
def invoke(body: Invoke):
    if body.skill in LONG_RUNNING:
        job_id = jobs.create(body)                 # 入队
        return {"ok": True, "accepted": True, "job_id": job_id,
                "poll": f"/v1/jobs/{job_id}"}      # 202 语义
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
    verify_hmac(payload, x_signature, secret=WEBHOOK_SECRET)   # 必须验签
    jobs.complete(payload["job_id"], payload["result"])
    return {"ok": True}
```

| 要点 | 做法 |
| --- | --- |
| 幂等 | `job_id` 由调用方或 Hub 生成，重复提交返回同一 job |
| 回调验签 | HMAC + 时间戳，防重放 |
| 结果保留 | 至少 24 小时，过期返回明确错误 |
| 超时策略 | 长任务不设 HTTP 超时，设业务截止时间 |

::: tip 什么时候该异步
同步接口的合理上限约 **10 秒**（用户体验 + 网关超时）。超过就异步：先返回 `job_id`，让 Agent 先去做别的事。
:::

## 04 限流、熔断与隔离 {#ratelimit}

三层防护，缺一层就会漏：

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

BUCKETS = {}   # key = (tenant, skill) 或 (skill,)

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

| 机制 | 保护谁 | 关键参数 |
| --- | --- | --- |
| 令牌桶限流 | 下游 | rate、burst（按租户/技能分桶） |
| 并发舱壁 | 自身 | 每租户最大并发（如 20） |
| 熔断 | 下游与自身 | 失败阈值、冷却时间 |
| 重试预算 | 全局 | 重试总量 ≤ 请求量的 10% |

::: danger 别用全局限流代替租户限流
全局 1000 QPS 里，一个租户刷 900，其他租户全饿死。**必须按租户分桶**，再给单租户设上限。
:::

## 05 多区域部署与就近访问 {#region}

三个问题，按优先级：

1. **数据属地**：合规要求「数据不出境」，那技能实现和日志都得留在本地域。
2. **延迟**：跨洲一次往返 150ms+，Agent 多轮调用会被放大。
3. **一致性**：元数据可以最终一致，配额必须强一致（否则超卖）。

```text
区域 A（cn）              区域 B（eu）
├── Hub 副本（读本区域）    ├── Hub 副本
├── 技能执行本地化          ├── 技能执行本地化
├── 元数据只读副本          ├── 元数据只读副本
└── 日志本地留存            └── 日志本地留存
        │                        │
        └──── 元数据主库（单区域写）────┘
```

::: warning 配额不能跨区域「最终一致」
两边各自扣配额，用户就能用出双倍额度。**配额用中心计数或带租约的分片**，别用异步同步。
:::

## 06 冷启动优化与预热 {#coldstart}

| 方式 | 效果 | 代价 |
| --- | --- | --- |
| 预热池（保持 N 个热实例） | 冷启动几乎消失 | 常驻成本 |
| 定时 ping | 轻量，适合低频技能 | 只能保温，不能扩展 |
| 依赖预加载（连接池、模型客户端） | 首次调用快 3~5 倍 | 启动变慢 |
| 快照恢复（microVM） | 毫秒级启动 | 需要平台支持 |
| 降低镜像体积 | 拉镜像时间减少 | 需要精简基础镜像 |

```yaml
# 预热池：保持 2 个热实例，最多 20 个
warmer:
  skill: report.export
  min_warm: 2
  max_instances: 20
  idle_seconds: 120
  schedule: ["0 8 * * 1-5"]     # 工作日早八点提前扩容
```

::: tip 一个经验值
冷启动超过 **800ms** 的技能，用户能明显感知卡顿。这时候要么预热，要么改异步（见 03 节）。
:::

## 07 优化优先级 {#priority}

按「投入产出比」排序，别一上来就做多区域：

| 顺序 | 优化 | 典型收益 |
| --- | --- | --- |
| 1 | 元数据缓存 + 增量 | 减少 80%+ 的注册层请求 |
| 2 | 限流 + 熔断 | 消除雪崩（收益最大） |
| 3 | 结果缓存（只读技能） | 命中率高的技能延迟降 10 倍 |
| 4 | 异步化长任务 | 释放连接与线程 |
| 5 | 冷启动预热 | 消灭 P99 的尖刺 |
| 6 | 多区域 | 只在跨地域业务真实存在时做 |

::: warning 别优化没有度量的问题
先有 P95/P99 与错误率，再谈优化。**「感觉慢」不是指标，「P99 从 800ms 涨到 3s」才是。**
:::

## 参考来源 {#refs}

<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="延迟与错误的标准化度量" />
<Source href="https://www.postgresql.org/docs/current/continuous-archiving.html" org="PostgreSQL" label="日志归档与容量规划" />
<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="传输方式与超时语义" />
<Source href="https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/" org="Kubernetes" label="就绪探针与流量接入时机" />

## 下一章 {#next}

最后一章，看看这套东西会往哪儿走：[15 · 生态延伸与未来趋势](/future/)。
