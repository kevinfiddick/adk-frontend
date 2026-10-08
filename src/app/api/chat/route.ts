import { NextResponse } from 'next/server'
import { filesOfParts, textOfParts, type AdkEvent, type AdkPart } from '@/lib/adk'
import { app, base, configError, fail, mock, mockSessions, sessionUrl, validUserId } from '@/lib/adk-server'
import { config } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()
const encode = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

type Upload = { name?: string; mimeType?: string; data?: string }

function parseEvent(raw: string): AdkEvent | null {
  try { return JSON.parse(raw) as AdkEvent } catch { return null }
}
function splitSse(buffer: string) {
  const blocks = buffer.split(/\r?\n\r?\n/)
  return { blocks: blocks.slice(0, -1), remainder: blocks.at(-1) || '' }
}
function eventData(block: string) {
  return block.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
}
function uploadError(files: Upload[]) {
  if (!files.length) return null
  const { enabled, maxFiles, maxFileSizeMb } = config.uploads
  if (!enabled) return 'File uploads are disabled.'
  if (files.length > maxFiles) return `Attach at most ${maxFiles} files per message.`
  for (const file of files) {
    if (!file.data || !file.mimeType) return 'An attachment could not be read.'
    if (file.data.length * 0.75 > maxFileSizeMb * 1024 * 1024) return `${file.name || 'A file'} is larger than ${maxFileSizeMb} MB.`
  }
  return null
}
function mockStream(userId: string, sessionId: string, parts: AdkPart[], message: string, files: Upload[]) {
  const attached = files.length ? `\n\nAttachments: ${files.map((file) => `\`${file.name || file.mimeType}\``).join(', ')}` : ''
  const response = `I received: **${message || 'your files'}**${attached}\n\nHere is a sample equation: $$a^2 + b^2 = c^2$$.\n\n- Markdown lists\n- Tables and code blocks\n- LaTeX: $\\rightarrow$\n\n\`\`\`ts\nconst greeting: string = 'hello'\n\`\`\``;
  const sessions = mockSessions(userId)
  const session = sessions.get(sessionId) || { id: sessionId, events: [] }
  session.events = [...(session.events || []), { id: crypto.randomUUID(), content: { role: 'user', parts } }, { id: crypto.randomUUID(), content: { role: 'model', parts: [{ text: response }] } }]
  session.lastUpdateTime = Date.now() / 1000
  sessions.set(sessionId, session)
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let result = ''
      try {
        for (const chunk of response.match(/.{1,12}/gs) || []) {
          result += chunk
          controller.enqueue(encode({ text: result }))
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
        controller.enqueue(encode({ done: true }))
        controller.close()
      } catch { /* the client stopped the response */ }
    },
  })
}
const headers = (sessionId: string) => ({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'x-adk-session-id': sessionId })

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { message?: string; sessionId?: string; userId?: string; files?: Upload[] } | null
  const message = body?.message?.trim() || ''
  const files = Array.isArray(body?.files) ? body.files : []
  const userId = body?.userId
  if ((!message && !files.length) || !validUserId(userId)) return fail('A message and valid user ID are required.', 400)
  const invalidUpload = uploadError(files)
  if (invalidUpload) return fail(invalidUpload, 400)
  const invalid = configError()
  if (invalid) return invalid
  // Files go first so the model reads them before the question about them.
  const parts: AdkPart[] = [...files.map((file) => ({ inlineData: { mimeType: file.mimeType, data: file.data } })), ...(message ? [{ text: message }] : [])]
  let sessionId = body?.sessionId
  if (mock()) {
    sessionId ||= crypto.randomUUID()
    return new Response(mockStream(userId, sessionId, parts, message, files), { headers: headers(sessionId) })
  }
  try {
    if (!sessionId) {
      const created = await fetch(sessionUrl(userId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!created.ok) return fail(`ADK session creation failed (${created.status}): ${(await created.text()).slice(0, 300)}`, 502)
      const session = await created.json() as { id?: string; sessionId?: string }
      sessionId = session.id || session.sessionId
    }
    if (!sessionId) return fail('ADK did not return a session ID.', 502)
    const upstream = await fetch(`${base()}/run_sse`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ appName: app(), userId, sessionId, newMessage: { role: 'user', parts }, streaming: true }),
    })
    if (!upstream.ok || !upstream.body) return fail(`ADK /run_sse failed (${upstream.status}): ${(await upstream.text()).slice(0, 300)}`, 502)
    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = ''
        let assembled = ''
        let partialText = ''
        const joined = () => [assembled, partialText].filter(Boolean).join('\n\n')
        // ADK sends partial text events followed by a complete replacement event.
        // The outgoing stream always sends full accumulated text (not append-only chunks).
        const processBlock = (block: string) => {
          const raw = eventData(block)
          if (!raw || raw === '[DONE]') return
          const event = parseEvent(raw)
          if (!event) return
          if (event.errorMessage || event.errorCode) { controller.enqueue(encode({ error: event.errorMessage || event.errorCode })); return }
          if (event.content?.role !== 'model') return
          const parts = event.content.parts || []
          const tool = parts.find((part) => part.functionCall)?.functionCall?.name
          if (tool) controller.enqueue(encode({ status: `Using ${tool}` }))
          const produced = event.partial ? [] : filesOfParts(parts)
          if (produced.length) controller.enqueue(encode({ files: produced }))
          const text = textOfParts(parts)
          if (!text) return
          if (event.partial) {
            // Some ADK model integrations emit deltas; others emit cumulative snapshots.
            partialText = text.startsWith(partialText) ? text : partialText + text
          } else {
            // Replace speculative partials with the canonical completed event.
            assembled = [assembled, text].filter(Boolean).join('\n\n')
            partialText = ''
          }
          controller.enqueue(encode({ text: joined() }))
        }
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const split = splitSse(buffer)
            buffer = split.remainder
            for (const block of split.blocks) processBlock(block)
          }
          buffer += decoder.decode()
          if (buffer.trim()) processBlock(buffer)
          controller.enqueue(encode({ done: true }))
        } catch (error) {
          try { controller.enqueue(encode({ error: error instanceof Error ? error.message : 'ADK stream interrupted.' })) } catch { /* the client stopped the response */ }
        } finally {
          try { controller.close() } catch { /* already closed by a cancel */ }
          reader.releaseLock()
        }
      },
      cancel() { void reader.cancel() },
    })
    return new Response(stream, { headers: headers(sessionId) })
  } catch (error) {
    return fail(`Cannot reach ADK: ${error instanceof Error ? error.message : 'Unknown error'}`, 502)
  }
}
