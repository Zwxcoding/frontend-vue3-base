import type { Pool } from 'pg'
import type { AccountTransactionManager, AccountUnitOfWork } from '../../domain/account/AccountService.js'
import { PostgresAccountTransactionRepository } from './PostgresAccountTransactionRepository.js'
import { PostgresMemberAccountRepository } from './PostgresMemberAccountRepository.js'

export class PostgresAccountTransactionManager implements AccountTransactionManager {
  constructor(private readonly database: Pool) {}

  async execute<T>(work: (unitOfWork: AccountUnitOfWork) => Promise<T>): Promise<T> {
    const client = await this.database.connect()
    try {
      await client.query('BEGIN')
      const result = await work({
        accounts: new PostgresMemberAccountRepository(client),
        transactions: new PostgresAccountTransactionRepository(client)
      })
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
