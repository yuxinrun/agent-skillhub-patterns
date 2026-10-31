---
title: 04 · 技能生命周期全流程
description: 开发、发布、灰度、上线、运维、下线、回滚七个阶段的准入条件、检查清单与操作命令。
outline: [2, 3]
---

# 04 · 技能生命周期全流程

技能不是「写完扔上去」的东西。它和软件一样有生老病死，区别是**它的病人是 Agent，而 Agent 不会抱怨，只会静默失败**。

::: tip 全章一句话
七个阶段，每个阶段都有**一道门**。把门装好，你就不会在凌晨三点看「为什么所有 Agent 都调错技能」。
:::

## 00 七个阶段 {#overview}

<Diagram id="lifecycle" />

| 阶段 | 一句话目标 | 出口条件 |
| --- | --- | --- |
| 开发 | 本地能跑、契约测试过 | schema 校验 + 单测 + 样例回放全绿 |
| 发布 | 有版本、有变更说明 | 清单完整、兼容性判定完成 |
| 灰度 | 小流量验证 | 错误率、P95、误调用率达标 |
| 上线 | 全量与通知 | 文档同步、调用方已知 |
| 运维 | 稳定跑着 | SLO 达标、告警可达 |
| 下线 | 优雅退场 | 调用量归零或已迁移 |
| 回滚 | 一键退回 | 一键切回、数据兼容 |

::: warning 90% 的事故发生在两个接口
**发布 → 灰度**（版本没固定，全量了）和 **下线 → 回滚**（旧版本删了，回不去）。这两处必须有自动化门禁。
:::

## 01 开发阶段：本地跑通 {#dev}

技能开发的难点不在逻辑，在**你必须在不接真业务系统的情况下证明它是对的**。

最小开发骨架：

```text
skills/order.lookup/
├── skill.yaml            # 清单
├── handler.py            # 实现
├── fixtures/             # 输入样例 + 期望输出
│   ├── ok.json
│   ├── not_found.json
│   └── upstream_timeout.json
└── tests/test_contract.py
```

契约测试至少要覆盖五类用例：

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

必测清单：

| 用例 | 为什么必须 |
| --- | --- |
| 正常路径 | 基线 |
| 参数非法（多字段、类型错、超长） | 模型一定会在某天传错 |
| 下游超时 | 验证 `retryable` 是否正确 |
| 下游 5xx | 验证不会把内部堆栈吐给用户 |
| 空结果 | 验证不会返回 `null` 让 Agent 崩 |
| 权限不足 | 验证拒绝路径也没泄露信息 |

::: tip 人话翻译
开发阶段的产出不是「能跑的代码」，是**「能证明它对」的代码**。fixtures 就是你的证据。
:::

## 02 发布阶段：版本与兼容 {#publish}

语义化版本不是形式主义，它是**给调用方的一句承诺**：

| 变更加了什么 | 版本位 | 例子 |
| --- | --- | --- |
| 修 bug，行为不变 | patch | 1.4.0 → 1.4.1 |
| 新增可选参数 / 新增返回字段 | minor | 1.4.0 → 1.5.0 |
| 删除字段、改字段类型、改错误码语义 | major | 1.4.0 → 2.0.0 |
| 只改描述 | patch（但也很危险） | 见下方警告 |

::: danger 「只改描述」也会引发事故
描述是模型的**选择依据**。把「查询订单」改成「查询订单与退款」，模型会把退款请求也丢给它，而实现根本没改。**描述变更要按 minor 处理，并跑一遍评测集。**
:::

发布前自动检查（建议做成 CI job）：

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

兼容性判定规则（可以写成脚本，别靠人记）：

```python
def classify(old, new) -> str:
    if set(old.output_schema) - set(new.output_schema):
        return "major"                       # 删字段
    if changed_types(old, new):
        return "major"                       # 改类型
    if set(old.error_codes) - set(new.error_codes):
        return "major"                       # 删错误码，调用方无法处理
    if new.input_schema.required - old.input_schema.required:
        return "major"                       # 新增必填参数
    if new.description != old.description or new.output_schema - old.output_schema:
        return "minor"
    return "patch"
```

::: warning 新增必填参数是最隐蔽的破坏
老调用方不会传新参数，于是全部 `INVALID_ARGUMENTS`。**能加默认值的，就不要设为必填。**
:::

## 03 灰度阶段：白名单放量 {#canary}

<Diagram id="canary" />

灰度不是「随机 10% 流量」，而是**按可控维度切流**，并且能立刻判断好坏。

```python
def pick_version(skill, ctx) -> str:
    plan = canary_plan(skill.name)               # 来自配置中心，可热更新
    if not plan or not plan.active:
        return skill.channels["stable"]

    # 1. 内部团队先上，出问题只影响自己人
    if ctx.tenant in plan.internal_tenants:
        return skill.channels["canary"]

    # 2. 白名单租户（愿意承担风险的客户）
    if ctx.tenant in plan.allowlist:
        return skill.channels["canary"]

    # 3. 比例放量，用租户 id 做稳定哈希，保证同一租户不会来回跳
    if hash_bucket(ctx.tenant, buckets=100) < plan.percent:
        return skill.channels["canary"]

    return skill.channels["stable"]
```

灰度期间必须盯四个指标：

