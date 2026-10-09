'use client'

import { memo, useState, type ComponentProps } from 'react'
import ReactMarkdown, { type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { Check, Copy } from 'lucide-react'
import 'katex/dist/katex.min.css'
import { config } from '@/lib/config'

const { codeTheme } = config.theme
const { bracketMath } = config.markdown
const remarkPlugins = [remarkGfm, remarkMath]
const rehypePlugins = [rehypeKatex, rehypeHighlight]

// Maths is written between dollar signs, as Markdown's maths convention has it. A display
// equation that arrives on one line as $$ ... $$ would be set inline, so it is moved onto its
// own lines. Code spans and fences are left untouched.
//
// Standard Markdown reads \[ and \( as escaped brackets, and that is the default here. Some
// models write LaTeX between them instead; markdown.bracketMath turns on reading those as maths.
function normalizeMath(source: string) {
  if (!source.includes('$$') && !(bracketMath && (source.includes('\\(') || source.includes('\\[')))) return source
  return source.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/).map((segment, index) => {
    if (index % 2) return segment
    const text = segment.replace(/^([ \t]*)\$\$(.+?)\$\$[ \t]*$/gm, (_, indent: string, math: string) => `${indent}$$\n${indent}${math.trim()}\n${indent}$$`)
    if (!bracketMath) return text
    return text
      .replace(/\\\[([\s\S]+?)\\\]/g, (match, math: string) => looksLikeMath(math, false) ? `\n$$\n${math.trim()}\n$$\n` : match)
      .replace(/\\\(([\s\S]+?)\\\)/g, (match, math: string) => looksLikeMath(math, true) ? `$${math.trim()}$` : match)
  }).join('')
}

// With bracketMath on, \[ ... \] could still be an escaped bracket, as in \[required\_info\], so
// it only counts as LaTeX when what is inside reads as maths. Escaped punctuation (\_ \* \{) is
// set aside first: it is literal text in both Markdown and LaTeX.
function looksLikeMath(content: string, inline: boolean) {
  const text = content.replace(/\\[^a-zA-Z\s]/g, '')
  return /\\[a-zA-Z]{2,}/.test(text) // a command: \frac, \sum, \pi
    || /[\^=]/.test(text) // a power or an equation
    || /(^|[^A-Za-z])[A-Za-z]_/.test(text) // a subscript on a one-letter name: x_i, but not snake_case
    || /\d\s*[+\-*/<>]\s*\d/.test(text) // arithmetic on numbers: 2 + 2, 1/2
    || /(^|[^A-Za-z])[A-Za-z]\s*[+\-*<>]\s*[A-Za-z0-9]($|[^A-Za-z])/.test(text) // a + b, n - 1, x < y
    || (inline && /^\s*[A-Za-z]\s*$/.test(text)) // a lone variable: \(x\)
}

type SyntaxNode = { value?: string; children?: SyntaxNode[]; properties?: { className?: unknown } }
const nodeText = (node: SyntaxNode | undefined): string => node ? node.value ?? (node.children || []).map(nodeText).join('') : ''

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

function CodeBlock({ node, children }: ComponentProps<'pre'> & ExtraProps) {
  const [copied, setCopied] = useState(false)
  const code = (node as SyntaxNode | undefined)?.children?.[0]
  const classes = Array.isArray(code?.properties?.className) ? code.properties.className.map(String) : []
  const language = classes.find((name) => name.startsWith('language-'))?.slice(9)
  async function copy() {
    if (!(await copyText(nodeText(code).replace(/\n$/, '')))) return
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return <div className="code-block" style={codeTheme === 'auto' ? undefined : { colorScheme: codeTheme }}>
    <div className="code-block-header">
      <span data-testid="code-language">{language || 'code'}</span>
      <button type="button" data-testid="code-copy" onClick={copy}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
    </div>
    <pre>{children}</pre>
  </div>
}

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={{
    a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
    pre: CodeBlock,
    table: ({ node, ...props }) => <div className="my-4 overflow-x-auto"><table {...props} /></div>,
  }}>{normalizeMath(content)}</ReactMarkdown></div>
})
