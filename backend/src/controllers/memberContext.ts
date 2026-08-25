import type { IncomingMessage } from 'node:http'

export interface DevelopmentMemberContextConfig {
  nodeEnv: string
  devMemberToken: string
  devMemberId: string
}

export type ResolveCurrentMemberId = (request: IncomingMessage) => string

export const createDevelopmentMemberContext = (
  config: DevelopmentMemberContextConfig
): ResolveCurrentMemberId => (request) => {
  if (config.nodeEnv === 'production') throw new Error('Development member identity is disabled')
  if (!config.devMemberToken || !config.devMemberId) throw new Error('Development member identity is not configured')
  const token = request.headers['x-dev-member-token']
  if (typeof token !== 'string' || token !== config.devMemberToken) throw new Error('Unauthorized member identity')
  return config.devMemberId
}
