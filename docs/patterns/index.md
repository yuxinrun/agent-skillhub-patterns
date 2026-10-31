---
title: 05 · 八大核心工程落地模式
description: 代理转发、本地执行、远程服务、沙箱隔离、组合技能、工作流技能、多租户隔离、计费配额：八种模式各有代码、代价与适用边界。
outline: [2, 3]
---

# 05 · 八大核心工程落地模式

这一章是全书的核心。八个模式，每个都回答四个问题：**解决什么、怎么实现、代价是什么、什么时候别用**。

::: tip 先记住这张选型表
| 你的问题 | 用哪个模式 |
| --- | --- |
| 想让所有调用可管、可计费 | 01 代理转发 |
| 想低延迟、可离线 | 02 本地执行 |
| 第三方团队自己运维技能 | 03 远程服务 |
| 技能代码不可信 | 04 沙箱隔离 |
| 业务方要「一个按钮做完三步」 | 05 组合技能 / 06 工作流技能 |
| 多客户共用一套平台 | 07 多租户隔离 |
| 要按量收钱 / 控成本 | 08 计费配额 |
:::

## 01 代理转发模式 {#proxy}

<Diagram id="proxy" />

**解决什么**：Agent 直连 N 个下游，鉴权、限流、超时、日志各写一遍，且无法统一计费。

**怎么实现**：Hub 是唯一出口。Agent 只带用户身份，Hub 换成下游凭证再转发。

```python
import httpx

async def forward(skill, args, ctx):
    impl = skill.implementation                      # url, method, auth_mode
    headers = {
        "x-trace-id": ctx.trace_id,
        "x-tenant": ctx.tenant,
        "x-idempotency-key": ctx.idempotency_key,
    }

    # 凭证从密钥管理取，绝不放在技能清单里
    if impl.auth_mode == "service_token":
        headers["authorization"] = f"Bearer {secrets.get(impl.secret_ref)}"
    elif impl.auth_mode == "user_delegated":
        headers["authorization"] = f"Bearer {ctx.subject.delegated_token}"

    async with httpx.AsyncClient(timeout=skill.timeout_ms / 1000) as c:
        r = await c.request(impl.method, impl.url, json=args, headers=headers)
    return normalise(r, skill.output_schema)
```

四个必须做对的点：

| 点 | 做法 | 做错的后果 |
| --- | --- | --- |
| 凭证 | 密钥管理 + 短期令牌 | 清单泄露 = 全线泄露 |
| 幂等 | 透传 `idempotency_key` | 重试导致重复下单/重复退款 |
| 超时 | Hub 侧强制，略小于调用方 | 调用方先断，Hub 还在重试 |
| 结果归一化 | 统一信封，不改字段语义 | 每个 Agent 各写一层适配 |

**代价**：多一跳（+5~20ms）；Hub 成为单点，必须多副本 + 健康检查；大响应体会占内存，需要流式或裁剪。

::: warning 别把代理做成「透明隧道」
直接把任意 URL 和任意 header 透传，等于给内网开了个 SSRF 后门。**目标地址必须在注册层白名单里，且只能来自技能清单。**
:::

## 02 本地执行模式 {#local}

**解决什么**：高频、低风险、要求毫秒级或离线的能力，走一次网络往返不划算。

**怎么实现**：Hub 只做**分发与签名**，代码在 Agent 侧加载执行。

```python
# Agent 侧加载器：只信任签名过的包
import hashlib, json

def load_pack(pack_path: str, manifest_pubkey: str):
    pack = json.load(open(pack_path))
    payload = json.dumps(pack["files"], sort_keys=True).encode()
    if not verify(payload, pack["signature"], manifest_pubkey):
        raise SecurityError("pack signature invalid")
    if pack["manifest"]["checksum"] != hashlib.sha256(payload).hexdigest():
        raise SecurityError("checksum mismatch")
    ns = {"__name__": f"skill_{pack['manifest']['name']}"}
    exec(compile(pack["files"]["handler.py"], "<skill>", "exec"), ns)   # 仅可信包
    return ns["run"]
```

| 适合 | 不适合 |
| --- | --- |
| 文本清洗、格式转换、本地文件处理 | 需要调用内部数据库的能力 |
| 高频只读、可缓存 | 需要审计到「谁调了什么」的敏感操作 |
| 网络不稳 / 离线环境 | 多语言、多版本并存的团队 |

**代价**：版本一致性最难——你无法保证 500 台机器上的包是同一个版本；代码落地意味着攻击面扩大；计量只能靠回传，容易丢。

::: tip 混合才是常态
控制面（谁能用、哪个版本）走 Hub，数据面（真正执行）按技能分级：敏感走代理，高频只读走本地。
:::

