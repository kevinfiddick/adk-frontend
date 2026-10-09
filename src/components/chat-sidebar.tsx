'use client'

import { useEffect, useRef, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FontSizeControl } from '@/components/font-size-control'
import { Logo } from '@/components/logo'
import type { SessionSummary } from '@/lib/adk'
import { config } from '@/lib/config'

const DAY = 24 * 60 * 60 * 1000

function groupByAge(sessions: SessionSummary[]) {
  const midnight = new Date().setHours(0, 0, 0, 0)
  const groups = [
    { label: 'Today', items: [] as SessionSummary[] },
    { label: 'Yesterday', items: [] as SessionSummary[] },
    { label: 'Previous 7 days', items: [] as SessionSummary[] },
    { label: 'Older', items: [] as SessionSummary[] },
  ]
  for (const session of sessions) {
    const index = session.updatedAt >= midnight ? 0 : session.updatedAt >= midnight - DAY ? 1 : session.updatedAt >= midnight - 7 * DAY ? 2 : 3
    groups[index].items.push(session)
  }
  return groups.filter((group) => group.items.length)
}

type Props = {
  /** Slid in over the chat on small screens. */
  open: boolean
  /** Reduced to an icon rail on large screens; hovering it shows the full sidebar over the chat. */
  collapsed: boolean
  sessions: SessionSummary[]
  titles: Record<string, string>
  activeId?: string
  onClose: () => void
  onToggleCollapsed: () => void
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export function ChatSidebar({ open, collapsed, sessions, titles, activeId, onClose, onToggleCollapsed, onNew, onSelect, onDelete }: Props) {
  const [peeking, setPeeking] = useState(false)
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A short delay keeps the rail from flying open when the pointer only crosses it.
  function peek(show: boolean) {
    if (peekTimer.current) clearTimeout(peekTimer.current)
    if (show) peekTimer.current = setTimeout(() => setPeeking(true), 120)
    else setPeeking(false)
  }
  useEffect(() => () => { if (peekTimer.current) clearTimeout(peekTimer.current) }, [])

  // Only large screens have the rail, so everything it hides is behind an lg: class.
  const rail = collapsed && !peeking
  const railHidden = `transition-[opacity,visibility] duration-200 ${rail ? 'lg:invisible lg:opacity-0' : ''}`

  return <>
    {/* This box holds the sidebar's place in the layout; the sidebar itself can open wider than it. */}
    <div className={`shrink-0 lg:relative lg:transition-[width] lg:duration-200 ${collapsed ? 'lg:w-14' : 'lg:w-[272px]'}`}>
      <aside onMouseEnter={() => peek(true)} onMouseLeave={() => peek(false)} onFocus={() => setPeeking(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) peek(false) }}
        className={`sidebar-surface fixed inset-y-0 left-0 z-20 w-[272px] overflow-clip border-r border-sidebar-border bg-sidebar transition-[translate,width,box-shadow] duration-200 lg:absolute lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} ${rail ? 'lg:w-14' : ''} ${collapsed && peeking ? 'lg:shadow-2xl' : ''}`}>
        {/* Laid out at full width and clipped by the rail, so nothing reflows while the width animates. */}
        <div className="flex h-full w-[271px] flex-col p-2">
          <div className="flex items-center gap-1">
            <div className="grid size-10 shrink-0 place-items-center"><Logo /></div>
            <span data-testid="app-name" title={config.appName} className={`line-clamp-2 min-w-0 flex-1 text-[15px] leading-5 font-semibold tracking-tight break-words ${railHidden}`}>{config.appName}</span>
            <Button variant="ghost" size="icon-lg" className="lg:hidden" onClick={onClose} aria-label="Close sidebar"><X /></Button>
            <span className="hidden lg:inline-flex"><Button variant="ghost" size="icon-lg" onClick={() => { onToggleCollapsed(); setPeeking(false) }} aria-label={collapsed ? 'Keep sidebar open' : 'Collapse sidebar'} title={collapsed ? 'Keep sidebar open' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button></span>
          </div>
          <Button size="none" className={`mt-4 h-10 justify-start gap-3 overflow-hidden rounded-lg pl-3 ${rail ? 'w-full lg:w-10' : 'w-full'}`} onClick={onNew} aria-label="New chat" title="New chat"><Plus />New chat</Button>
          <nav className={`mt-6 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto ${railHidden}`} aria-label="Chats">
            {sessions.length === 0 && <p className="px-2 text-sm text-muted-foreground">Your chats will appear here.</p>}
            {groupByAge(sessions).map((group) => <div key={group.label} className="flex flex-col gap-1">
              <p data-testid="chat-group" className="px-2 pb-1 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">{group.label}</p>
              {group.items.map((session) => <div key={session.id} className={`group flex items-center rounded-lg text-sm transition-colors ${session.id === activeId ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'}`}>
                <button data-testid="chat-link" className="min-w-0 flex-1 truncate py-2 pr-1 pl-3 text-left" onClick={() => onSelect(session.id)} aria-current={session.id === activeId ? 'page' : undefined}>{titles[session.id] || 'Untitled chat'}</button>
                <button data-testid="chat-delete" className="mr-1 grid size-7 shrink-0 place-items-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 [@media(hover:none)]:opacity-100" onClick={() => onDelete(session.id)} aria-label={`Delete ${titles[session.id] || 'chat'}`} title="Delete chat"><Trash2 className="size-3.5" /></button>
              </div>)}
            </div>)}
          </nav>
          {config.fontSize.adjustable && <FontSizeControl className={`pt-4 pb-2 ${railHidden}`} />}
          {config.footerText && <div className={`px-2 pt-2 pb-2 text-xs leading-5 text-muted-foreground ${railHidden}`}>{config.footerText}</div>}
        </div>
      </aside>
    </div>
    {open && <button className="fixed inset-0 z-10 bg-black/20 lg:hidden" onClick={onClose} aria-label="Close navigation" />}
  </>
}
