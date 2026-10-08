import type { ThemeColors, ThemeConfig } from '@/lib/config'

// Config values are written into a <style> tag, so keep them from closing a rule or the tag.
const clean = (value: string) => value.replace(/[<>{};]/g, '').trim()
// Black or white, whichever reads better on the given colour variable.
const readable = (name: string) => `oklch(from var(${name}) clamp(0, (0.62 - l) * 1000, 1) 0 0)`
const mix = (base: string, share: number, other: string) => `color-mix(in oklab, var(${base}) ${share}%, var(${other}))`

/** CSS variable overrides for one colour mode. Text, border and hover colours are derived from the configured ones. */
function colorVars(colors: ThemeColors) {
  const background = clean(colors.background)
  const sidebar = clean(colors.sidebarBackground)
  const button = clean(colors.buttonColor)
  const bubble = clean(colors.chatBubbleColor)
  const vars: string[] = []
  if (background) {
    const subtle = mix('--background', 93, '--foreground')
    const line = mix('--background', 87, '--foreground')
    vars.push(
      `--background:${background}`, `--foreground:${readable('--background')}`,
      `--card:${mix('--background', 96, '--foreground')}`, '--card-foreground:var(--foreground)',
      '--popover:var(--card)', '--popover-foreground:var(--foreground)',
      `--muted:${subtle}`, `--muted-foreground:${mix('--foreground', 60, '--background')}`,
      `--secondary:${subtle}`, '--secondary-foreground:var(--foreground)',
      `--accent:${subtle}`, '--accent-foreground:var(--foreground)',
      `--border:${line}`, `--input:${line}`,
    )
    // Without their own colour, buttons and the sidebar follow the new background instead of the stock greys.
    if (!button) vars.push('--primary:var(--foreground)', '--primary-foreground:var(--background)')
  }
  if (background || sidebar) vars.push(
    `--sidebar:${sidebar || mix('--background', 97, '--foreground')}`, `--sidebar-foreground:${readable('--sidebar')}`,
    `--sidebar-accent:${mix('--sidebar', 90, '--sidebar-foreground')}`, '--sidebar-accent-foreground:var(--sidebar-foreground)',
    `--sidebar-border:${mix('--sidebar', 87, '--sidebar-foreground')}`,
  )
  if (button) vars.push(`--primary:${button}`, `--primary-foreground:${readable('--primary')}`, '--sidebar-primary:var(--primary)', '--sidebar-primary-foreground:var(--primary-foreground)')
  if (bubble) vars.push(`--bubble:${bubble}`, `--bubble-foreground:${readable('--bubble')}`)
  return vars.join(';')
}

const genericFonts = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'inherit'])
// Family names are quoted because an unquoted one with a number in it ("Source Serif 4") is invalid CSS.
const fontFamily = (value: string) => clean(value).split(',').map((name) => name.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  .map((name) => (genericFonts.has(name.toLowerCase()) ? name : `"${name}"`)).join(', ')

/** Stylesheet for the theme section of chat.config.json; empty when nothing is customised. */
export function themeCss(theme: ThemeConfig) {
  // Repeated :root outranks the stock palettes in globals.css whatever order the stylesheets load in.
  const root = ':root:root:root'
  const light = colorVars(theme.light)
  const dark = colorVars(theme.dark)
  const font = fontFamily(theme.font)
  const radius = clean(theme.buttonRadius)
  const rules: string[] = []
  if (theme.mode === 'system') {
    if (light) rules.push(`@media (prefers-color-scheme: light){${root}{${light}}}`)
    if (dark) rules.push(`@media (prefers-color-scheme: dark){${root}{${dark}}}`)
  } else {
    const forced = theme.mode === 'dark' ? dark : light
    if (forced) rules.push(`${root}{${forced}}`)
  }
  if (font) rules.push(`html{font-family:${font}}`)
  if (radius) rules.push(`[data-slot="button"]{border-radius:${radius}}`)
  return rules.join('\n')
}
