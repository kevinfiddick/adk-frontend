'use client'

import { memo, useState, type ComponentProps } from 'react'
import ReactMarkdown, { type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { Check, Copy } from 'lucide-react'
import 'katex/dist/katex.min.css'

const remarkPlugins = [remarkGfm, remarkMath]
const rehypePlugins = [rehypeKatex, rehypeHighlight]

// Models often write LaTeX as \( ... \) and \[ ... \], which remark-math does not read, and put
// display equations on one line as $$ ... $$, which it would set inline. Rewrite those to the
// forms remark-math expects, leaving code spans and fences untouched.
function normalizeMath(source: string) {
  if (!source.includes('\\(') && !source.includes('\\[') && !source.includes('$$')) return source
  return source.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/).map((segment, index) => index % 2 ? segment : segment
    .replace(/^([ \t]*)\$\$(.+?)\$\$[ \t]*$/gm, (_, indent: string, math: string) => `${indent}$$\n${indent}${math.trim()}\n${indent}$$`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, math: string) => `\n$$\n${math.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, math: string) => `$${math.trim()}$`)).join('')
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
  return <div className="my-4 overflow-hidden rounded-xl border border-border/70 bg-[#111318]">
    <div className="flex items-center justify-between border-b border-white/10 py-1.5 pr-2 pl-4 text-xs text-slate-400">
      <span data-testid="code-language">{language || 'code'}</span>
      <button type="button" data-testid="code-copy" onClick={copy} className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-white/10 hover:text-slate-100">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
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
