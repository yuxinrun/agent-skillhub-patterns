---
title: How to read this
description: Who this handbook is for, how it is written, and the three reading paths through sixteen chapters.
outline: [2, 3]
---

# How to read this

This is an engineering handbook, not a survey. Every chapter follows the same rhythm: plain language, then structure, then code, then a list of traps.

## 01 Who this is for {#who}

| Role | What you get |
| --- | --- |
| Beginner / PM | The judgement to decide "should this be a skill at all", in the same language as engineers |
| AI application developer | A registrable, callable minimal hub within a week |
| Backend / platform engineer | Skills as a service: registry, versions, permissions, sandbox, billing, audit |
| Architect / SaaS founder | A six-layer architecture, a selection matrix and a shipping roadmap |

::: tip In plain words
This book is not about making the model smarter. It is about making a team's capabilities reusable without losing control.
:::

## 02 How it is written {#style}

Every section tries to look like this:

1. **An analogy** so you can picture it (a hub is an app store for agents).
2. **A diagram** that pins down the actors and the order.
3. **A comparison table** that separates should from should-not.
4. **Runnable code**, not pseudocode.
5. **A pitfall list** — every trap you skip is money saved.
6. **A source link** — never only our retelling of an official spec.

## 03 How chapters depend on each other {#graph}

<Diagram id="book-map" />

Three threads:

- **Concept thread (00 → 01 → 03)**: separate Tool, Skill, MCP and Agent before designing metadata. Unclear concepts produce wrong schemas.
- **Engineering thread (02 → 05 → 06 → 11)**: architecture decides patterns, patterns decide security boundaries, boundaries decide deployment.
- **Operations thread (04 → 07 → 14)**: lifecycle, discovery and performance are all "what happens when skills multiply".

## 04 Three recommended paths {#paths}

### Beginner / product

```text
00 Opening → 01 Concepts → 03 Metadata → 06 Security → 10 Selection
```

No code required. The goal is judgement: which capabilities deserve to be skills, and which risks need a human owner.

### Developer

```text
13 Demos (get it running) → 02 Architecture → 05 Patterns → 03 Metadata → 12 Pitfalls
```

Run the minimal hub first; architecture and patterns land much better afterwards.

### Architect

```text
02 Architecture → 06 Security → 10 Selection → 11 Deploy → 09 Ecosystem
```

Boundaries and cost first. Most hubs die from overestimating what the organisation can maintain.

## 05 Conventions {#conventions}

| Notation | Meaning |
| --- | --- |
| `skill.name@1.4.0` | Skill name plus semantic version; versions are always pinned |
| `scope` | Permission scope, e.g. `orders:read`, `refund:write` |
| `tenant` | Tenant identifier; every query carries it, never trust it from arguments |
| `trace_id` | Identifier shared by audit, observability and metering |
| "In plain words" | A translation of the engineering paragraph above |

::: warning About versions
Versions in this book are illustrative. Use your own registry in production, and **always pin versions** — never let an agent call `latest`.
:::

## 06 Ways to use this book {#use}

- **Self-study**: follow a path and run every demo.
- **Team session**: each chapter starts with a one-line conclusion you can use as a slide title.
- **Design review**: chapters 02, 06, 10 and 11 work as a checklist.
- **Implementation**: chapter 13 plus the templates in chapter 03 form a minimal viable hub.

Start with [chapter 00](/en/intro/). If you are already on fire, jump to [the pitfall catalog](/en/pitfalls/).
