---
title: 15 · 生态延伸与未来趋势
description: 技能交易市场与分成、自主技能进化、A2A 与 Skill Hub 跨平台互通、安全认证与可信评级。
outline: [2, 3]
---

# 15 · 生态延伸与未来趋势

前面十四章讲的都是「管好自己的技能」。这一章换个视角：**当技能开始跨团队、跨公司流动时，会发生什么。**

::: tip 全章一句话
技能网络越开放，你越依赖前面那套「元数据 + 权限 + 审计」的地基。**没有地基的开放，叫作事故。**
:::

<Diagram id="future-hub" />

## 00 先把话说清楚：什么会变，什么不会变 {#baseline}

| 会变 | 不会变 |
| --- | --- |
| 技能的来源（内部 → 市场） | 元数据契约（入参/出参 Schema）依旧是硬通货 |
| 计价方式（内部核算 → 对外收费） | 「谁调用了什么」必须可追溯 |
| 信任模型（同事 → 陌生开发者） | 不可信代码必须隔离执行 |
| 生态边界（单 Agent → 跨平台） | 权限必须按主体、按范围、按次数收紧 |

所以这一章不是「学新东西」，而是**把前面十四章的结论推到更大的尺度上**。

## 01 技能交易市场与分成 {#market}

### 生活类比

社区菜市场 vs 小区自提柜。自提柜里都是你家订的菜，出了错自己承担；菜市场里是别人的摊，你得看秤、看产地、看有没有检验章。**技能市场多出来的三件事：明码标价、质量背书、出了问题谁负责。**

### 从「内部核算」到「对外收费」缺什么

内部计费（第 05 章 `reserve/settle`）只关心配额；对外收费还得回答四个问题：

| 问题 | 内部核算 | 对外交易 |
| --- | --- | --- |
| 计价单位 | 次数即可 | 次数 / token / 时长 / 结果价值，可组合 |
| 谁付钱 | 部门预算 | 订阅、按量、预充值，可退款 |
| 开发者分成 | 不存在 | 平台抽成 + 作者分成，可对账 |
| 争议处理 | 内部沟通 | SLA、退款规则、调用凭证 |

### 最小的「可计费技能」元数据

```yaml
# skill.yaml（在原有 manifest 上加交易字段）
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
  license: commercial-1.0          # 授权类型：internal / commercial-1.0 / research-only
  price:
    model: per_call                # per_call | per_token | per_second | subscription
    unit_price: 0.008              # 以分为单位，避免浮点误差
    currency: CNY
  settlement:
    platform_share: 0.30           # 平台抽 30%
    author_share: 0.70             # 作者拿 70%
    min_payout_cents: 10000        # 满 100 元才结算，压降转账成本
  sla:
    availability: 0.995
    p95_ms: 2500
    refund_on_failure: true        # 失败不收费 —— 这条最能建立信任
```

### 分成结算的最小实现

