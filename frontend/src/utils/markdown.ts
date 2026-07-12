import { marked } from 'marked'
import { escapeHtml } from './escape'

marked.setOptions({
  breaks: true,
  gfm: true
})

marked.use({
  walkTokens(token) {
    if (token.type === 'html') {
      token.text = escapeHtml(token.text)
    }
  },
  renderer: {
    link(href: string, title: string | null | undefined, text: string) {
      if (href && !/^(https?:|mailto:|tel:)/i.test(href)) href = ''
      // title 已被 marked 预转义，无需重复 escapeHtml（否则二次转义导致 &quot; 显示为 &amp;quot;）
      const titleAttr = title ? ` title="${title}"` : ''
      return `<a href="${escapeHtml(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
    },
    image(href: string, title: string | null, text: string) {
      if (href && !/^https?:/i.test(href)) return ''
      const titleAttr = title ? ` title="${title}"` : ''
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr} />`
    }
  }
})

export function renderMarkdown(text: string): string {
  try {
    return marked.parse(text || '', { async: false }) as string
  } catch {
    return escapeHtml(text)
  }
}
