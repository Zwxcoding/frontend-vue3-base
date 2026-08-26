import { randomUUID } from 'node:crypto'

export interface Session {
  memberId: string
  createdAt: number
  lastAccessAt: number
}

export class SessionStore {
  private readonly sessions = new Map<string, Session>()
  private readonly ttlMs: number
  private readonly cleanupIntervalMs: number
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(options: { ttlMs?: number; cleanupIntervalMs?: number } = {}) {
    this.ttlMs = options.ttlMs ?? 60 * 60 * 1000
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 5 * 60 * 1000
  }

  start(): void {
    if (this.cleanupTimer) return
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupIntervalMs)
    if (typeof this.cleanupTimer.unref === 'function') this.cleanupTimer.unref()
  }

  stop(): void {
    if (!this.cleanupTimer) return
    clearInterval(this.cleanupTimer)
    this.cleanupTimer = null
  }

  create(memberId: string): { token: string; expiresAt: number } {
    const token = randomUUID()
    const now = Date.now()
    this.sessions.set(token, { memberId, createdAt: now, lastAccessAt: now })
    return { token, expiresAt: now + this.ttlMs }
  }

  resolve(token: string): Session | null {
    if (!token) return null
    const session = this.sessions.get(token)
    if (!session) return null
    const now = Date.now()
    if (now - session.lastAccessAt > this.ttlMs) {
      this.sessions.delete(token)
      return null
    }
    session.lastAccessAt = now
    return session
  }

  revoke(token: string): void {
    this.sessions.delete(token)
  }

  size(): number {
    return this.sessions.size
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [token, session] of this.sessions) {
      if (now - session.lastAccessAt > this.ttlMs) {
        this.sessions.delete(token)
      }
    }
  }
}