```python
from decimal import Decimal, ROUND_HALF_UP

def settle(call_row, skill_meta) -> dict:
    """把一次成功调用转成三笔账：平台、作者、租户扣费"""
    price = skill_meta["commercial"]["price"]
    if price["model"] != "per_call":
        raise NotImplementedError("本 Demo 只演示按次计费")

    amount = Decimal(price["unit_price"])            # 单位：分
    if call_row.status != "ok" and skill_meta["commercial"]["sla"]["refund_on_failure"]:
        amount = Decimal(0)                          # 失败不计费

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

::: danger 三个能把市场做死的设计
1. **失败也收费**：一次两次还行，第三次作者就被集体差评了。
2. **按调用计费但调用方无上限**：Agent 循环调用一次任务 300 次，账单吓死人。必须配「单次任务预算」。
3. **结算用浮点数**：分账差一分钱，作者会一直找你。**金额一律用整数分或 Decimal。**
:::

### 市场侧的看板样例

| 指标 | 口径 | 用途 |
| --- | --- | --- |
| GMV | 已结算调用金额 | 市场规模 |
| 抽成率 | platform_cents / 总金额 | 平台健康度 |
| 退款率 | 失败免单金额 / GMV | 质量信号，>3% 要查 |
| 作者留存 | 连续两月有收入的作者 | 供给侧是否健康 |
| 单技能集中度 | Top3 技能收入占比 | 过高说明生态单一 |

## 02 自主技能进化 {#evolution}

### 生活类比

老师傅写菜谱（人写 Skill）→ 学徒照着做，记下「哪一步总糊锅」（从轨迹里找失败模式）→ 学徒改一版菜谱，先自己试做十遍（离线评测）→ 摆上试吃台给三桌客人（灰度）→ 通过才进正菜单（发布）。

**关键点：学徒不能直接改正菜单。** 这就是「自主进化」和「自动搞坏线上」的分界线。

<Source href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview" org="Anthropic" label="Agent Skills：渐进式披露与技能文件结构" />
<Source href="https://dspy.ai/" org="DSPy" label="用数据驱动的方式优化提示词与程序" />

### 一条可上线的进化流水线

```text
调用轨迹 + 负反馈
      │
      ▼
① 挖掘：哪些调用反复失败？（按 error_code 聚类）
      │
      ▼
② 生成候选：改写 description / 加示例 / 拆子技能 / 调整 schema
      │
      ▼
③ 离线评测：黄金集回归 + 新旧对比（第 09 章的质量门禁）
      │  不通过 → 丢弃，只留记录
      ▼
④ 灰度：channel=canary，白名单 5%，观察 48 小时
      │  错误率上升 → 自动回滚（第 04 章）
      ▼
⑤ 转正：channel=ga，写变更日志，通知调用方
```

```python
import json

def propose_candidate(skill_name: str, failures: list[dict]) -> dict | None:
    """从失败样本里挑出「值得改」的模式；改不出来就返回 None"""
    by_code = {}
    for f in failures:
        by_code.setdefault(f["error_code"], []).append(f)

    worst_code, rows = max(by_code.items(), key=lambda kv: len(kv[1]))
    if len(rows) < 20:                     # 样本太少，改了也验证不了
        return None

    if worst_code == "INVALID_ARGUMENTS":
        # 最常见的原因：description 没说清参数格式
        return {"change": "description", "hint": "补入参格式示例与反例"}
    if worst_code == "SKILL_NOT_FOUND":
        return {"change": "split", "hint": "技能粒度过粗，考虑拆分"}
    if worst_code == "UPSTREAM_TIMEOUT":
        return {"change": "none", "hint": "是被调方问题，不该改技能"}
    return None


REQUIRED_GATES = {"schema_ok", "golden_set_regression", "pii_leak_scan"}

def promote(candidate: dict, gate_results: dict) -> str:
    """只有全部门禁通过才允许进 canary"""
    failed = REQUIRED_GATES - {k for k, v in gate_results.items() if v is True}
    if failed:
        audit("candidate_rejected", candidate["name"], failed= sorted(failed))
        return "rejected"
    audit("candidate_promoted", candidate["name"], to="canary")
    return "canary"