## 03 远程服务模式 {#remote}

**解决什么**：技能由别的团队或供应商自己运维，Hub 不应该也不能托管它的代码。

**怎么实现**：技能方部署独立服务，向 Hub **注册**，Hub 只做发现、鉴权与转发。

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

注册时的四道校验：

1. **健康检查可达**（否则上架即故障）
2. **签名可验证**（Hub 用自己的私钥签请求，对方验签）
3. **清单可解析**（`tools/list` 返回与清单一致，防止挂羊头）
4. **配额声明合理**（对方承诺的 QPS 与你的限流一致）

| 优势 | 风险 |
| --- | --- |
| 责任边界清晰 | 对方改接口不通知你 |
| Hub 不背代码 | 对方服务挂了，你的 Agent 也挂 |
| 可跨公司 | 数据出境 / 合规问题 |

::: danger 远程服务必须能「一键摘除」
供应商跑路、被攻击、违反合规，你要能在 10 秒内把它从所有租户的可见列表里移除，且已有调用返回明确错误。**没有摘除开关，就不要接第三方。**
:::

## 04 沙箱隔离模式 {#sandbox}

<Diagram id="sandbox-flow" />

**解决什么**：技能代码不可信（第三方、用户上传、模型生成），但又必须执行。

**怎么实现**：进程 / 容器 / 微虚拟机 + 资源与网络限制 + 只读输入 + 受控输出。

```python
import docker, json, tempfile, os

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

沙箱的六个开关（少一个都能被绕过）：

| 开关 | 作用 | 常见漏洞 |
| --- | --- | --- |
| 网络禁用 / 出网白名单 | 防数据外传 | 允许任意出网 = 白送 |
| 只读根文件系统 | 防篡改 | 可写 `/tmp` 里藏 payload |
| 内存 / CPU / PID 限制 | 防资源耗尽 | 只限 CPU，fork 炸弹照样炸 |
| 执行超时 | 防死循环 | 只在客户端设超时 |
| 无特权、非 root | 防逃逸 | `--privileged` 一把梭 |
| 输出大小上限 | 防塞爆上下文 | 返回 20MB 日志 |

::: warning 「沙箱」不是「容器」的同义词
普通容器共享内核。跑真正不可信的代码，要用 gVisor / Firecracker 这类强隔离，或者干脆用托管沙箱服务。**用 Docker 跑恶意代码，只是让它死得慢一点。**
:::

## 05 组合技能模式 {#compose}

<Diagram id="compose" />

**解决什么**：业务方想要「查订单 + 判断能否退款 + 生成话术」一步到位，而这三个能力分别属于三个团队。

**怎么实现**：把多个原子技能按**固定顺序**打包成一个对外承诺的高级技能。注意：固定顺序，不是让模型自由发挥。

```yaml
name: order.refund.assess
version: 1.2.0
description: 判断某笔订单是否可以退款，并给出客服话术。用户询问「这单能退吗」「帮我看看退款」时使用。
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
on_error: partial            # 任一步失败，返回已完成部分 + 失败原因
```

| 优点 | 代价 |
| --- | --- |
| 调用方只需一个技能 | 任一子技能变更都要回归测试组合 |
| 权限按组合收敛 | 组合继承所有子技能的权限，容易过宽 |
| 可对组合单独计费 | 延迟是串行之和 |

::: danger 组合技能里不要放「需要人确认」的写操作
组合是自动执行的。把退款、删除、发布这类写操作组合进去，等于取消了人审。写操作要么单独成技能，要么走工作流模式。
:::

## 06 工作流技能模式 {#workflow}

<Diagram id="workflow" />

**解决什么**：多步骤、有分支、有人工审批、可能跨天的流程。

**怎么实现**：用状态机 / 图编排（如 LangGraph），每步可检查点，卡点可恢复。

```python
from langgraph.graph import StateGraph, END

g = StateGraph(dict)
g.add_node("assess", assess_refund)          # 自动
g.add_node("request_approval", request_approval)  # 挂起等人
g.add_node("execute", execute_refund)        # 写操作
g.add_node("notify", notify_user)

g.set_entry_point("assess")
g.add_conditional_edges("assess", route, {
    "auto": "execute", "manual": "request_approval", "reject": "notify",
})
g.add_conditional_edges("request_approval", after_approval,
                        {"approved": "execute", "rejected": "notify"})
g.add_edge("execute", "notify")
g.add_edge("notify", END)

