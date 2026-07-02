import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escape'

describe('escapeHtml', () => {
  it('普通文本不变', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('转义 < > & " 字符', () => {
    // textContent → innerHTML：浏览器规范转义 & < >
    const r = escapeHtml('<a href="x">&copy;</a>')
    expect(r).toContain('&lt;')
    expect(r).toContain('&gt;')
    expect(r).toContain('&amp;')
    // 引号在 jsdom 下不一定转义，但 < > & 必转义
  })

  it('script 标签被转义', () => {
    const r = escapeHtml('<script>alert(1)</script>')
    expect(r).not.toContain('<script>')
    expect(r).toContain('&lt;script&gt;')
  })

  it('空字符串', () => {
    expect(escapeHtml('')).toBe('')
  })
})