```

::: warning 「Agent 自己改技能」绝对要先关在三道门后面
1. **只能改描述、示例、默认值**，不能改权限、计费、外呼域名。
2. **必须过黄金集回归**，不允许「感觉更好了」。
3. **不能自签发布**：转正必须是人（或一个不带生成能力的发布服务）按下去。
:::

### 反模式：进化到自我循环

模型给自己写评测集、自己判分、自己发布 —— 这叫**自我表扬循环**，分数会一路上涨，真实质量不涨。评测集必须来自真实流量或人工标注，且**与生成侧隔离**。

## 03 A2A + Skill Hub：跨平台互通 {#crossplatform}

### 生活类比

以前每个小区自己修水管（各自实现技能）；现在街道统一接市政管网（协议标准化），但你家的水表权限还得自己管。

**A2A 解决「怎么找到别人、怎么委托」，Skill Hub 解决「我能提供什么、我方谁能用」。** 两者是垂直关系，不是替代关系。

<Source href="https://a2a-protocol.org/latest/specification/" org="A2A" label="Agent Card、Task 生命周期与消息格式" />
<Source href="https://www.rfc-editor.org/rfc/rfc8693.html" org="IETF" label="RFC 8693：OAuth 2.0 Token Exchange（跨域委派）" />

### 一张表看清职责边界

| 层 | A2A | Skill Hub |
| --- | --- | --- |
| 发现 | Agent Card（我是什么 Agent、能干什么） | 技能目录（我能提供什么、什么版本） |
| 契约 | Message / Part / Task 状态机 | 技能 manifest（入参出参 Schema） |
| 身份 | Agent 之间的互相认证 | 主体 → 租户 → 技能的授权 |
| 长任务 | Task 状态：working / input-required / completed | job_id + 回调（第 14 章） |
| 计费 | 不规定 | reserve / settle |

### 把技能暴露成 A2A 能力

```python
# agent_card.py —— 对外只暴露「允许外部调用」的子集
def public_card(hub, tenant: str) -> dict:
    skills = hub.registry.list_public(tenant)          # 必须显式标记 public
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
                "examples": s.examples[:2],            # 给对端 Agent 看的示例
            }
            for s in skills
        ],
    }
```

### 跨域委派：别把用户的 token 递出去

```python
import httpx

def exchange_token(caller_token: str, target_audience: str) -> str:
    """RFC 8693：用调用方 token 换一个只对目标服务有效的窄 token"""
    r = httpx.post("https://auth.example.com/oauth/token", data={
        "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
        "subject_token": caller_token,
        "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
        "audience": target_audience,          # 只给这一家
        "scope": "skill:order.read",          # 只给这一个范围
    }, timeout=5)
    r.raise_for_status()
    return r.json()["access_token"]
```

::: danger 混淆代理（Confused Deputy）就出在这里
外部 Agent 拿着「它能用的 token」来调你的高风险技能，你以为是内部调用。**必须校验 `aud`（受众）和 `scope`，并记录委派链**：谁把它委托给了谁。
:::

| 跨域检查项 | 不做会怎样 |
| --- | --- |
| 校验 `aud` | 拿 A 服务的 token 调 B 服务 |
| 校验 `scope` | 只买了读权限，却调了退款 |
| 记录委派链 | 出事查不到源头 |
| 对端做配额 | 一个外部 Agent 打爆你的技能 |
| 契约版本协商 | 对端按旧 schema 传参，全量报错 |

## 04 安全认证与可信评级 {#certification}

### 生活类比

有机蔬菜的认证标。标本身不值钱，值钱的是「有人替你查过、并且查错了要担责」。

### 认证的三根支柱

| 支柱 | 回答的问题 | 手段 |
| --- | --- | --- |
| 来源可信 | 这个包装是不是作者本人发的？ | 签名（Sigstore / cosign）、发布凭证 |
| 构建可复现 | 代码是不是从这份源码构建的？ | 构建溯源（SLSA）、锁文件、可复现构建 |
| 行为可验证 | 跑起来真的只做它说的事？ | 沙箱内网络白名单实测、权限最小化审计 |

<Source href="https://slsa.dev/spec/v1.0/levels" org="SLSA" label="构建级别：从「有构建脚本」到「可复现且防篡改」" />
<Source href="https://www.sigstore.dev/" org="Sigstore" label="无密钥签名与透明日志" />
<Source href="https://genai.owasp.org/llm-top-10/" org="OWASP" label="LLM Top 10：过度代理、供应链等风险" />

### 签名与验签最小示例

```bash
# 发布侧（CI 里执行，密钥不落盘）
cosign sign-blob --yes \
  --bundle dist/invoice.ocr-2.1.0.bundle \
  dist/invoice.ocr-2.1.0.tar.gz

