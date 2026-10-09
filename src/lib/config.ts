import fileConfig from '../../chat.config.json'

export type UploadConfig = {
  enabled: boolean
  maxFiles: number
  maxFileSizeMb: number
  /** Comma-separated MIME types, wildcards (image/*) and extensions (.csv). Empty allows anything. */
  accept: string
}

/** Any CSS colour (#1a73e8, rgb(...), oklch(...)). Empty keeps the built-in colour; text colours adapt for contrast. */
export type ThemeColors = {
  /** Main page background. */
  background: string
  sidebarBackground: string
  /** Buttons and the built-in logo mark. */
  buttonColor: string
  /** The user's message bubble. Empty follows buttonColor. */
  chatBubbleColor: string
}

export type ThemeConfig = {
  /** "system" follows the visitor's device; "light" and "dark" force one. */
  mode: 'system' | 'light' | 'dark'
  /** CSS font-family, e.g. "Inter, sans-serif". Empty uses the system font. */
  font: string
  /** Optional stylesheet that loads the font, e.g. a Google Fonts URL. */
  fontUrl: string
  /** Any CSS length, e.g. "4px" or "9999px" for pills. Empty keeps the default. */
  buttonRadius: string
  /** Colours of code blocks: "auto" follows the page's light or dark mode; "light" and "dark" pin one. */
  codeTheme: 'auto' | 'light' | 'dark'
  /** Widest the conversation column gets, as a CSS length: "48rem" for a narrow column, "100%" to fill the window. Empty scales with the screen. */
  chatWidth: string
  /** Colours used in light mode. */
  light: ThemeColors
  /** Colours used in dark mode. */
  dark: ThemeColors
}

/** Size of chat text in pixels. The slider changes only message and input text, not the rest of the interface. */
export type FontSizeConfig = {
  default: number
  /** Shows a text-size slider at the bottom of the sidebar. */
  adjustable: boolean
  /** Range of the slider. */
  min: number
  max: number
}

export type ChatConfig = {
  appName: string
  appDescription: string
  /** Path under /public or an absolute URL. Empty falls back to the built-in mark. */
  logoUrl: string
  /** Optional logo used when the browser is in dark mode. */
  logoDarkUrl: string
  faviconUrl: string
  welcomeTitle: string
  /** Shown on an empty chat. Supports Markdown. */
  welcomeMessage: string
  suggestions: string[]
  inputPlaceholder: string
  footerText: string
  /** Small print under the message box. */
  disclaimer: string
  uploads: UploadConfig
  fontSize: FontSizeConfig
  theme: ThemeConfig
}

const defaults: ChatConfig = {
  appName: 'Orbit',
  appDescription: 'A focused chat workspace powered by a Google ADK agent.',
  logoUrl: '',
  logoDarkUrl: '',
  faviconUrl: '',
  welcomeTitle: 'How can I help today?',
  welcomeMessage: "I'm your ADK assistant. Ask me anything, or attach a file and I'll take a look.",
  suggestions: ['Explain a concept', 'Review some code', 'Help me plan a project'],
  inputPlaceholder: 'Message your ADK agent...',
  footerText: 'Powered by a Google ADK agent',
  disclaimer: '',
  uploads: {
    enabled: true,
    maxFiles: 5,
    maxFileSizeMb: 10,
    accept: 'image/*,application/pdf,text/*,audio/*,video/*,.txt,.md,.csv,.json',
  },
  fontSize: { default: 15, adjustable: true, min: 12, max: 24 },
  theme: {
    mode: 'system',
    font: '',
    fontUrl: '',
    buttonRadius: '',
    codeTheme: 'auto',
    chatWidth: '',
    light: { background: '', sidebarBackground: '', buttonColor: '', chatBubbleColor: '' },
    dark: { background: '', sidebarBackground: '', buttonColor: '', chatBubbleColor: '' },
  },
}

type ThemeFile = Partial<Omit<ThemeConfig, 'light' | 'dark'>> & { light?: Partial<ThemeColors>; dark?: Partial<ThemeColors> }
const file = fileConfig as Partial<Omit<ChatConfig, 'uploads' | 'fontSize' | 'theme'>> & { uploads?: Partial<UploadConfig>; fontSize?: Partial<FontSizeConfig>; theme?: ThemeFile }

const defined = <T extends object>(values: T) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>

/** Defaults, overridden by chat.config.json. */
export const config: ChatConfig = {
  ...defaults,
  ...defined(file),
  uploads: { ...defaults.uploads, ...defined(file.uploads ?? {}) },
  fontSize: { ...defaults.fontSize, ...defined(file.fontSize ?? {}) },
  theme: {
    ...defaults.theme,
    ...defined(file.theme ?? {}),
    light: { ...defaults.theme.light, ...defined(file.theme?.light ?? {}) },
    dark: { ...defaults.theme.dark, ...defined(file.theme?.dark ?? {}) },
  },
}
