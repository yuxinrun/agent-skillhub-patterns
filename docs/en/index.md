---
layout: home
title: Agent Skill Hub Patterns
titleTemplate: A field guide to agent skill hubs

hero:
  name: Agent Skill Hub Patterns
  text: Your agent is not incapable. Nobody put the tools in a toolbox.
  tagline: From skill metadata to sandboxed execution, from canary versions to metered billing. Sixteen chapters, 30+ hand-drawn diagrams, runnable hubs and production scars.
  image:
    light: /hero-light.svg
    dark: /hero-dark.svg
    alt: An agent discovering, invoking and auditing skills through a central hub
  actions:
    - theme: brand
      text: Start at chapter 00
      link: /en/intro/
    - theme: alt
      text: The eight patterns
      link: /en/patterns/
    - theme: alt
      text: Copy a demo
      link: /en/demos/

features:
  - title: Plain language first
    details: Every section opens with a human translation and an analogy, then gets precise with schemas and code.
  - title: Sixteen chapters, no gaps
    details: From "why every team rewrites the same tool" all the way to an enterprise hub with billing and audit.
  - title: 30+ hand-drawn diagrams
    details: Layers, call sequences, lifecycles, selection matrices and capability maps, all SVG/CSS, crisp in both themes.
  - title: Minimal implementations that run
    details: A 400-line Python hub, MCP onboarding, LangGraph loading, a Docker sandbox, an audit dashboard and Compose.
  - title: Aligned with the specs
    details: MCP tools, resources and prompts; OpenAI function calling and GPT Actions; LangChain tool calling conventions.
  - title: Bilingual, light and dark
    details: One click for language and theme, responsive from phone to desktop.
---

<div class="a-home">

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Ecosystem</div>
      <h2 class="a-section__title">Eight pieces, one enterprise agent stack</h2>
      <p class="a-section__lead">Orchestration, protocol, skills, messaging, memory, observability, evals, gateway. Miss one and it stays a demo.</p>
    </div>
  </div>
  <Eco />
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Chapters</div>
      <h2 class="a-section__title">Sixteen chapters, from wheel to hub</h2>
      <p class="a-section__lead">Read in order, or jump to 03, 05, 06 and 12 if you are on fire.</p>
    </div>
    <a class="a-section__more" href="/agent-skillhub-patterns/en/start/">How to read →</a>
  </div>
  <ChapterMap />
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Reading paths</div>
      <h2 class="a-section__title">Three paths. Pick one.</h2>
      <p class="a-section__lead">Same book, three readings. Do not grind through it — solve the problem in front of you.</p>
    </div>
  </div>
  <div class="a-paths">
    <div class="a-path">
      <div class="a-path__k">Beginner / PM</div>
      <div class="a-path__t">Build intuition first</div>
      <div class="a-path__d">No code required: what a skill is, and what a hub actually buys you.</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-skillhub-patterns/en/intro/">00 Opening</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/en/concepts/">01 Concepts</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/en/metadata/">03 Metadata</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/en/security/">06 Security</a>
      </div>
    </div>
    <div class="a-path">
      <div class="a-path__k">Developer</div>
      <div class="a-path__t">Run it, then go deeper</div>
      <div class="a-path__d">Stand up a minimal hub from a demo, then backfill metadata, patterns, lifecycle and pitfalls.</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-skillhub-patterns/en/demos/">13 Demos</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/en/architecture/">02 Architecture</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/en/patterns/">05 Patterns</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/en/pitfalls/">12 Pitfalls</a>
      </div>
    </div>
    <div class="a-path">
      <div class="a-path__k">Architect</div>
      <div class="a-path__t">Set boundaries first</div>
      <div class="a-path__d">Selection, tenant isolation, audit, compliance and cost: fit the hub into what you already run.</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-skillhub-patterns/en/landscape/">10 Selection</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/en/security/">06 Security</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/en/deploy/">11 Deploy</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/en/ecosystem/">09 Ecosystem</a>
      </div>
    </div>
  </div>
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Mental model</div>
      <h2 class="a-section__title">One manifest, five answers</h2>
      <p class="a-section__lead">Forget the framework names: a safely callable skill answers what it is, what it does, what it takes, who may call it, and how it fails.</p>
    </div>
  </div>

```json
{
  "name": "order.lookup",
  "version": "1.4.0",
  "description": "Look up one order's status, amount and tracking by order id. Only when the user has provided an id; use refund.quote for refund amounts.",
  "input_schema": {
    "type": "object",
    "properties": {
      "order_id": { "type": "string", "pattern": "^[A-Z]{2}\\d{10}$" }
    },
    "required": ["order_id"],
    "additionalProperties": false
  },
  "output_schema": { "type": "object", "required": ["status", "amount"] },
  "scopes": ["orders:read"],
  "tenant_visibility": ["acme", "acme-sandbox"],
  "timeout_ms": 3000,
  "quota": { "per_minute": 120, "per_tenant_day": 20000 },
  "error_codes": ["ORDER_NOT_FOUND", "UPSTREAM_TIMEOUT"]
}
```

  <p class="a-section__lead">Drop <code>description</code> and the model guesses; drop <code>input_schema</code> and the arguments never line up; drop <code>scopes</code> and anyone can call it; drop <code>error_codes</code> and failure means retrying until dawn.</p>
</section>

</div>

<div class="a-home-footer">
  <div class="a-home">
    <footer class="a-footer">
      <AuthorBrand />
      <div class="a-footer__row">
        <div>© 2026 鱼心 · Yuxin · MIT ｜ Maintained alongside better-agent, mcp-patterns, a2a-patterns, agent-memory-patterns, agent-observability-patterns, agent-evaluation-patterns and llm-gateway-patterns</div>
        <div class="a-footer__links">
          <a href="https://yuxin.run" target="_blank" rel="noreferrer">Author</a>
          <a href="https://github.com/yuxinrun/agent-skillhub-patterns" target="_blank" rel="noreferrer">GitHub</a>
          <a href="/agent-skillhub-patterns/en/reading/">Further reading</a>
          <a href="/agent-skillhub-patterns/en/glossary/">Glossary</a>
          <a class="a-footer__lang" href="/agent-skillhub-patterns/">中文</a>
        </div>
      </div>
    </footer>
  </div>
</div>
