import { NextResponse } from 'next/server'
import type { AdkSession } from '@/lib/adk'

export const base = () => process.env.ADK_API_URL?.replace(/\/$/, '')
export const app = () => process.env.ADK_APP_NAME
export const mock = () => process.env.NODE_ENV !== 'production' && process.env.ADK_MOCK_MODE === 'true'
export const sessionUrl = (userId: string, sessionId?: string) => `${base()}/apps/${encodeURIComponent(app()!)}/users/${encodeURIComponent(userId)}/sessions${sessionId ? `/${encodeURIComponent(sessionId)}` : ''}`

export const validUserId = (userId: string | null | undefined): userId is string => !!userId && /^[a-zA-Z0-9_-]{1,100}$/.test(userId)
export const fail = (error: string, status: number) => NextResponse.json({ error }, { status })

/** Returns an error response when the server is not configured to reach ADK. */
export function configError() {
  if (process.env.NODE_ENV === 'production' && process.env.ADK_MOCK_MODE === 'true') return fail('Mock mode cannot be enabled in production.', 500)
  if (!mock() && (!base() || !app())) return fail('Set ADK_API_URL and ADK_APP_NAME in .env.local.', 500)
  return null
}

// Mock mode keeps sessions in memory so the multi-session UI works without ADK.
const store = globalThis as { __adkMockSessions?: Map<string, Map<string, AdkSession>> }
export function mockSessions(userId: string) {
  const all = (store.__adkMockSessions ??= new Map())
  if (!all.has(userId)) all.set(userId, new Map())
  return all.get(userId)!
}
