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
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
    },
    image(href: string, title: string | null, text: string) {
      if (href && !/^https?:/i.test(href)) return ''
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<img src="${href}" alt="${text}"${titleAttr} />`
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
