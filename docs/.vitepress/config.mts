import { defineConfig } from 'vitepress'
import { catalog } from './data/catalog'
import { ecosystem, siteMeta } from './data/ecosystem'

const sidebarZh = [
  {
    text: '开始',
    items: [
      { text: '阅读指南', link: '/start/' },
      { text: '生态全景：八块拼图', link: '/intro/#eco' },
    ],
  },
  ...catalog.map((c) => ({
    text: `${c.num} · ${c.zhTitle}`,
    link: `/${c.slug}/`,
    collapsed: true,
    items: [
      { text: '本章导语', link: `/${c.slug}/#top` },
      ...c.sections.map((s) => ({ text: s.zh, link: `/${c.slug}/#${s.id}` })),
    ],
  })),
  {
    text: '附录',
    items: [
      { text: '术语表', link: '/glossary/' },
      { text: '延伸阅读与参考', link: '/reading/' },
    ],
  },
]

const sidebarEn = [
  {
    text: 'Start here',
    items: [
      { text: 'How to read this', link: '/en/start/' },
      { text: 'The eight-piece map', link: '/en/intro/#eco' },
    ],
  },
  ...catalog.map((c) => ({
    text: `${c.num} · ${c.enTitle}`,
    link: `/en/${c.slug}/`,
    collapsed: true,
    items: [
      { text: 'Chapter intro', link: `/en/${c.slug}/#top` },
      ...c.sections.map((s) => ({ text: s.en, link: `/en/${c.slug}/#${s.id}` })),
    ],
  })),
  {
    text: 'Appendix',
    items: [
      { text: 'Glossary', link: '/en/glossary/' },
      { text: 'Further reading', link: '/en/reading/' },
    ],
  },
]

const ecoNavZh = {
  text: '生态',
  items: ecosystem
    .filter((e) => !e.current)
    .map((e) => ({ text: `${e.name} · ${e.zhRole}`, link: e.url })),
}

const ecoNavEn = {
  text: 'Ecosystem',
  items: ecosystem
    .filter((e) => !e.current)
    .map((e) => ({ text: `${e.name} · ${e.enRole}`, link: e.url })),
}

const descriptionZh =
  'AI Agent 技能中心工程模式完全手册：技能注册、版本管理、权限控制、安全沙箱、自动发现、审计计费，从零到生产级，中英双语。'
const descriptionEn =
  'The complete field guide to AI agent skill hubs: registry, versioning, permissions, sandboxes, discovery, audit and metering.'

export default defineConfig({
  base: '/agent-skillhub-patterns/',
  lang: 'zh-CN',
  title: 'Skill Hub 手册',
  description: descriptionZh,
  cleanUrls: false,
  lastUpdated: false,
  sitemap: {
    hostname: 'https://yuxinrun.github.io/agent-skillhub-patterns/',
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/agent-skillhub-patterns/favicon.svg' }],
    ['link', { rel: 'icon', href: '/agent-skillhub-patterns/favicon.svg', sizes: 'any' }],
    ['link', { rel: 'apple-touch-icon', href: '/agent-skillhub-patterns/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#0a958a' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Skill Hub 手册 · Agent Skill Hub Patterns' }],
    ['meta', { property: 'og:description', content: descriptionEn }],
    ['meta', { property: 'og:url', content: 'https://yuxinrun.github.io/agent-skillhub-patterns/' }],
  ],
  markdown: {
    lineNumbers: true,
    // 代码块在明暗两种模式下都使用深色面板，因此统一采用深色 token，
    // 避免浅色模式出现「浅底主题色 + 深色背景」的低对比度问题。
    theme: { light: 'vitesse-dark', dark: 'vitesse-dark' },
    container: {
      tipLabel: '提示',
      warningLabel: '注意',
      dangerLabel: '危险',
      infoLabel: '说明',
      detailsLabel: '展开',
    },
  },
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'Skill Hub 手册',
      description: descriptionZh,
      themeConfig: {
        nav: [
          { text: '阅读指南', link: '/start/' },
          {
            text: '章节',
            items: catalog.map((c) => ({ text: `${c.num} · ${c.zhTitle}`, link: `/${c.slug}/` })),
          },
          { text: '八大模式', link: '/patterns/' },
          { text: '实战 Demo', link: '/demos/' },
          { text: '术语表', link: '/glossary/' },
          ecoNavZh,
        ],
        sidebar: sidebarZh,
        outline: { level: [2, 3], label: '本页目录' },
        docFooter: { prev: '上一章', next: '下一章' },
        lastUpdated: { text: '最后更新' },
        darkModeSwitchLabel: '主题',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        sidebarMenuLabel: '目录',
        returnToTopLabel: '回到顶部',
        langMenuLabel: '切换语言',
        externalLinkIcon: true,
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      title: 'Agent Skill Hub Patterns',
      description: descriptionEn,
      themeConfig: {
        nav: [
          { text: 'How to read', link: '/en/start/' },
          {
            text: 'Chapters',
            items: catalog.map((c) => ({ text: `${c.num} · ${c.enTitle}`, link: `/en/${c.slug}/` })),
          },
          { text: 'Patterns', link: '/en/patterns/' },
          { text: 'Demos', link: '/en/demos/' },
          { text: 'Glossary', link: '/en/glossary/' },
          ecoNavEn,
        ],
        sidebar: sidebarEn,
        outline: { level: [2, 3], label: 'On this page' },
        docFooter: { prev: 'Previous', next: 'Next' },
        lastUpdated: { text: 'Last updated' },
        darkModeSwitchLabel: 'Appearance',
        lightModeSwitchTitle: 'Switch to light theme',
        darkModeSwitchTitle: 'Switch to dark theme',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Return to top',
        langMenuLabel: 'Change language',
        externalLinkIcon: true,
      },
    },
  },
  themeConfig: {
    logo: { src: '/logo.svg', alt: 'Agent Skill Hub Patterns' },
    siteTitle: 'Skill Hub',
    socialLinks: [{ icon: 'github', link: siteMeta.repo }],
    footer: {
      message:
        '内容基于 MCP 规范、Anthropic / OpenAI 工具与技能实践及公开工程经验整理，示例仅用于教学。',
      copyright: `© ${new Date().getFullYear()} 鱼心 · Yuxin · MIT`,
    },
  },

  vite: {
    server: { port: 5182 },
  },
})
