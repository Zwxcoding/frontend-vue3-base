import 'dotenv/config'
export interface AppConfig {
  databaseUrl: string
  port: number
}

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const port = Number(env.PORT ?? 3000)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be a valid TCP port')
  }

  return {
    databaseUrl: env.DATABASE_URL ?? '',
    port
  }
}

export const requireDatabaseUrl = (config: AppConfig): string => {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required')
  return config.databaseUrl
}
