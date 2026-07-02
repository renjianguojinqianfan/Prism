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
