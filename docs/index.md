---
layout: home
title: Skill Hub 手册
titleTemplate: AI Agent 技能中心工程模式完全手册

hero:
  name: Skill Hub 手册
  text: 不是 Agent 不会干活，是没人把能力装进工具箱。
  tagline: 从技能元数据到沙箱执行，从版本灰度到计费审计。16 章体系、30+ 张手绘图解、可直接跑的 Skill Hub Demo 与生产踩坑，把 Agent 能力治理讲透。
  image:
    light: /hero-light.svg
    dark: /hero-dark.svg
    alt: Agent 通过技能中心发现、调用并审计技能
  actions:
    - theme: brand
      text: 从第 00 章开始
      link: /intro/
    - theme: alt
      text: 先看八大模式
      link: /patterns/
    - theme: alt
      text: 复制一个 Demo
      link: /demos/

features:
  - title: 先讲人话，再上讲义
    details: 每节都有「人话翻译」和生活类比，非开发也能读懂；紧接着给出字段、Schema 与代码，工程师能直接用。
  - title: 16 章，没有知识断层
    details: 从「为什么每个团队都在重复写同一个工具」一路到「企业级技能中心 + 计费审计」，中间不缺任何一块拼图。
  - title: 30+ 张手绘图解
    details: 分层图、调用时序、生命周期、选型矩阵、能力星图，全部手写 SVG/CSS，明暗主题都清晰。
  - title: 能跑起来的最小实现
    details: 400 行 Python Hub、MCP 接入、LangGraph 动态加载、Docker 沙箱、审计看板、Compose 部署，代码可直接复制。
  - title: 严格对齐官方规范
    details: 对照 MCP 的工具/资源/提示定义、OpenAI Function Calling 与 GPT Actions、LangChain Tool Calling 的字段约定。
  - title: 中英双语 + 明暗主题
    details: 全站一键切换语言与主题，PC、平板、手机自适应，文档质感与极客风并存。
---

<div class="a-home">

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Ecosystem</div>
      <h2 class="a-section__title">八块拼图，一套企业 Agent 技术栈</h2>
      <p class="a-section__lead">调度、协议、技能、通信、记忆、观测、评估、网关——少一块，系统就停在 Demo 阶段。</p>
    </div>
  </div>
  <Eco />
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Chapters</div>
      <h2 class="a-section__title">16 章目录：从重复造轮子到技能中心</h2>
      <p class="a-section__lead">建议按顺序读；正在救火的，直接跳到第 03、05、06、12 章。</p>
    </div>
    <a class="a-section__more" href="/agent-skillhub-patterns/start/">阅读指南 →</a>
  </div>
  <ChapterMap />
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Reading paths</div>
      <h2 class="a-section__title">三条路径，选一条走</h2>
      <p class="a-section__lead">同一本书，三种读法。别从头啃到尾，先解决你手上的问题。</p>
    </div>
  </div>
  <div class="a-paths">
    <div class="a-path">
      <div class="a-path__k">小白 / 产品</div>
      <div class="a-path__t">先建立直觉</div>
      <div class="a-path__d">不写代码也能读完：知道技能和工具的区别、技能中心到底解决什么问题。</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-skillhub-patterns/intro/">00 开篇</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/concepts/">01 概念</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/metadata/">03 元数据</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/security/">06 安全</a>
      </div>
    </div>
    <div class="a-path">
      <div class="a-path__k">开发者</div>
      <div class="a-path__t">先跑通再深挖</div>
      <div class="a-path__d">照着 Demo 起一个最小 Hub，再回头补元数据、模式、生命周期与踩坑。</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-skillhub-patterns/demos/">13 Demo</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/architecture/">02 架构</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/patterns/">05 模式</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/pitfalls/">12 踩坑</a>
      </div>
    </div>
    <div class="a-path">
      <div class="a-path__k">架构师</div>
      <div class="a-path__t">先定边界再落地</div>
      <div class="a-path__d">关注选型、租户隔离、审计合规与成本，把技能中心放进现有企业架构。</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-skillhub-patterns/landscape/">10 选型</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/security/">06 安全</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/deploy/">11 部署</a>
        <a class="a-path__step" href="/agent-skillhub-patterns/ecosystem/">09 生态</a>
      </div>
    </div>
  </div>
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Mental model</div>
      <h2 class="a-section__title">先用一份清单看懂一个技能</h2>
      <p class="a-section__lead">抛开框架名词，一个能被 Agent 安全调用的技能只需要回答五件事：叫什么、干什么、怎么传参、谁能用、出错怎么办。</p>
    </div>
  </div>

```json
{
  "name": "order.lookup",
  "version": "1.4.0",
  "description": "按订单号查询单个订单的状态、金额与物流节点。仅在用户已提供订单号时使用；退款金额请用 refund.quote。",
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

  <p class="a-section__lead">少了 <code>description</code> 模型只能猜；少了 <code>input_schema</code> 参数永远对不上；少了 <code>scopes</code> 谁都能调；少了 <code>error_codes</code> 出错就只能重试到天亮。</p>
</section>

</div>

<div class="a-home-footer">
  <div class="a-home">
    <footer class="a-footer">
      <AuthorBrand />
      <div class="a-footer__row">
        <div>© 2026 鱼心 · Yuxin · MIT ｜ 与 better-agent、mcp-patterns、a2a-patterns、agent-memory-patterns、agent-observability-patterns、agent-evaluation-patterns、llm-gateway-patterns 共同维护</div>
        <div class="a-footer__links">
          <a href="https://yuxin.run" target="_blank" rel="noreferrer">作者主页</a>
          <a href="https://github.com/yuxinrun/agent-skillhub-patterns" target="_blank" rel="noreferrer">GitHub</a>
          <a href="/agent-skillhub-patterns/reading/">延伸阅读</a>
          <a href="/agent-skillhub-patterns/glossary/">术语表</a>
          <a class="a-footer__lang" href="/agent-skillhub-patterns/en/">English</a>
        </div>
      </div>
    </footer>
  </div>
</div>
