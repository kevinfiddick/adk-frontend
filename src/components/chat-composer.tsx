'use client'

import { useEffect, useImperativeHandle, useRef, useState, type FormEvent, type Ref } from 'react'
import { ArrowUp, Paperclip, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AttachmentChip } from '@/components/chat-message'
import type { Attachment } from '@/lib/adk'
import { config } from '@/lib/config'

const { uploads } = config

// Browsers report no type, or a misleading one (.csv is often "application/vnd.ms-excel"),
// for plain-text formats, so those are identified by extension instead.
const textTypes: Record<string, string> = { csv: 'text/csv', md: 'text/markdown', markdown: 'text/markdown', html: 'text/html', htm: 'text/html', css: 'text/css', xml: 'text/xml' }
const plainText = new Set(['txt', 'log', 'json', 'jsonl', 'yaml', 'yml', 'toml', 'ini', 'env', 'py', 'js', 'jsx', 'ts', 'tsx', 'java', 'go', 'rs', 'rb', 'php', 'c', 'h', 'cpp', 'cs', 'sh', 'sql', 'tex', 'rst', 'tsv'])
const extensionOf = (name: string) => name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
function mimeTypeOf(file: File) {
  const extension = extensionOf(file.name)
  return textTypes[extension] || (plainText.has(extension) ? 'text/plain' : file.type || 'application/octet-stream')
}
function isAccepted(name: string, mimeType: string) {
  const rules = uploads.accept.split(',').map((rule) => rule.trim().toLowerCase()).filter(Boolean)
  if (!rules.length) return true
  return rules.some((rule) => rule.startsWith('.') ? name.toLowerCase().endsWith(rule) : rule.endsWith('/*') ? mimeType.startsWith(rule.slice(0, -1)) : mimeType === rule)
}
const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

export type ComposerHandle = { addFiles: (files: File[]) => void }
type Props = { ref?: Ref<ComposerHandle>; disabled: boolean; isStreaming: boolean; onSend: (text: string, files: Attachment[]) => void; onStop: () => void }

export function ChatComposer({ ref, disabled, isStreaming, onSend, onStop }: Props) {
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<Attachment[]>([])
  const [notice, setNotice] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)

  function fitHeight() {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }
  useEffect(fitHeight, [input])
  // The text-size slider sets a style on <html>; refit when it changes.
  useEffect(() => {
    const observer = new MutationObserver(fitHeight)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])

  async function addFiles(incoming: File[]) {
    if (!uploads.enabled || !incoming.length) return
    const problems: string[] = []
    const accepted: Attachment[] = []
    for (const file of incoming) {
      const mimeType = mimeTypeOf(file)
      if (files.length + accepted.length >= uploads.maxFiles) { problems.push(`You can attach up to ${uploads.maxFiles} files per message.`); break }
      if (!isAccepted(file.name, mimeType)) { problems.push(`${file.name}: this file type is not supported.`); continue }
      if (!file.size) { problems.push(`${file.name} is empty.`); continue }
      if (file.size > uploads.maxFileSizeMb * 1024 * 1024) { problems.push(`${file.name} is larger than ${uploads.maxFileSizeMb} MB.`); continue }
      try { accepted.push({ name: file.name, mimeType, size: file.size, data: await toBase64(file) }) } catch { problems.push(`${file.name} could not be read.`) }
    }
    if (accepted.length) setFiles((current) => [...current, ...accepted].slice(0, uploads.maxFiles))
    setNotice(problems.join(' '))
    textareaRef.current?.focus()
  }
  useImperativeHandle(ref, () => ({ addFiles }))

  const canSend = !disabled && !isStreaming && (!!input.trim() || files.length > 0)
  function submit(event?: FormEvent) {
    event?.preventDefault()
    if (!canSend) return
    onSend(input.trim(), files)
    setInput(''); setFiles([]); setNotice('')
  }

  return <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-2 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.35)] focus-within:border-ring">
    {files.length > 0 && <div className="flex flex-wrap gap-2 px-2 pt-2 pb-1">{files.map((file, index) => <AttachmentChip key={index} file={file} onRemove={() => setFiles((current) => current.filter((_, position) => position !== index))} />)}</div>}
    <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); submit() } }}
      onPaste={(e) => { const pasted = Array.from(e.clipboardData.files); if (pasted.length && uploads.enabled) { e.preventDefault(); void addFiles(pasted) } }}
      placeholder={config.inputPlaceholder} rows={1} className="max-h-48 min-h-12 w-full resize-none bg-transparent [field-sizing:content] px-3 py-3 text-[length:calc(var(--chat-font-size)*14/15)] outline-none placeholder:text-muted-foreground" aria-label="Message" />
    {notice && <p role="alert" className="px-3 pb-2 text-xs text-destructive">{notice}</p>}
    <div className="flex items-center justify-between gap-2 px-1 pb-1">
      <div className="flex min-w-0 items-center gap-2">
        {uploads.enabled && <>
          <input ref={pickerRef} type="file" multiple={uploads.maxFiles > 1} accept={uploads.accept || undefined} className="hidden" onChange={(e) => { void addFiles(Array.from(e.target.files || [])); e.target.value = '' }} />
          <Button type="button" variant="ghost" size="icon" className="text-muted-foreground" onClick={() => pickerRef.current?.click()} aria-label="Attach files" title="Attach files"><Paperclip /></Button>
        </>}
        <span className="hidden truncate text-xs text-muted-foreground sm:inline">Enter to send · Shift + Enter for newline</span>
      </div>
      {isStreaming
        ? <Button type="button" size="icon" onClick={onStop} aria-label="Stop responding" title="Stop responding"><Square className="size-3 fill-current" /></Button>
        : <Button type="submit" size="icon" disabled={!canSend} aria-label="Send message"><ArrowUp /></Button>}
    </div>
  </form>
}
