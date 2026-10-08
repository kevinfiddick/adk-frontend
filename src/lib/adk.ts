// Types and helpers shared by the API routes and the browser.

export type Attachment = { name: string; mimeType: string; data?: string; url?: string; size?: number }
export type Message = { id: string; role: 'user' | 'assistant'; content: string; attachments?: Attachment[] }
export type SessionSummary = { id: string; updatedAt: number }

export type AdkPart = {
  text?: string
  thought?: boolean
  inlineData?: { mimeType?: string; data?: string; displayName?: string }
  fileData?: { mimeType?: string; fileUri?: string; displayName?: string }
  functionCall?: { name?: string }
  functionResponse?: { name?: string }
}
export type AdkEvent = { id?: string; author?: string; partial?: boolean; content?: { role?: string; parts?: AdkPart[] }; errorCode?: string; errorMessage?: string }
export type AdkSession = { id: string; lastUpdateTime?: number; events?: AdkEvent[] }

/** Visible text of an event, leaving out the model's thinking parts. */
export const textOfParts = (parts: AdkPart[] = []) => parts.filter((part) => !part.thought).map((part) => part.text || '').join('')

function fileLabel(mimeType: string) {
  const [kind, subtype = ''] = mimeType.split('/')
  if (kind === 'image') return 'Image'
  return `${(subtype.split(/[.+-]/).pop() || kind || 'file').toUpperCase()} file`
}

export function filesOfParts(parts: AdkPart[] = []): Attachment[] {
  const files: Attachment[] = []
  for (const part of parts) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || 'application/octet-stream'
      // The Python ADK server serialises bytes as URL-safe base64; data: URLs need the standard alphabet.
      const data = part.inlineData.data.replace(/-/g, '+').replace(/_/g, '/')
      files.push({ name: part.inlineData.displayName || fileLabel(mimeType), mimeType, data })
    } else if (part.fileData?.fileUri) {
      const mimeType = part.fileData.mimeType || 'application/octet-stream'
      files.push({ name: part.fileData.displayName || part.fileData.fileUri.split('/').pop() || fileLabel(mimeType), mimeType, url: part.fileData.fileUri })
    }
  }
  return files
}

/** Collapse a session's event log into chat messages; tool calls and partial events are dropped. */
export function eventsToMessages(events: AdkEvent[] = []): Message[] {
  const messages: Message[] = []
  events.forEach((event, index) => {
    if (event.partial) return
    const role = event.content?.role === 'user' ? 'user' : event.content?.role === 'model' ? 'assistant' : null
    if (!role) return
    const content = textOfParts(event.content?.parts)
    const attachments = filesOfParts(event.content?.parts)
    if (!content.trim() && !attachments.length) return
    const previous = messages.at(-1)
    // One agent turn can span several events (text, tool call, more text).
    if (role === 'assistant' && previous?.role === 'assistant') {
      previous.content = [previous.content, content].filter(Boolean).join('\n\n')
      if (attachments.length) previous.attachments = [...(previous.attachments || []), ...attachments]
    } else {
      messages.push({ id: event.id || `event-${index}`, role, content, ...(attachments.length ? { attachments } : {}) })
    }
  })
  return messages
}

export function titleFrom(content: string, attachments: Attachment[] = []) {
  const line = content.trim().split('\n')[0]?.trim() || attachments[0]?.name || ''
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}...` : line
}

export const dataUrl = (file: Attachment) => (file.data ? `data:${file.mimeType};base64,${file.data}` : file.url)
