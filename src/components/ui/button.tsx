import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const base =
  "inline-flex shrink-0 items-center border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

const variants = {
  default: 'bg-primary text-primary-foreground',
  ghost: 'hover:bg-muted hover:text-foreground',
}

// "none" leaves height, padding, alignment and corner radius to the caller's className.
const sizes = {
  default: 'h-8 justify-center gap-1.5 rounded-lg px-2.5',
  icon: 'size-8 justify-center rounded-lg',
  'icon-lg': 'size-9 justify-center rounded-lg',
  'icon-sm': 'size-7 justify-center rounded-[min(var(--radius-md),12px)]',
  'icon-xs': 'size-6 justify-center rounded-[min(var(--radius-md),10px)]',
  none: '',
}

type Props = ComponentProps<'button'> & { variant?: keyof typeof variants; size?: keyof typeof sizes }

/** `data-slot="button"` is what the theme's buttonRadius setting targets. */
function Button({ className, variant = 'default', size = 'default', type = 'button', ...props }: Props) {
  return <button data-slot="button" type={type} className={cn(base, variants[variant], sizes[size], className)} {...props} />
}

export { Button }
