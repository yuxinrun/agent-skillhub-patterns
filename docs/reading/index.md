---
title: 参考资料与来源
description: 本手册对齐的官方一手资料、开源实现与社区实战文章，以及判断资料是否过期的标准。
outline: [2, 3]
---

# 参考资料与来源

这一页只做一件事：告诉你书里的说法**从哪儿来的**。凡是能点开官方原文验证的，我们就不只给结论。

::: tip 一句话原则
技能中心的工程实践变化很快，**协议看规范、能力看官方文档、坑看社区**。三者缺一个，你都会在半年后返工。
:::

## 01 本手册的资料分层 {#layers}

<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="规范（latest）" />

资料按可信度分三层，优先级从高到低：

| 层级 | 来源 | 用来确认什么 | 更新频率 |
| --- | --- | --- | --- |
| L1 规范 | MCP 规范、JSON Schema、OpenAPI Specification | 字段名、协议格式、错误语义 | 半年到一年 |
| L2 官方文档 | Anthropic、OpenAI、LangChain、Dify、FastGPT | 某个能力**官方支持到什么程度** | 一到两个月 |
| L3 社区实践 | 掘金、InfoQ、阿里云/腾讯云文档、开源仓库 issue | 真实规模下的坑与取舍 | 每周 |

::: warning 一个常见误判
「某篇公众号说 MCP 支持 X」不等于规范支持 X。**规范没写的，就当成实现私货**，跨厂商就会碎。
:::

## 02 官方一手资料 {#official}

### Anthropic：Skill 与工具设计 {#anthropic}