app = g.compile(checkpointer=checkpointer)   # 断点续跑的关键
```

四个设计要点：

| 要点 | 原因 |
| --- | --- |
| 每步幂等 + 检查点 | 卡在审批 3 小时，恢复时不能重复扣款 |
| 审批节点带超时 | 没人批就自动转人工队列，别挂死 |
| 状态外置到存储 | 进程重启不丢流程 |
| 全程同一 trace_id | 跨天也能串起来审计 |

**代价**：比组合技能重得多（要存储、要补偿、要运维）；调试成本高；「流程写死」意味着需求变更多时要改代码。

::: tip 判断：组合还是工作流？
问一句「中间能不能停一小时等人？」能停 → 工作流；不能停、全自动 → 组合。
:::

## 07 多租户隔离模式 {#tenancy}

**解决什么**：一套平台服务多个客户/部门，彼此看不到对方技能、数据、用量。

**怎么实现**：三重隔离——**可见性隔离、数据隔离、资源隔离**。

```python
def visible_skills(tenant: str, subject) -> list[Skill]:
    return [s for s in registry.all()
            if tenant in s.tenant_scope or "*" in s.tenant_scope]

def scoped_query(sql: str, tenant: str):
    # 数据隔离：租户条件由框架注入，业务代码不能自己拼
    return db.query(f"{sql} /* tenant={tenant} */", tenant=tenant)

COMMON_LIMITS = {"per_tenant_qps": 50, "max_concurrent": 20}
```

| 隔离级别 | 做法 | 成本 | 适用 |
| --- | --- | --- | --- |
| 逻辑隔离 | 同一套资源，行级 `tenant_id` | 低 | 内部多部门 |
| 库级隔离 | 每租户独立 schema | 中 | 中小企业客户 |
| 实例隔离 | 每租户独立部署 | 高 | 金融、政企 |

::: danger 最贵的 bug：忘了一个 `where`
逻辑隔离的所有查询都必须带 `tenant_id`。建议用**行级安全策略（RLS）** 在数据库层兜底，而不是指望每个开发者记得。
:::

::: tip 租户 ID 只能来自 token
一旦允许从请求参数读 `tenant`，就等于把「冒充别的租户」这个功能开放给了所有人。**这条没有例外。**
:::

## 08 计费配额模式 {#billing}

<Diagram id="billing" />

**解决什么**：不同租户、不同技能要按量收费或控成本，且不能让单个租户打爆平台。

**怎么实现**：计量（记账）→ 聚合（滚动窗口）→ 限额（预占/拒绝）→ 出账（对账）。

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
        r.incrbyfloat(key, -cost)          # 退回预占
        return False
    return True

def settle(tenant, skill, usage, idempotency_key):
    # 幂等：同一请求只记一次账
    if not r.set(f"billed:{idempotency_key}", 1, nx=True, ex=86400 * 3):
        return
    ledger.append({"tenant": tenant, "skill": skill, "usage": usage,
                   "cost": price(skill, usage), "at": now()})
```

| 计费口径 | 适合 | 坑 |
| --- | --- | --- |
| 按调用次数 | 简单工具 | 大响应与小响应同价 |
| 按 token | 模型相关技能 | 需要精确 tokenizer |
| 按时长 | 计算密集 | 慢请求惩罚不足 |
| 按结果量 | 数据类 | 需要可信的结果计量 |

::: warning 计费三件套缺一不可
**幂等键**（防重复扣费）+ **预占/结算分离**（防超卖）+ **对账任务**（防漏账）。少一个，月底一定有人来找你对账。
:::

## 09 八个模式怎么组合 {#combo}

真实生产里从来不是单选。一套典型组合：

```text
接入      REST + MCP 双入口
执行      内部只读技能 → 本地；内部写操作 → 代理；第三方 → 沙箱
能力形态  原子技能为基座，组合技能对外；有人审需求 → 工作流
隔离      逻辑隔离为主，大客户实例隔离
计费      按调用次数 + token 混合，配额预占
```

::: tip 上线顺序建议
先做 **01 代理 + 07 租户 + 08 计费**（能收钱能控风险），再加 **04 沙箱**（接第三方），最后做 **05 组合 / 06 工作流**（提体验）。反过来做，通常会在安全和账务上返工。
:::

## 参考来源 {#refs}

<Source href="https://docs.dify.ai/" org="Dify" label="工具与工作流节点的实现参考" />
<Source href="https://doc.fastgpt.in/" org="FastGPT" label="技能库与工作流编排" />
<Source href="https://langchain-ai.github.io/langgraph/" org="LangGraph" label="状态图、检查点与人工审批" />
<Source href="https://platform.openai.com/docs/guides/function-calling" org="OpenAI" label="并行调用与工具结果回传" />
<Source href="https://modelcontextprotocol.io/specification/latest/basic/security_best_practices" org="MCP" label="代理与令牌透传的安全建议" />

## 下一章 {#next}

八个模式都涉及一个绕不开的话题：边界在哪：[06 · 安全、权限与沙箱](/security/)。
