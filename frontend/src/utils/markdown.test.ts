import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('空字符串 → 空字符串', () => {
    expect(renderMarkdown('')).toBe('')
  })

  it('undefined/null 输入 → 走 fallback 不抛错', () => {
    // 实现里 text || '' 会把 undefined/null/空字符串统一处理
    expect(renderMarkdown(undefined as unknown as string)).toBe('')
    expect(renderMarkdown(null as unknown as string)).toBe('')
  })

  it('纯文本 → 段落包裹', () => {
    const r = renderMarkdown('hello')
    expect(r).toContain('hello')
    expect(r).toContain('<p>')
  })

  it('markdown 标题 → h1/h2', () => {
    const r = renderMarkdown('# Title')
    expect(r).toContain('<h1>')
    expect(r).toContain('Title')
  })

  it('行内 code 反引号 → <code>', () => {
    const r = renderMarkdown('use `npm install`')
    expect(r).toContain('<code>npm install</code>')
  })

  it('内嵌 HTML 被转义（XSS 防护）', () => {
    const r = renderMarkdown('<script>alert(1)</script>')
    expect(r).not.toContain('<script>')
    expect(r).toContain('&lt;script&gt;')
  })

  it('列表渲染', () => {
    const r = renderMarkdown('- a\n- b\n- c')
    expect(r).toContain('<ul>')
    expect(r).toContain('<li>a</li>')
    expect(r).toContain('<li>b</li>')
    expect(r).toContain('<li>c</li>')
  })
})

describe('renderMarkdown — 链接协议白名单（XSS 加固）', () => {
  it('javascript: 链接 → href 被置空', () => {
    const r = renderMarkdown('[click](javascript:alert(1))')
    expect(r).not.toContain('javascript:')
    expect(r).toContain('href=""')
  })

  it('vbscript: 链接 → href 被置空', () => {
    const r = renderMarkdown('[x](vbscript:msgbox(1))')
    expect(r).not.toContain('vbscript:')
  })

  it('data: 图片 → 整个 img 被移除', () => {
    const r = renderMarkdown('![img](data:image/png;base64,xxx)')
    expect(r).not.toContain('<img')
    expect(r).not.toContain('data:')
  })

  it('https 链接 → 保留并含 target=_blank 与 rel=noopener', () => {
    const r = renderMarkdown('[link](https://example.com)')
    expect(r).toContain('href="https://example.com"')
    expect(r).toContain('target="_blank"')
    expect(r).toContain('rel="noopener noreferrer"')
  })

  it('mailto/tel 链接 -> 保留', () => {
    expect(renderMarkdown('[m](mailto:a@b.com)')).toContain('mailto:a@b.com')
    expect(renderMarkdown('[t](tel:10086)')).toContain('tel:10086')
  })
})

describe('renderMarkdown - href/src 双引号注入防护（XSS 加固）', () => {
  it('link href 含双引号 -> 属性注入被阻断', () => {
    const r = renderMarkdown('[click](<https://evil.com" onmouseover="alert(1)>)')
    // " 被转义为 &quot;，onmouseover 在 href 属性值内部，不是独立属性
    expect(r).not.toMatch(/"\s+onmouseover/i)
  })

  it('image src 含双引号 -> 属性注入被阻断', () => {
    const r = renderMarkdown('![img](<https://evil.com" onerror="alert(1)>)')
    expect(r).not.toMatch(/"\s+onerror/i)
  })
})
