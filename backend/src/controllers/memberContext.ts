import type { IncomingMessage } from 'node:http'
import type { SessionStore } from '../application/auth/SessionStore.js'

export interface MemberIdentityConfig {
  nodeEnv: string
  devMemberToken: string
  devMemberId: string
  sessionStore: SessionStore
}

export type ResolveCurrentMemberId = (request: IncomingMessage) => string

export const createMemberIdentityResolver = (
  config: MemberIdentityConfig
): ResolveCurrentMemberId => (request) => {
  const sessionToken = request.headers['x-session-token']
  if (typeof sessionToken === 'string' && sessionToken.length > 0) {
    const session = config.sessionStore.resolve(sessionToken)
    if (!session) throw new Error('Unauthorized member session')
    return session.memberId
  }

  if (config.nodeEnv !== 'production') {
    if (!config.devMemberToken || !config.devMemberId) {
      throw new Error('Development member identity is not configured')
    }
    const devToken = request.headers['x-dev-member-token']
    if (typeof devToken === 'string' && devToken === config.devMemberToken) {
      return config.devMemberId
    }
  }

  throw new Error('Unauthorized member identity')
}
