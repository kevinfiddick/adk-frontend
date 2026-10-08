import type { Metadata, Viewport } from 'next'
import { config } from '@/lib/config'
import { themeCss } from '@/lib/theme'
import './globals.css'

// Browsers are stricter about SVG icons when the tag does not say what the file is.
const faviconTypes: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
const faviconUrl = config.faviconUrl || '/favicon.svg'
const faviconType = faviconTypes[faviconUrl.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '']

export const metadata: Metadata = {
  title: config.appName,
  description: config.appDescription,
  icons: { icon: [{ url: faviconUrl, type: faviconType, sizes: faviconType === 'image/svg+xml' ? 'any' : undefined }] },
}

const { mode } = config.theme
const css = themeCss(config.theme)

export const viewport: Viewport = {
  colorScheme: mode === 'system' ? 'light dark' : mode,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={mode === 'system' ? undefined : mode} style={{ '--chat-font-size': `${config.fontSize.default}px` } as React.CSSProperties} suppressHydrationWarning>
      {/* Browser extensions add attributes to <body> before React loads. */}
      <body className="antialiased" suppressHydrationWarning>
        {config.theme.fontUrl && <link rel="stylesheet" href={config.theme.fontUrl} />}
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        {children}
      </body>
    </html>
  )
}
