---
title: 00 · 开篇：为什么你的 Agent 永远在重复造轮子
description: 没有技能中心的团队要付多少代价、Skill Hub 到底是什么、Skill / Tool / MCP / Agent 的关系，以及它在技术栈里的位置。
outline: [2, 3]
---

# 00 · 开篇：为什么你的 Agent 永远在重复造轮子

先讲个真实场景。

某公司上了三个 Agent：客服 Agent、运营 Agent、内部知识助手。三个月后老板想看「这个月退款为什么涨了」，于是三个团队各自加了一个「查订单」工具。

- 客服团队查的是 `order_v2` 表，字段 `status`。
- 运营团队查的是数仓宽表，字段 `order_state`。
- 知识助手直接调了旧版 API，那个 API 上个月已经停止写入了。

三个工具都能跑通 demo，三个答案都不一样。老板问了一句：「到底哪个是对的？」

**没有人敢回答。** 因为这三个工具没有任何一个地方记录着：谁写的、什么版本、谁能调、上次改了什么。

::: tip 全章一句话
Agent 不会重复造轮子，是**人**在重复造轮子。缺的不是模型能力，是让能力「沉淀一次、全公司复用」的那层基础设施。
:::

## 01 没有 Skill Hub 的团队有多惨 {#pain}

<Diagram id="wheel" />

这条时间线上没有坏人。每个团队都在认真做事，问题出在**能力没有地方沉淀**。

具体会烂在这五处：

| 症状 | 具体表现 | 真实代价 |
| --- | --- | --- |
| 重复开发 | 同一个「查订单」被写了 3~5 遍 | 每个工具 3~10 人日，且 bug 各修一遍 |
| 版本混乱 | 有人调 `v1`，有人调最新 API | 一次上游改动，全公司 Agent 集体报错 |
| 权限失控 | 退款工具谁都能调，没人知道谁调过 | 出了资损，查不到人，只能全量下线 |
| 描述随意 | 工具描述写着「查询数据」 | Agent 靠猜，40% 的调用打偏 |
| 无法复用 | 新项目从零开始攒工具 | 每上新场景都像第一次做 Agent |

::: warning 一个反直觉的事实
工具越多，Agent 不一定越强。**没有治理的工具越多，Agent 越容易选错**。后面第 07 章会专门讲「技能过载」这个反模式。
:::

## 02 什么是 Skill Hub：AI 世界的应用商店 {#what}

**Skill Hub（技能中心）** 是这样一个平台：所有可被 Agent 调用的能力，都在这里**注册、被检索、被授权、被执行、被计量**。

生活化类比：手机应用商店。

| 手机世界 | 技能世界 |
| --- | --- |
| App | Skill（技能） |
| 应用商店 | Skill Hub |
| App 详情页（版本、权限、评分） | 技能清单（manifest） |
| 安装时索要权限 | 调用时校验 scope |
| 崩溃上报、评分、下架 | 审计、评测、弃用 |
| 系统 API（相机、定位） | 底层 Tool / MCP Server |

它必须回答五个问题，缺一个就不算 Hub：

1. **有什么**（注册与目录）
2. **能不能用**（权限、租户、配额）
3. **用哪个版本**（版本、灰度、回滚）
4. **怎么跑**（转发 / 本地 / 沙箱）
5. **用了多少、谁用的**（审计与计费）

::: tip 人话翻译
Skill Hub 不是「一个放代码的 Git 仓库」，也不是「一个工具清单文档」。它是**带权限、带版本、带账本的执行入口**。Agent 只认识 Hub，不直接认识后面的服务。
:::

## 03 Skill / Tool / MCP / Agent 的关系 {#relation}

<Diagram id="four-roles" />

记住四个比喻，一次到位：

- **Tool = 螺丝刀**：能拧螺丝，但不知道你要装什么。
- **Skill = 「修水龙头」这项本事**：知道先关阀、再拆、再换垫圈，还知道拧坏了别硬来。它包括若干工具 + 说明书 + 权限 + 版本。
- **MCP = 插座标准**：规定插头长什么样、怎么通电。它不生产电，也不决定你插什么。
- **Agent = 上门师傅**：看现场、选工具、干活、出错时换招。

四者的关系可以写成一句话：

```text
Agent  用  →  Skill（能力包）
Skill  通过 →  MCP（协议）暴露或调用 Tool（函数）
MCP    只管 → 怎么把 Tool 说清楚、传过去
Tool   只负责 → 输入进去、输出出来
```

