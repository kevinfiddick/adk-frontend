'use client'

import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Menu, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatComposer, type ComposerHandle } from '@/components/chat-composer'
import { ChatMessage } from '@/components/chat-message'
import { ChatSidebar } from '@/components/chat-sidebar'
import { Logo } from '@/components/logo'
import { Markdown } from '@/components/markdown'
import { eventsToMessages, titleFrom, type AdkSession, type Attachment, type Message, type SessionSummary } from '@/lib/adk'
import { config } from '@/lib/config'

const USER_KEY = 'adk-user-id'
const SESSION_KEY = 'adk-session-id'
const COLLAPSED_KEY = 'adk-sidebar-collapsed'
const TITLES_KEY = 'adk-session-titles'

type StreamEvent = { text?: string; status?: string; files?: Attachment[]; error?: string; debug?: { label: string; data: unknown } }

async function api<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status}).`)
  return data as T
}
const sessionPath = (userId: string, sessionId?: string) => `/api/sessions${sessionId ? `/${encodeURIComponent(sessionId)}` : ''}?userId=${encodeURIComponent(userId)}`
const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files')

export function ChatShell() {
  const [userId, setUserId] = useState<string>()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  // ADK sessions have no name, so titles are remembered in this browser.
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [sessionId, setSessionId] = useState<string>()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  // The sidebar is an overlay on small screens (sidebarOpen) and a column that collapses to an icon rail on large ones.
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const streamRef = useRef<AbortController | null>(null)
  const viewRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const composerRef = useRef<ComposerHandle>(null)

  useEffect(() => {
    let id = localStorage.getItem(USER_KEY)
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(USER_KEY, id) }
    const user = id
    let stored: Record<string, string> = {}
    try { stored = JSON.parse(localStorage.getItem(TITLES_KEY) || '{}') } catch { /* start with no titles */ }
    setUserId(user); setTitles(stored); setSidebarCollapsed(localStorage.getItem(COLLAPSED_KEY) === 'true')
    let cancelled = false
    api<SessionSummary[]>(sessionPath(user)).then(async (list) => {
      if (cancelled) return
      setSessions(list)
      const previous = localStorage.getItem(SESSION_KEY)
      if (previous && list.some((session) => session.id === previous)) void openSession(previous, user)
      // Sessions started elsewhere (another browser, adk web) have no stored title; read it from their first message.
      for (const session of list.filter((item) => !stored[item.id]).slice(0, 20)) {
        const detail = await api<AdkSession>(sessionPath(user, session.id)).catch(() => null)
        if (cancelled) return
        const first = eventsToMessages(detail?.events).find((message) => message.role === 'user')
        const title = first && titleFrom(first.content, first.attachments)
        if (title) setTitles((current) => current[session.id] ? current : { ...current, [session.id]: title })
      }
    }).catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load your chats.') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => { if (userId) localStorage.setItem(TITLES_KEY, JSON.stringify(titles)) }, [titles, userId])

  useEffect(() => {
    const view = scrollRef.current
    if (view && pinnedRef.current) view.scrollTop = view.scrollHeight
  }, [messages, status, error])

  function toggleSidebarCollapsed() {
    localStorage.setItem(COLLAPSED_KEY, String(!sidebarCollapsed)); setSidebarCollapsed(!sidebarCollapsed)
  }

  function stopStreaming() {
    streamRef.current?.abort(); streamRef.current = null
    setIsStreaming(false); setStatus('')
  }

  function newChat() {
    stopStreaming(); viewRef.current++
    localStorage.removeItem(SESSION_KEY)
    setSessionId(undefined); setMessages([]); setError(''); setIsLoading(false); setSidebarOpen(false)
  }

  async function openSession(id: string, user = userId) {
    if (!user) return
    stopStreaming()
    const view = ++viewRef.current
    localStorage.setItem(SESSION_KEY, id); pinnedRef.current = true
    setSessionId(id); setMessages([]); setError(''); setIsLoading(true); setSidebarOpen(false)
    try {
      const session = await api<AdkSession>(sessionPath(user, id))
      if (view === viewRef.current) setMessages(eventsToMessages(session.events))
    } catch (caught) {
      if (view === viewRef.current) setError(caught instanceof Error ? caught.message : 'This chat could not be loaded.')
    } finally {
      if (view === viewRef.current) setIsLoading(false)
    }
  }

  async function deleteSession(id: string) {
    if (!userId || !window.confirm(`Delete "${titles[id] || 'Untitled chat'}"? This cannot be undone.`)) return
    try {
      await api(sessionPath(userId, id), { method: 'DELETE' })
      setSessions((current) => current.filter((session) => session.id !== id))
      setTitles(({ [id]: _removed, ...rest }) => rest)
      if (id === sessionId) newChat()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The chat could not be deleted.') }
  }

  async function sendMessage(text: string, files: Attachment[]) {
    if (!userId || isStreaming || isLoading) return
    const controller = new AbortController()
    streamRef.current = controller
    // False once the user stops the response or moves to another chat.
    const isCurrent = () => streamRef.current === controller
    const assistantId = crypto.randomUUID()
    const update = (change: (message: Message) => Message) => setMessages((current) => current.map((item) => item.id === assistantId ? change(item) : item))
    pinnedRef.current = true
    setError(''); setStatus(''); setIsStreaming(true)
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: text, attachments: files }, { id: assistantId, role: 'assistant', content: '' }])
    let activeSession = sessionId
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, userId, files: files.map(({ name, mimeType, data }) => ({ name, mimeType, data })) }),
      })
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => null))?.error || 'The assistant could not respond.')
      const started = response.headers.get('x-adk-session-id')
      if (started && started !== sessionId) {
        activeSession = started
        setSessions((current) => [{ id: started, updatedAt: Date.now() }, ...current.filter((session) => session.id !== started)])
        setTitles((current) => ({ ...current, [started]: titleFrom(text, files) || 'New chat' }))
        if (isCurrent()) { setSessionId(started); localStorage.setItem(SESSION_KEY, started) }
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      while (true) {
        const { value, done } = await reader.read(); if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n'); buffer = chunks.pop() || ''
        for (const chunk of chunks) {
          const data = chunk.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('')
          if (!data || data === '[DONE]') continue
          const parsed = JSON.parse(data) as StreamEvent
          // Temporary upload diagnostics; see the matching note in api/chat/route.ts.
          if (parsed.debug) { console.log(`[adk-debug] ${parsed.debug.label}`, JSON.stringify(parsed.debug.data, null, 2)); continue }
          if (parsed.error) throw new Error(parsed.error)
          if (!isCurrent()) continue
          if (parsed.status) setStatus(parsed.status)
          if (parsed.files?.length) update((item) => ({ ...item, attachments: [...(item.attachments || []), ...parsed.files!] }))
          if (typeof parsed.text === 'string') { setStatus(''); update((item) => ({ ...item, content: parsed.text! })) }
        }
      }
    } catch (caught) {
      if (isCurrent() && !controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Something went wrong.')
    } finally {
      if (activeSession) setSessions((current) => current.map((session) => session.id === activeSession ? { ...session, updatedAt: Date.now() } : session).sort((a, b) => b.updatedAt - a.updatedAt))
      if (isCurrent()) { streamRef.current = null; setIsStreaming(false); setStatus('') }
    }
  }

  function onDrop(event: DragEvent) {
    if (!hasFiles(event)) return
    event.preventDefault(); setIsDragging(false)
    composerRef.current?.addFiles(Array.from(event.dataTransfer.files))
  }

  // An assistant message with nothing in it is only worth showing while its response is on the way.
  const visible = messages.filter((message, index) => message.content || message.attachments?.length || (isStreaming && index === messages.length - 1))
  const isEmpty = !visible.length && !isLoading
  const title = (sessionId && titles[sessionId]) || 'New chat'

  return <main className="flex h-dvh overflow-hidden bg-background text-foreground">
    <ChatSidebar open={sidebarOpen} collapsed={sidebarCollapsed} sessions={sessions} titles={titles} activeId={sessionId} onClose={() => setSidebarOpen(false)} onToggleCollapsed={toggleSidebarCollapsed} onNew={newChat} onSelect={(id) => { if (id === sessionId) setSidebarOpen(false); else void openSession(id) }} onDelete={deleteSession} />
    <section className="relative flex min-w-0 flex-1 flex-col"
      onDragOver={(event) => { if (config.uploads.enabled && hasFiles(event)) { event.preventDefault(); setIsDragging(true) } }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false) }}
      onDrop={(event) => { if (config.uploads.enabled) onDrop(event) }}>
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/70 px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu /></Button><p data-testid="chat-title" className="truncate text-sm font-semibold">{title}</p></div>
        <div data-testid="chat-status" className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><span className={`size-1.5 rounded-full ${isStreaming ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'}`} />{isStreaming ? 'Responding' : 'Ready'}</div>
      </header>
      <div ref={scrollRef} data-testid="chat-scroll" className="flex-1 overflow-y-auto" onScroll={(event) => { const view = event.currentTarget; pinnedRef.current = view.scrollHeight - view.scrollTop - view.clientHeight < 120 }}>
        <div className="mx-auto flex min-h-full w-full max-w-(--chat-width) flex-col gap-8 px-4 py-8 sm:px-8 sm:py-10">
          {isLoading && <p className="m-auto animate-pulse text-sm text-muted-foreground">Loading chat...</p>}
          {isEmpty && <div className="m-auto flex w-full max-w-3xl flex-col items-center gap-4 py-8 text-center">
            <Logo className="size-14 rounded-2xl" />
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{config.welcomeTitle}</h1>
            {config.welcomeMessage && <div className="max-w-xl text-[length:var(--chat-font-size)] leading-[1.85] text-muted-foreground"><Markdown content={config.welcomeMessage} /></div>}
            {config.suggestions.length > 0 && <div className="mt-4 grid w-full gap-2 sm:grid-cols-3">{config.suggestions.map((suggestion) => <button key={suggestion} data-testid="suggestion" disabled={!userId} onClick={() => void sendMessage(suggestion, [])} className="rounded-xl border border-border bg-card px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{suggestion}</button>)}</div>}
          </div>}
          {visible.map((message, index) => <ChatMessage key={message.id} message={message} pending={isStreaming && index === visible.length - 1 && message.role === 'assistant'} status={isStreaming && index === visible.length - 1 ? status : ''} />)}
          {error && <div role="alert" data-testid="chat-error" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
        </div>
      </div>
      <div className="mx-auto w-full max-w-(--chat-width) shrink-0 px-4 pb-4 sm:px-8">
        <ChatComposer ref={composerRef} disabled={!userId || isLoading} isStreaming={isStreaming} onSend={sendMessage} onStop={stopStreaming} />
        {config.disclaimer && <p className="pt-2 text-center text-xs text-muted-foreground">{config.disclaimer}</p>}
      </div>
      {isDragging && <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-background/80 backdrop-blur-sm"><div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border px-10 py-8 text-sm text-muted-foreground"><Upload className="size-6" />Drop files to attach them</div></div>}
    </section>
  </main>
}

export default ChatShell
