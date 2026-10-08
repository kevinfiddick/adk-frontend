'use client'

import { useEffect, useState } from 'react'
import { config } from '@/lib/config'

const FONT_SIZE_KEY = 'adk-font-size'
const min = Math.min(config.fontSize.min, config.fontSize.max)
const max = Math.max(config.fontSize.min, config.fontSize.max)
const clamp = (size: number) => Math.min(max, Math.max(min, Math.round(size)))

/** Slider for the size of chat text. The rest of the interface keeps its size, so larger text gets the room it needs. */
export function FontSizeControl({ className }: { className?: string }) {
  const [size, setSize] = useState(clamp(config.fontSize.default))

  useEffect(() => {
    const stored = Number(localStorage.getItem(FONT_SIZE_KEY))
    if (stored) apply(clamp(stored))
  }, [])

  function apply(next: number) {
    setSize(next)
    document.documentElement.style.setProperty('--chat-font-size', `${next}px`)
  }
  function change(next: number) {
    apply(next)
    localStorage.setItem(FONT_SIZE_KEY, String(next))
  }

  return <label className={`flex flex-col gap-1.5 px-2 text-xs text-muted-foreground ${className ?? ''}`}>
    <span className="flex items-center justify-between"><span>Text size</span><span className="tabular-nums">{size}px</span></span>
    <span className="flex items-center gap-2 text-sidebar-foreground">
      <span aria-hidden className="text-xs">A</span>
      <input type="range" min={min} max={max} step={1} value={size} onChange={(event) => change(Number(event.target.value))} aria-label="Text size" className="h-1 min-w-0 flex-1 cursor-pointer accent-primary" />
      <span aria-hidden className="text-lg leading-none">A</span>
    </span>
  </label>
}