| 指标 | 通过线（示例） | 说明 |
| --- | --- | --- |
| 错误率 | ≤ 旧版本 + 0.5pp | 绝对阈值容易误报，用相对差 |
| P95 延迟 | ≤ 旧版本 × 1.2 | 新版本常常悄悄变慢 |
| 误调用率 | 不升高 | 靠评测集与人工抽检 |
| 配额消耗 | 不暴涨 | 防止重试放大 |

::: danger 灰度的三个经典错误
1. **只按比例，不按租户**：同一个用户一会儿新一会儿旧，行为不一致，投诉翻倍。
2. **没有自动回滚条件**：指标超了没人看，灰度变成长期双版本。
3. **灰度计划没设过期时间**：三个月后发现 30% 流量还在 canary。
:::

```yaml
# canary 计划应该自带退出条件
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

## 04 正式上线：全量与通知 {#ga}

全量不是「把百分比改成 100」，而是一次**有通知的变更**：

- [ ] 调用方名单已导出（谁在用 `1.4.x`）
- [ ] 变更说明发布到内部公告 / IM 群
- [ ] 文档站同步（描述、示例、错误码）
- [ ] 监控看板已切到新版本维度
- [ ] 旧版本保留至少 7 天（给回滚留窗口）
- [ ] 评测集结果存档

```bash
hub release order.lookup@1.5.0 --to stable --notify cs-team,ops-team
```

::: tip 一句能省很多事的通知
「`order.lookup` 将于本周四全量到 1.5.0，新增 `shipping` 字段，无破坏性变更，回滚预案见 wiki。有疑问找 @cs-platform。」
——比十页技术文档有用。
:::

## 05 运维阶段：监控与容量 {#ops}

四个必看指标，对应四种事故：

| 指标 | 事故形态 | 处置 |
| --- | --- | --- |
| 调用量突增 | 上游循环调用 / 重试风暴 | 限流、熔断、查 trace |
| 错误率上升 | 下游变更 / 凭证过期 | 看错误码分布，别只看总数 |
| P95 上升 | 慢查询 / 连接池耗尽 | 看下游指标，必要时降级 |
| 配额超用 | 某租户异常 | 单独限流，别一刀切 |

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

::: warning 告警要看错误码，不看总数
错误率从 1% 涨到 3%，可能是下游抖动（可等待），也可能是某个错误码 `INVALID_ARGUMENTS` 暴涨（说明描述或 schema 变了）。处置完全不同。
:::

## 06 下线阶段：弃用与归档 {#sunset}

下线的正确顺序是：**先通知、再降级、最后删除**。

```text
T+0     标记 deprecated，调用时返回 warning 头 + 邮件通知 owner
T+30d   只读 / 只允许老租户调用，新租户不可见
T+60d   调用率 < 0.1% 后开始返回 DEPRECATED_SKILL（仍可调用，但带强提示）
T+90d   强制下线，返回 SKILL_RETIRED；保留元数据与审计，删除可执行产物
```

```python
def check_deprecation(skill, ctx):
    d = skill.deprecation
    if not d:
        return
    if d.phase == "retired":
        raise SkillRetired(alternative=d.replacement)   # 一定要给替代方案
    ctx.warnings.append({
        "code": "DEPRECATED_SKILL",
        "sunset_at": d.sunset_at,
        "replacement": d.replacement,
    })
```

::: danger 下线必须给替代方案
只返回「这个技能已下线」会让 Agent 卡死。要返回 `replacement: order.lookup@2`，模型才能自我修复。
:::

## 07 版本回滚：一键切回 {#rollback}

回滚要满足三个条件，否则叫「重启事故」：

1. **元数据快照存在**：能指回旧 version 的完整 manifest。
2. **数据兼容**：新版本写的数据，旧版本能读（或至少不崩）。
3. **流量能立刻切**：配置在注册层，不在客户端缓存里。

```python
def rollback(skill_name: str, to_version: str, reason: str):
    skill = registry.get(skill_name)
    assert to_version in skill.versions, "target version missing"
    registry.set_channel(skill_name, "stable", to_version)
    registry.invalidate_cache(skill_name, scope="all")     # 关键：清所有节点缓存
    audit.log(actor=current_user(), action="ROLLBACK",
              skill=skill_name, to=to_version, reason=reason)
```

| 回滚类型 | 耗时 | 适用 |
| --- | --- | --- |
| 指针回滚（切 channel） | 秒级 | 代码没变，只是新版本有问题 |
| 镜像回滚（部署旧构建） | 分钟级 | 执行层容器变了 |
| 数据回滚 | 小时级，慎用 | 新版本写坏了数据，需补偿脚本 |

::: tip 回滚演练
每季度做一次「盲盒回滚」：随机挑一个技能，不看文档，5 分钟内切回上一个版本。做不到，就说明你的回滚只是 PPT 上的能力。
:::

## 参考来源 {#refs}

<Source href="https://semver.org/" org="SemVer" label="语义化版本 2.0.0 规范" />
<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="能力协商：版本兼容与协议协商" />
<Source href="https://docs.dify.ai/" org="Dify" label="平台侧版本与发布管理参考" />
<Source href="https://opentelemetry.io/docs/specs/semconv/gen-ai/" org="OpenTelemetry" label="调用与延迟指标的标准命名" />

## 下一章 {#next}

流程清楚了，接下来是全书重点：[05 · 八大核心落地模式](/patterns/)。八种模式，配八段可抄的代码。
