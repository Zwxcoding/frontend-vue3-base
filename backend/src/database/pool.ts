import { Pool } from 'pg'
import { loadConfig, requireDatabaseUrl } from '../config/env.js'

let pool: Pool | null = null

export const getDatabasePool = (): Pool => {
  if (!pool) {
    const config = loadConfig()
    pool = new Pool({ connectionString: requireDatabaseUrl(config) })
  }
  return pool
}

export const closeDatabasePool = async (): Promise<void> => {
  if (!pool) return
  await pool.end()
  pool = null
}
