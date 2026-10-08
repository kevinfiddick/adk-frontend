import { NextResponse } from 'next/server'
import { configError, fail, mock, mockSessions, sessionUrl, validUserId } from '@/lib/adk-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ sessionId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { sessionId } = await params
  const userId = new URL(request.url).searchParams.get('userId')
  if (!validUserId(userId)) return fail('A valid user ID is required.', 400)
  const invalid = configError()
  if (invalid) return invalid
  if (mock()) {
    const session = mockSessions(userId).get(sessionId)
    return session ? NextResponse.json(session) : fail('Session not found.', 404)
  }
  try {
    const result = await fetch(sessionUrl(userId, sessionId), { cache: 'no-store' })
    if (!result.ok) return fail(result.status === 404 ? 'Session not found.' : `ADK could not load the session (${result.status}).`, result.status === 404 ? 404 : 502)
    return NextResponse.json(await result.json())
  } catch { return fail('Cannot reach the ADK server.', 502) }
}

export async function DELETE(request: Request, { params }: Context) {
  const { sessionId } = await params
  const userId = new URL(request.url).searchParams.get('userId')
  if (!validUserId(userId)) return fail('A valid user ID is required.', 400)
  const invalid = configError()
  if (invalid) return invalid
  if (mock()) { mockSessions(userId).delete(sessionId); return NextResponse.json({ ok: true }) }
  try {
    const result = await fetch(sessionUrl(userId, sessionId), { method: 'DELETE' })
    // A session that is already gone counts as deleted.
    if (!result.ok && result.status !== 404) return fail(`ADK could not delete the session (${result.status}).`, 502)
    return NextResponse.json({ ok: true })
  } catch { return fail('Cannot reach the ADK server.', 502) }
}
