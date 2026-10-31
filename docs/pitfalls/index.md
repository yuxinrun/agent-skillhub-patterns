---
title: 12 · 高频生产踩坑血泪清单
description: 描述写不好、技能过载、第三方不可信、版本失控、没有审计、权限越界、重试风暴：七个真实事故的现象、根因、止血与根治。
outline: [2, 3]
---

# 12 · 高频生产踩坑血泪清单

这一章的每一条都来自**真实事故发生后的复盘**。现象、根因、止血、根治，按这个顺序写，因为事故现场你需要的正是这个顺序。

::: tip 全章一句话
七个坑的共同点：**都不是技术难题，都是「少了一道约束」**。补约束的成本，永远低于事故成本。
:::

## 01 描述写不好，Agent 乱调用 {#desc}

**现象**：日志里 `order.lookup` 的入参常常是手机号；`order.search` 明明存在，却几乎没被调用过。用户投诉「答非所问」。

**根因**：描述写了「查询订单信息」，没说「按什么查」「什么时候别用」。

**止血**：在描述里加两句话——触发条件和排他条件。

```yaml
# 改前
description: 查询订单信息

# 改后
description: |
  按订单号（12~20 位纯数字）查询订单状态、支付结果与物流节点。
  用户提供订单号，或问「订单到哪了」「这笔付了吗」时使用。
  不要用于按手机号/姓名查单，那是 order.search 的职责。
```

**根治**：

| 动作 | 效果 |
| --- | --- |
| 描述四段式（做什么/何时用/何时别用/返回什么） | 误调用显著下降 |
| 维护 100 条「用户话术 → 应选技能」评测集 | 改描述前先跑一遍 |
| 描述变更按 minor 版本处理 | 可回滚，可对比 |

::: warning 症状容易误诊
「模型太笨」是最常见的错误结论。**先看描述，再看相似技能有几个，最后才怀疑模型。**
:::

## 02 技能太多，上下文爆炸 {#explosion}

**现象**：输入 token 从 4k 涨到 40k，成本翻十倍，准确率反而下降。模型开始在三个相似技能之间反复横跳。

**根因**：每次请求都把所有技能 schema 塞进上下文。

**止血**：立即限制可见技能数，先降级再优化。

```python
# 止血：只放 Top-K + 目录摘要
tools = build_tool_context(query, tenant)     # 见第 07 章 pack_by_budget
assert token_count(tools) < 2500, "tool context budget exceeded"
```

**根治**：

| 动作 | 说明 |
| --- | --- |
| 目录 + 按需拉取 | 默认只给领域与数量 |
| 合并同类技能 | 8 个 `order.*` → 3 个，用 `action` 区分 |
| 90 天零调用下线 | 技能库也要「大扫除」 |
| 分层路由 | 先域名级技能，再内部路由 |

::: tip 一个硬性预算
给工具定义的上下文预算：**≤ 2000 tokens**。超过就说明检索没做好，不是提示词的问题。
:::

## 03 第三方技能不可信 {#untrusted}

**现象**：接入一个「网页摘要」技能后，内部告警显示某台机器在向陌生域名发 POST，内容是用户的问题原文。

**根因**：第三方技能在 Hub 的 worker 里执行，网络未隔离，且能读到完整入参。

**止血**：立即禁用该技能 + 出网封禁 + 排查已泄露数据。

```bash
hub skills disable web.summarize --reason "suspected exfiltration"
# 同时在网络层封禁该技能可用的出口
```

**根治**：

| 动作 | 说明 |
| --- | --- |
| 进沙箱执行 | 禁网或出网白名单 |
| 入参最小化 | 只给完成该任务必需的字段 |
| 供应链校验 | 依赖锁版本 + 校验和 |
| 第三方准入 | 资质、DPA、安全评审 |

::: danger 「它看起来很正规」
正规的 SaaS 也可能被入侵，也可能把数据用于训练。**信任不是靠印象，是靠隔离与合同。**
:::

## 04 没有版本管理，升级即事故 {#version}

**现象**：某个技能把返回字段 `status` 从字符串改成对象，第二天 6 个 Agent 全部解析失败。

**根因**：没有版本，也没有兼容性检查，直接原地改。

**止血**：把旧行为补回来，或者紧急回滚。

```python
# 兼容层：新字段放在对象里，同时保留旧字段
return {
    "status": raw["status"]["code"],     # 旧字段，语义不变
    "status_detail": raw["status"],      # 新字段
}
```

**根治**：

| 动作 | 说明 |
| --- | --- |
| 每次发布生成不可变版本 | `1.4.0` 的产物永不覆盖 |
| 兼容性自动判定 | 删字段/改类型 → major（见第 04 章脚本） |
| 调用方固定版本 | 不接受 `latest` |
| 旧版本保留 7 天以上 | 给回滚留窗口 |