# Hub 装包时强制验签
cosign verify-blob \
  --bundle dist/invoice.ocr-2.1.0.bundle \
  --certificate-identity-regexp '^https://github.com/yuxinrun/.*$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  dist/invoice.ocr-2.1.0.tar.gz
```

::: tip 验签要验「身份」而不只是「签名有效」
`--certificate-identity-regexp` 才是关键：任何人的签名都是「有效签名」。**必须限定是谁签的、由哪个 OIDC 签发机构担保。**
:::

### 可信分：把定性判断变成可排序的数字

```python
WEIGHTS = {
    "signed": 25,          # 有发布签名
    "slsa3": 20,           # 构建溯源达标
    "sandbox_passed": 20,  # 沙箱内行为测试通过
    "no_network": 10,      # 声明并实测无外呼
    "test_coverage": 10,   # 契约测试覆盖
    "incident_free_days": 15,   # 上线 90 天无安全事件
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

| 分数 | 等级 | 默认策略 |
| --- | --- | --- |
| 85–100 | A | 可直接引入，季度复审 |
| 70–84 | B | 允许 read 类技能，write 需审批 |
| 50–69 | C | 仅沙箱 + 无网络可试跑 |
| <50 | D | 禁止生产，只允许实验租户 |

::: warning 评级不是一劳永逸
签名过期、作者换人、依赖出现 CVE、90 天内出过事故 —— 任何一条都能让分数掉档。**评级必须有失效机制**，否则半年后它就是个装饰。
:::

## 05 未来 18 个月，值得押注的三件事 {#bets}

| 押注 | 为什么 | 现在能做的准备 |
| --- | --- | --- |
| 技能描述成为核心竞争力 | Agent 选错技能，80% 是描述写得糊（第 12 章） | 建描述规范 + 反例库 + 自动 lint |
| 注册中心标准化 | MCP Registry、A2A Agent Card 都在收敛格式 | 元数据与 registry 解耦（第 08 章） |
| 隔离从「可选」变「合规必需」 | 供应链风险进监管视野 | 沙箱默认开启，签名验签进发布流水线 |

## 06 全书收尾：如果只记三句话 {#takeaways}

1. **Skill Hub 不是工具箱，是能力中台**：它管的不是代码，是契约、权限和账。
2. **所有花活儿都建立在元数据上**：Schema 不严，后面全是补丁。
3. **越开放越要保守**：交易、进化、互通、认证，每往前一步，都要先把沙箱和审计往前一步。

::: tip 接下来去哪
- 想按顺序再读一遍：[阅读指南](/reading/)
- 忘了某个缩写：[术语表](/glossary/)
- 想核对原始资料：[参考来源](/reading/#official)
- 想看同系列其它专题：[生态矩阵](/intro/#eco)
:::

## 参考来源 {#refs}

<Source href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview" org="Anthropic" label="Agent Skills：结构与渐进式披露" />
<Source href="https://a2a-protocol.org/latest/specification/" org="A2A" label="Agent Card 与 Task 状态机" />
<Source href="https://www.rfc-editor.org/rfc/rfc8693.html" org="IETF" label="RFC 8693 Token Exchange" />
<Source href="https://slsa.dev/spec/v1.0/levels" org="SLSA" label="构建级别与溯源" />
<Source href="https://www.sigstore.dev/" org="Sigstore" label="签名与透明日志" />
<Source href="https://github.com/modelcontextprotocol/registry" org="MCP" label="官方 registry：注册中心的字段与接口" />
<Source href="https://genai.owasp.org/llm-top-10/" org="OWASP" label="LLM Top 10：过度代理与供应链风险" />
<Source href="https://dspy.ai/" org="DSPy" label="数据驱动的提示与程序优化" />

## 下一章 {#next}

没有下一章了。回目录看看还有哪一章想再读一遍：[阅读指南](/reading/) · [术语表](/glossary/) · [生态矩阵](/intro/#eco) · [回到首页](/)。
