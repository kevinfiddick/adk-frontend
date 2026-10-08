import { NextResponse } from 'next/server'
import type { AdkSession, SessionSummary } from '@/lib/adk'
import { configError, fail, mock, mockSessions, sessionUrl, validUserId } from '@/lib/adk-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ADK reports lastUpdateTime in seconds.
const summarize = (sessions: AdkSession[]): SessionSummary[] =>
  sessions.map((session) => ({ id: session.id, updatedAt: Math.round((session.lastUpdateTime || 0) * 1000) })).sort((a, b) => b.updatedAt - a.updatedAt)

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('userId')
  if (!validUserId(userId)) return fail('A valid user ID is required.', 400)
  const invalid = configError()
  if (invalid) return invalid
  if (mock()) return NextResponse.json(summarize([...mockSessions(userId).values()]))
  try {
    const result = await fetch(sessionUrl(userId), { cache: 'no-store' })
    if (!result.ok) return fail(`ADK could not list sessions (${result.status}).`, 502)
    const data = await result.json() as AdkSession[] | { sessions?: AdkSession[] }
    return NextResponse.json(summarize(Array.isArray(data) ? data : data.sessions || []))
  } catch { return fail('Cannot reach the ADK server.', 502) }
}
