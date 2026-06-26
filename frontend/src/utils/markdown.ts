import { marked } from 'marked'
import { escapeHtml } from './escape'

marked.setOptions({ breaks: true, gfm: true })

export function renderMarkdown(text: string): string {
  try {
    return marked.parse(text || '', { async: false }) as string
  } catch {
    return escapeHtml(text)
  }
}