| 资料 | 用来确认什么 | 对应章节 |
| --- | --- | --- |
| [Agent Skills 文档](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) | Skill 的目录结构、渐进式披露、可执行脚本的边界 | [01](/concepts/) [03](/metadata/) |
| [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) | 工具描述、返回结构、token 效率的官方建议 | [03](/metadata/#describe) [07](/discovery/) |
| [Tool use 文档](https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview) | 工具调用协议、`tool_use` / `tool_result` 消息格式 | [02](/architecture/#access) |
| [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | 何时用工作流、何时用自主 Agent | [05](/patterns/#workflow) |
| [Claude Code 安全](https://docs.claude.com/en/docs/claude-code/security) | 本地执行的权限提示与沙箱思路 | [06](/security/#sandbox) |

### OpenAI：Actions 与函数调用 {#openai}

| 资料 | 用来确认什么 | 对应章节 |
| --- | --- | --- |
| [Function calling](https://platform.openai.com/docs/guides/function-calling) | `tools` 数组、`strict` 模式、并行调用、参数校验 | [03](/metadata/#validate) |
| [GPT Actions](https://platform.openai.com/docs/actions) | 用 OpenAPI Schema 描述外部 API 的做法 | [08](/mcp/#wrap) |
| [OpenAPI Specification](https://spec.openapis.org/oas/latest.html) | 把传统 REST 包装成技能时的描述标准 | [08](/mcp/#wrap) |
| [Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) | 让返回值符合 schema 的约束方式 | [03](/metadata/#errors) |

### LangChain / LangGraph：工具与编排 {#langchain}

| 资料 | 用来确认什么 | 对应章节 |
| --- | --- | --- |
| [Tools 概念](https://python.langchain.com/docs/concepts/tools/) | 工具定义、`args_schema`、错误处理约定 | [01](/concepts/#toolskill) |
| [Tool calling](https://python.langchain.com/docs/concepts/tool_calling/) | 模型侧如何选择与传参 | [07](/discovery/#hybrid) |
| [LangGraph](https://langchain-ai.github.io/langgraph/) | 多步骤技能、检查点、人工审批节点 | [05](/patterns/#workflow) [13](/demos/#langgraph) |

### MCP：协议与安全 {#mcp}

| 资料 | 用来确认什么 | 对应章节 |
| --- | --- | --- |
| [MCP 官网](https://modelcontextprotocol.io/) | 概念总览、SDK、示例 Server | [08](/mcp/) |
| [规范](https://modelcontextprotocol.io/specification/latest) | JSON-RPC 消息、初始化握手、能力协商 | [08](/mcp/#bridge) |
| [Tools 规范](https://modelcontextprotocol.io/specification/latest/server/tools) | `tools/list`、`tools/call`、`inputSchema` | [03](/metadata/#fields) |
| [Resources / Prompts](https://modelcontextprotocol.io/specification/latest/server/resources) | 三类能力的边界 | [08](/mcp/#three) |
| [安全最佳实践](https://modelcontextprotocol.io/specification/latest/basic/security_best_practices) | token 透传、代理、混淆代理问题 | [06](/security/#abuse) |
| [MCP Registry](https://github.com/modelcontextprotocol/registry) | 官方的服务注册与发现思路 | [08](/mcp/#registry) |

## 03 开源实现与平台方案 {#opensource}

| 项目 | 值得看的地方 | 对应章节 |
| --- | --- | --- |
| [Dify](https://docs.dify.ai/) · [插件市场](https://marketplace.dify.ai/) | 工具/插件的描述格式、鉴权配置、市场分发 | [10](/landscape/#platform) |
| [FastGPT](https://doc.fastgpt.in/) | 技能库的组织方式、工作流节点的复用 | [05](/patterns/#compose) |
| [LangFlow](https://docs.langflow.org/) | 组件化工具、可视化编排导出 | [10](/landscape/#platform) |
| [OpenAPI](https://www.openapis.org/) | 把任何 REST 服务变成可描述技能 | [08](/mcp/#wrap) |
| [JSON Schema](https://json-schema.org/) | 入参校验的唯一通用语言 | [03](/metadata/#validate) |

::: tip 读开源代码的正确姿势
先看它的**数据模型**（技能/工具怎么存），再看**调用链**（谁校验、谁执行、谁记账），最后看**权限表**。三样看完，你就能判断它能不能进生产。
:::

## 04 社区实战与国内落地 {#community}

| 来源 | 适合看什么 | 注意 |
| --- | --- | --- |
| [掘金](https://juejin.cn/) | 一线工程师的实现细节、踩坑复盘 | 版本容易过时，先看发布时间 |
| [InfoQ](https://www.infoq.cn/) | 架构取舍、平台化案例 | 偏叙事，细节需回官方文档核对 |
| [阿里云文档](https://help.aliyun.com/) | 网关、函数计算、鉴权体系的落地形态 | 与自家产品绑定较深 |
| [腾讯云文档](https://cloud.tencent.com/document/) | 插件市场、Agent 平台的运营视角 | 同上 |
| [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) | 提示注入、敏感信息泄露的威胁清单 | 用于设计评审 |

::: danger 别照抄社区方案上线
社区文章解决的是**作者那个规模**的问题。你的租户数、并发量、合规要求不同，方案就得改。抄之前先问：他为什么这么设计，代价是什么。
:::

## 05 怎么判断资料是否过期 {#freshness}

三个快速检查点：

1. **协议版本号**：MCP 规范带日期版本（如 `2025-06-18`），文章里没写版本号的，基本不可信。
2. **模型能力假设**：凡说「模型一定会按 JSON 返回」的，都在赌；现在要靠 schema 约束 + 校验兜底。
3. **厂商产品名**：从 Plugins → Actions → Tools 一路改名，名字变了意味着接口也变了。

::: tip 人话翻译
看到一篇教程，先看它**有没有写版本和日期**。没写，就当小说看，别当说明书。
:::

## 06 本手册的引用约定 {#conventions}

- 正文中的【参考来源】一律**新标签页打开**，指向官方原文，不指向二手解读。
- 章节末尾的「参考来源」列出该章依赖的核心资料，方便设计评审时一次性核对。
- 引用只用于**事实性描述**（字段、协议、能力），观点与取舍属于本手册的判断，欢迎反驳。

::: tip 下一步
回 [阅读指南](/start/) 挑一条适合你的路径，或者直接从 [第 00 章](/intro/) 开始。
:::
