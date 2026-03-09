import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "银轮实习笔记",
  description: "Spring AI + Ollama + DeepSeek 实践笔记",
  lang: 'zh-CN',
  base: '/tbqaidemo/',
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '实践案例', link: '/practice/spring-ai-chat' }
    ],
    sidebar: [
      {
        text: '实践案例',
        items: [
          { text: 'Spring AI + Ollama + DeepSeek 聊天应用', link: '/practice/spring-ai-chat' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com' }
    ],
    footer: {
      message: 'AI 学习笔记',
      copyright: 'Copyright © 2026'
    },
    outline: {
      label: '页面导航',
      level: [2, 3]
    },
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    }
  },
  markdown: {
    lineNumbers: true
  }
})
