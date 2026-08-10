import { fileURLToPath } from 'node:url'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { Pool } from 'pg'
import { closeDatabasePool, getDatabasePool } from './pool.js'

const migrationsDirectory = process.env.MIGRATIONS_DIR ??
  resolve(process.cwd(), 'src/database/migrations')

export const runMigrations = async (database: Pool = getDatabasePool()): Promise<void> => {
  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const existing = await database.query(
      'SELECT 1 FROM schema_migration WHERE name = $1',
      [file]
    )
    if (existing.rowCount) continue

    const sql = await readFile(resolve(migrationsDirectory, file), 'utf8')
    const client = await database.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migration(name) VALUES ($1)', [file])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isEntrypoint) {
  runMigrations()
    .then(() => console.log('Database migrations completed'))
    .finally(closeDatabasePool)
}