::: warning 最隐蔽的一种破坏
「新增必填参数」。老调用方不传，全部 `INVALID_ARGUMENTS`。**能加默认值就不要设必填。**
:::

## 05 没有审计，出了问题找不到是谁 {#noaudit}

**现象**：一笔 3 万元退款被重复执行了两次。查了两天，只知道「是某个 Agent 调的」。

**根因**：调用日志只记了技能名和时间，没有主体、没有 trace、没有幂等键。

**止血**：先按 trace 反查会话，同时冻结相关写技能。

**根治**：审计事件必须包含四要素 + 幂等键：

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

::: tip 审计的第一性原理
不是为了「记录」，是为了**在出事后 10 分钟内回答「谁批准的、谁执行的、执行了几次」**。做不到这个，审计就是摆设。
:::

## 06 权限失控，普通用户越权调用 {#privilege}

**现象**：客服账号通过 Agent 调用了 `order.refund.create`，退了 8 万元。事后发现该技能 `tenant_scope: ["*"]`，`scopes: []`。

**根因**：技能没声明 scopes，权限层「没声明就当不限制」。

**止血**：把该技能 scopes 补全，同时全局排查 `scopes: []` 的技能。

```sql
-- 30 秒内找出所有「裸奔」技能
select name, version from skills
where scopes = '{}' and status = 'ga';
```

**根治**：

| 动作 | 说明 |
| --- | --- |
| scopes 必填，CI 卡住空值 | 默认拒绝，不是默认允许 |
| 高风险 scope 强制审批 | `refund:write` 等 |
| 权限判断集中一处 | 见第 06 章 |
| 定期「权限反查」 | 从 scope 反查哪些技能会用到 |

::: danger 默认允许是最贵的默认值
「没声明就不限制」在开发期很爽，在生产期等于**给所有人开了后门**。默认必须是拒绝。
:::

## 07 重试风暴打挂下游 {#retry}

<Diagram id="retry-storm" />

**现象**：下游超时 3 秒，5 分钟后下游彻底不可用。日志显示 QPS 从 200 涨到 4000。

**根因**：Agent 重试 3 次 + Hub 重试 3 次 + SDK 重试 3 次，27 倍放大，且没有退避。

**止血**：立刻在网关层开熔断，把重试次数降到 1。

```python
# 唯一的重试策略：只在一层做，且必须退避 + 抖动
def with_retry(fn, *, max_attempts=2, base=0.2, cap=2.0):
    for i in range(max_attempts):
        try:
            return fn()
        except RetryableError:
            if i == max_attempts - 1:
                raise
            delay = min(cap, base * 2 ** i)
            time.sleep(delay * (0.5 + random.random()))   # 抖动防同步
```

**根治**：

| 动作 | 说明 |
| --- | --- |
| 重试只在执行层 | Agent 层不重试，只换方案 |
| 只重试 `retryable: true` | 参数错误重试等于烧钱 |
| 强制退避 + 抖动 | 防同步风暴 |
| 熔断 + 舱壁 | 见第 14 章 |
| 重试预算 | 全局重试不超过总请求的 10% |

::: warning 一个反直觉的原则
**重试不是可靠性手段，是可用性放大器**。下游健康时它救你，下游不健康时它杀你。所以必须配合熔断一起用。
:::

## 08 七条坑的速查表 {#summary}

| 坑 | 一句话根因 | 一句话根治 |
| --- | --- | --- |
| 描述乱 | 没写「何时别用」 | 四段式描述 + 评测集 |
| 上下文爆 | 全量塞入 | 目录 + Top-K + 预算 |
| 第三方偷数据 | 无隔离 | 沙箱 + 出网白名单 |
| 升级即事故 | 无版本 | 不可变版本 + 自动兼容判定 |
| 查不到人 | 日志≠审计 | 四要素 + 幂等键 |
| 越权 | 默认允许 | 默认拒绝 + scopes 必填 |
| 重试风暴 | 多层重试 | 单层重试 + 退避 + 熔断 |

## 参考来源 {#refs}

<Source href="https://www.anthropic.com/engineering/writing-tools-for-agents" org="Anthropic" label="工具描述与选择准确率" />
<Source href="https://owasp.org/www-project-top-10-for-large-language-model-applications/" org="OWASP" label="敏感信息泄露与供应链风险" />
<Source href="https://www.rfc-editor.org/rfc/rfc9457" org="RFC 9457" label="统一错误语义，避免无效重试" />
<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="追踪与错误归因字段" />

## 下一章 {#next}

坑都认识了，接下来直接上手：[13 · 可运行的实战 Demo](/demos/)。