::: warning 最容易搞混的一句话
**MCP 不是技能中心，Skill Hub 也不是协议。** MCP 是「怎么说话」，Hub 是「谁能说话、说了算不算、说了多少次」。把 MCP Server 列表当 Skill Hub 用，你会在第一个租户隔离需求上卡死。
:::

## 04 技能中心在技术栈里的位置 {#stack}

<Diagram id="hub-stack" />

它是**能力中台**：上面接消费方（Agent、工作流引擎、业务系统），下面接实现（内部 API、MCP Server、Serverless、第三方 SaaS）。

为什么不让 Agent 直连？

| 直连的问题 | Hub 的解法 |
| --- | --- |
| 每个 Agent 各写一套鉴权 | 鉴权在 Hub 一次做完，Agent 只带用户身份 |
| 上游改字段，全体 Agent 挂 | 版本固定 + 兼容层，Hub 内切换 |
| 不知道谁在调、调了多少 | 全部经过 Hub，天然有账本 |
| 第三方技能直接进内网 | Hub 做白名单与沙箱，内网不暴露 |
| 无法灰度 | 按租户 / 比例切版本，一处生效 |

::: tip 人话翻译
Hub 就像公司前台：所有人必须从前台进，前台知道你是谁、找谁、有没有预约。绕过前台确实快，但出了事没人知道你来过。
:::

## 05 本手册解决的 10 大生产痛点 {#promise}

| # | 痛点 | 在哪一章解决 |
| --- | --- | --- |
| 1 | 工具重复开发、各写一遍 | [01](/concepts/#value) [05](/patterns/) |
| 2 | 技能描述写不好，Agent 乱调用 | [03](/metadata/#describe) [12](/pitfalls/#desc) |
| 3 | 技能太多，上下文爆炸 | [07](/discovery/#antipattern) |
| 4 | 权限不可控，越权调用 | [06](/security/#model) |
| 5 | 第三方技能不可信 | [06](/security/#sandbox) [12](/pitfalls/#untrusted) |
| 6 | 没有版本管理，升级即事故 | [04](/lifecycle/) |
| 7 | 出问题查不到人 | [06](/security/#audit) |
| 8 | 重试风暴打挂下游 | [12](/pitfalls/#retry) [14](/performance/#ratelimit) |
| 9 | 无法计费与配额管理 | [05](/patterns/#billing) |
| 10 | 不知道怎么选方案、怎么上线 | [10](/landscape/) [11](/deploy/) |

## 06 整套生态如何联动 {#eco}

<Diagram id="eco-hub" />

技能中心是「能力仓库」：**调度从它取货，网关管它的流量，观测看它的链路，评测卡它的上线门禁**。

| 兄弟项目 | 与技能中心的分工 | 章节 |
| --- | --- | --- |
| [better-agent](https://yuxinrun.github.io/better-agent/) | Agent 循环怎么动态加载技能 | [09](/ecosystem/#betteragent) |
| [mcp-patterns](https://yuxinrun.github.io/mcp-patterns/) | 协议怎么把技能暴露出去 | [08](/mcp/) |
| [a2a-patterns](https://yuxinrun.github.io/a2a-patterns/) | 跨 Agent 怎么共享与委派技能 | [09](/ecosystem/#a2a) |
| [agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/) | 记忆类技能怎么管 | [09](/ecosystem/#memory) |
| [llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/) | 技能调用的模型流量与成本 | [09](/ecosystem/#gateway) |
| [agent-observability-patterns](https://yuxinrun.github.io/agent-observability-patterns/) | 全链路追踪与指标 | [09](/ecosystem/#observability) |
| [agent-evaluation-patterns](https://yuxinrun.github.io/agent-evaluation-patterns/) | 技能上线前的自动化评测 | [09](/ecosystem/#evaluation) |

::: tip 一条工程纪律
八个仓库共用同一套 **tenant_id / skill_id / trace_id**。ID 对不上，账就对不上，追踪就断在中间。
:::

## 参考来源 {#refs}

<Source href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview" org="Anthropic" label="Agent Skills：技能目录结构、渐进式披露" />
<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="规范：Tool / Resource / Prompt 的协议定义" />
<Source href="https://platform.openai.com/docs/guides/function-calling" org="OpenAI" label="Function calling：工具描述与调用契约" />
<Source href="https://www.anthropic.com/engineering/building-effective-agents" org="Anthropic" label="Building effective agents：工作流与自主 Agent 的取舍" />

## 下一章 {#next}

先把四个词彻底分开：[01 · 核心概念](/concepts/)。概念不清，后面所有 schema 都会写歪。
