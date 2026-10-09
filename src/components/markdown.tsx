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
const remarkPlugins = [remarkGfm, remarkMath]
const rehypePlugins = [rehypeKatex, rehypeHighlight]

// A backslash before a bracket is also how Markdown escapes one, as in \[citation needed\], so
// \[ ... \] and \( ... \) only count as LaTeX when what is inside reads as maths: a command, an
// operator or grouping character, or a lone variable.
const looksLikeMath = (content: string) => /\\[a-zA-Z]+|[\^_=<>+*/{}|]/.test(content) || /^\s*[A-Za-z]{1,2}\s*$/.test(content)

// Models often write LaTeX as \( ... \) and \[ ... \], which remark-math does not read, and put
// display equations on one line as $$ ... $$, which it would set inline. Rewrite those to the
// forms remark-math expects, leaving code spans and fences untouched.
function normalizeMath(source: string) {
  if (!source.includes('\\(') && !source.includes('\\[') && !source.includes('$$')) return source
  return source.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/).map((segment, index) => index % 2 ? segment : segment
    .replace(/^([ \t]*)\$\$(.+?)\$\$[ \t]*$/gm, (_, indent: string, math: string) => `${indent}$$\n${indent}${math.trim()}\n${indent}$$`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (match, math: string) => looksLikeMath(math) ? `\n$$\n${math.trim()}\n$$\n` : match)
    .replace(/\\\(([\s\S]+?)\\\)/g, (match, math: string) => looksLikeMath(math) ? `$${math.trim()}$` : match)).join('')
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
