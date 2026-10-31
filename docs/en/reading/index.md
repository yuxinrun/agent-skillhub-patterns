---
title: Sources and references
description: The official specs, vendor docs, open-source projects and community write-ups this handbook is aligned with, plus how to spot stale material.
outline: [2, 3]
---

# Sources and references

This page does one thing: tell you **where the claims come from**. Whenever a statement can be verified against a primary source, we link it instead of asking you to trust us.

::: tip The one-line rule
Protocols change slowly, vendor capabilities change monthly, and the traps change weekly. **Read specs for formats, docs for capabilities, communities for scars.**
:::

## 01 How sources are ranked here {#layers}

<Source href="https://modelcontextprotocol.io/specification/latest" org="MCP" label="specification (latest)" />

| Tier | Source | Confirms | Refresh rate |
| --- | --- | --- | --- |
| L1 Spec | MCP spec, JSON Schema, OpenAPI Specification | Field names, wire formats, error semantics | 6–12 months |
| L2 Vendor docs | Anthropic, OpenAI, LangChain, Dify, FastGPT | How far a capability is actually supported | 1–2 months |
| L3 Community | Juejin, InfoQ, Aliyun/Tencent docs, repo issues | Traps and trade-offs at real scale | Weekly |

::: warning A common misread
"Some blog says MCP supports X" is not "the spec supports X". **If the spec does not say it, treat it as a vendor extension** — and it will break the moment you cross vendors.
:::

## 02 Primary sources {#official}

### Anthropic: skills and tool design {#anthropic}

| Source | Confirms | Chapters |
| --- | --- | --- |
| [Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) | Skill folder layout, progressive disclosure, where executables fit | [01](/en/concepts/) [03](/en/metadata/) |
| [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) | Descriptions, return shapes, token efficiency | [03](/en/metadata/#describe) [07](/en/discovery/) |
| [Tool use](https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview) | `tool_use` / `tool_result` message contract | [02](/en/architecture/#access) |
| [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | Workflows versus autonomous agents | [05](/en/patterns/#workflow) |
| [Claude Code security](https://docs.claude.com/en/docs/claude-code/security) | Permission prompts and sandboxing for local execution | [06](/en/security/#sandbox) |

### OpenAI: Actions and function calling {#openai}

| Source | Confirms | Chapters |
| --- | --- | --- |
| [Function calling](https://platform.openai.com/docs/guides/function-calling) | `tools` array, `strict` mode, parallel calls, argument validation | [03](/en/metadata/#validate) |
| [GPT Actions](https://platform.openai.com/docs/actions) | Describing external APIs with an OpenAPI schema | [08](/en/mcp/#wrap) |
| [OpenAPI Specification](https://spec.openapis.org/oas/latest.html) | The description standard for wrapping REST | [08](/en/mcp/#wrap) |
| [Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) | Constraining responses to a schema | [03](/en/metadata/#errors) |

### LangChain and LangGraph {#langchain}

| Source | Confirms | Chapters |
| --- | --- | --- |
| [Tools](https://python.langchain.com/docs/concepts/tools/) | Tool definitions, `args_schema`, error handling | [01](/en/concepts/#toolskill) |
| [Tool calling](https://python.langchain.com/docs/concepts/tool_calling/) | How models select tools and fill arguments | [07](/en/discovery/#hybrid) |
| [LangGraph](https://langchain-ai.github.io/langgraph/) | Multi-step skills, checkpoints, human approval nodes | [05](/en/patterns/#workflow) [13](/en/demos/#langgraph) |

### MCP: protocol and security {#mcp}

| Source | Confirms | Chapters |
| --- | --- | --- |
| [MCP site](https://modelcontextprotocol.io/) | Concepts, SDKs, sample servers | [08](/en/mcp/) |
| [Specification](https://modelcontextprotocol.io/specification/latest) | JSON-RPC messages, initialisation, capability negotiation | [08](/en/mcp/#bridge) |
| [Tools](https://modelcontextprotocol.io/specification/latest/server/tools) | `tools/list`, `tools/call`, `inputSchema` | [03](/en/metadata/#fields) |
| [Resources and prompts](https://modelcontextprotocol.io/specification/latest/server/resources) | Where the three capability types differ | [08](/en/mcp/#three) |
| [Security best practices](https://modelcontextprotocol.io/specification/latest/basic/security_best_practices) | Token passthrough, proxying, confused deputy | [06](/en/security/#abuse) |
| [MCP Registry](https://github.com/modelcontextprotocol/registry) | The official registry approach | [08](/en/mcp/#registry) |

## 03 Open-source implementations {#opensource}

| Project | Worth reading | Chapters |
| --- | --- | --- |
| [Dify](https://docs.dify.ai/) · [marketplace](https://marketplace.dify.ai/) | Tool schemas, auth config, marketplace distribution | [10](/en/landscape/#platform) |
| [FastGPT](https://doc.fastgpt.in/) | How a skill library is organised, node reuse | [05](/en/patterns/#compose) |
| [LangFlow](https://docs.langflow.org/) | Componentised tools, visual flows | [10](/en/landscape/#platform) |
| [OpenAPI](https://www.openapis.org/) | Making any REST service describable | [08](/en/mcp/#wrap) |
| [JSON Schema](https://json-schema.org/) | The common language of input validation | [03](/en/metadata/#validate) |

::: tip How to read someone else's hub
Data model first (how skills are stored), then call path (who validates, who executes, who meters), then the permission table. Those three tell you whether it can ship.
:::

## 04 Community and regional practice {#community}

| Source | Good for | Caveat |
| --- | --- | --- |
| [Juejin](https://juejin.cn/) | Implementation detail and postmortems from working engineers | Often version-stale; check the date |
| [InfoQ](https://www.infoq.cn/) | Architecture trade-offs and platform stories | Narrative-heavy; verify details against docs |
| [Aliyun docs](https://help.aliyun.com/) | Gateways, function compute, auth patterns | Tied to their products |
| [Tencent Cloud docs](https://cloud.tencent.com/document/) | Plugin marketplaces from an operator's view | Same |
| [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) | Injection and data-leak threat lists | Use it in design reviews |

::: danger Do not copy a community design straight into production
That article solved the author's scale. Your tenant count, concurrency and compliance are different. Ask **why** they chose it and **what it cost** before copying.
:::

## 05 Spotting stale material {#freshness}

Three fast checks:

1. **Protocol version** — the MCP spec carries a date (`2025-06-18`). No version, no trust.
2. **Model assumptions** — anything claiming "the model will always return valid JSON" is a bet. Constrain with schema and validate anyway.
3. **Product names** — Plugins → Actions → Tools. Renames usually mean interface changes too.

::: tip In plain words
Check whether a tutorial states its version and date. If it does not, read it as a story, not as a manual.
:::

## 06 Citation conventions {#conventions}

- Every 【Source】 link opens **in a new tab** and points at the primary document, not at someone's summary.
- Each chapter ends with a short source list so a design review can verify everything in one pass.
- Links back factual claims only (fields, protocols, capabilities). Judgement calls are ours, and you are welcome to disagree.

::: tip Next
Back to [how to read this](/en/start/), or start at [chapter 00](/en/intro/).
:::
