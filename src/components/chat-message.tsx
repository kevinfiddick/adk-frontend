'use client'

import { memo, useState } from 'react'
import { Check, Copy, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { Markdown, copyText } from '@/components/markdown'
import { dataUrl, type Attachment, type Message } from '@/lib/adk'

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AttachmentChip({ file, onRemove }: { file: Attachment; onRemove?: () => void }) {
  const source = dataUrl(file)
  const isImage = file.mimeType.startsWith('image/') && !!file.data
  return <div className="relative flex max-w-60 items-center gap-2 rounded-xl border border-border bg-card p-1.5 pr-3 text-left text-xs text-card-foreground">
    {isImage ? <img src={source} alt="" className="size-9 shrink-0 rounded-lg object-cover" /> : <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><FileText className="size-4" /></span>}
    <span className="min-w-0">
      {source?.startsWith('http') ? <a href={source} target="_blank" rel="noreferrer" className="block truncate font-medium underline underline-offset-2">{file.name}</a> : <span className="block truncate font-medium">{file.name}</span>}
      <span className="block truncate text-muted-foreground">{file.size ? formatSize(file.size) : file.mimeType}</span>
    </span>
    {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`} className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"><X className="size-3" /></button>}
  </div>
}

function Attachments({ files, align }: { files: Attachment[]; align: 'start' | 'end' }) {
  const images = files.filter((file) => file.mimeType.startsWith('image/') && file.data)
  const others = files.filter((file) => !images.includes(file))
  return <div className={`flex flex-col gap-2 ${align === 'end' ? 'items-end' : 'items-start'}`}>
    {images.length > 0 && <div className={`flex flex-wrap gap-2 ${align === 'end' ? 'justify-end' : ''}`}>{images.map((file, index) => <img key={index} src={dataUrl(file)} alt={file.name} className="max-h-64 max-w-full rounded-xl border border-border object-contain" />)}</div>}
    {others.length > 0 && <div className={`flex flex-wrap gap-2 ${align === 'end' ? 'justify-end' : ''}`}>{others.map((file, index) => <AttachmentChip key={index} file={file} />)}</div>}
  </div>
}

/** `pending` marks the assistant message that is still streaming; `status` is its current tool activity. */
export const ChatMessage = memo(function ChatMessage({ message, pending, status }: { message: Message; pending?: boolean; status?: string }) {
  const [copied, setCopied] = useState(false)
  const files = message.attachments || []
  async function copy() {
    if (!(await copyText(message.content))) return
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  if (message.role === 'user') return <article data-testid="user-message" className="flex flex-col items-end gap-2">
    {files.length > 0 && <Attachments files={files} align="end" />}
    {message.content && <div data-testid="user-bubble" className="max-w-[min(680px,90%)] rounded-2xl rounded-tr-md bg-bubble px-4 py-2.5 text-[length:var(--chat-font-size)] leading-[1.85] break-words whitespace-pre-wrap text-bubble-foreground">{message.content}</div>}
  </article>

  return <article data-testid="assistant-message" className="flex gap-3">
    <Logo className="mt-0.5 size-8 rounded-full" />
    <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1 text-[length:var(--chat-font-size)] leading-[1.85]">
      {message.content && <Markdown content={message.content} />}
      {files.length > 0 && <Attachments files={files} align="start" />}
      {pending && (!message.content || status) && <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="animate-pulse">{status || 'Thinking'}</span><span className="flex gap-1"><i className="size-1 rounded-full bg-current" /><i className="size-1 rounded-full bg-current" /><i className="size-1 rounded-full bg-current" /></span></div>}
      {!pending && message.content && <div><Button variant="ghost" size="icon-xs" className="cursor-pointer text-muted-foreground" onClick={copy} aria-label="Copy response" title="Copy response">{copied ? <Check className="size-3" /> : <Copy className="size-3" />}</Button></div>}
    </div>
  </article>
})
