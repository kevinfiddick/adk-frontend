import { Sparkles } from 'lucide-react'
import { config } from '@/lib/config'

/** The configured logo image, or the built-in mark when none is set. `className` sets its size and corner radius. */
export function Logo({ className = 'size-7 rounded-lg' }: { className?: string }) {
  const { mode } = config.theme
  if (!config.logoUrl) return <span className={`grid shrink-0 place-items-center bg-primary text-primary-foreground ${className}`}><Sparkles className="size-[55%]" /></span>
  return <picture className="contents">
    {config.logoDarkUrl && mode === 'system' && <source srcSet={config.logoDarkUrl} media="(prefers-color-scheme: dark)" />}
    <img src={(mode === 'dark' && config.logoDarkUrl) || config.logoUrl} alt="" className={`shrink-0 object-contain ${className}`} />
  </picture>
}
