import 'dotenv/config'
export interface AppConfig {
  databaseUrl: string
  port: number
  nodeEnv: string
  devMemberToken: string
  devMemberId: string
  wxAppId: string
  wxAppSecret: string
}

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const port = Number(env.PORT ?? 3000)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be a valid TCP port')
  }

  return {
    databaseUrl: env.DATABASE_URL ?? '',
    port,
    nodeEnv: env.NODE_ENV ?? 'development',
    devMemberToken: env.DEV_MEMBER_TOKEN ?? '',
    devMemberId: env.DEV_MEMBER_ID ?? '',
    wxAppId: env.WX_APPID ?? '',
    wxAppSecret: env.WX_APP_SECRET ?? ''
  }
}

export const requireDatabaseUrl = (config: AppConfig): string => {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required')
  return config.databaseUrl
}
