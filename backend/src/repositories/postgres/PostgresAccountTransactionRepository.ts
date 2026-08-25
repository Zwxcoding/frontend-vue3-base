import type { Pool, PoolClient, QueryResultRow } from 'pg'
import { AccountTransaction, type AccountTransactionType } from '../../domain/account/AccountTransaction.js'
import type { AccountTransactionRepository } from '../AccountTransactionRepository.js'

interface TransactionRow extends QueryResultRow {
  id: string
  member_id: string
  account_id: string
  transaction_type: AccountTransactionType
  amount: string
  before_balance: string
  after_balance: string
  reference_type: string
  reference_id: string
  create_time: Date
}

const columns = `id, member_id, account_id, transaction_type, amount,
  before_balance, after_balance, reference_type, reference_id, create_time`
const toDomain = (row: TransactionRow): AccountTransaction => new AccountTransaction({
  id: row.id, memberId: row.member_id, accountId: row.account_id,
  transactionType: row.transaction_type, amount: Number(row.amount),
  beforeBalance: Number(row.before_balance), afterBalance: Number(row.after_balance),
  referenceType: row.reference_type, referenceId: row.reference_id, createTime: row.create_time
})

export class PostgresAccountTransactionRepository implements AccountTransactionRepository {
  constructor(private readonly database: Pool | PoolClient) {}

  async save(transaction: AccountTransaction): Promise<void> {
    await this.database.query(
      `INSERT INTO account_transaction (
         id, member_id, account_id, transaction_type, amount,
         before_balance, after_balance, reference_type, reference_id, create_time
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [transaction.id, transaction.memberId, transaction.accountId, transaction.transactionType,
        transaction.amount, transaction.beforeBalance, transaction.afterBalance,
        transaction.referenceType, transaction.referenceId, transaction.createTime]
    )
  }

  async findByReference(
    referenceType: string,
    referenceId: string,
    transactionType: AccountTransactionType
  ): Promise<AccountTransaction | null> {
    const result = await this.database.query<TransactionRow>(
      `SELECT ${columns} FROM account_transaction
       WHERE reference_type = $1 AND reference_id = $2 AND transaction_type = $3`,
      [referenceType, referenceId, transactionType]
    )
    return result.rows[0] ? toDomain(result.rows[0]) : null
  }

  async findByMemberId(memberId: string): Promise<readonly AccountTransaction[]> {
    const result = await this.database.query<TransactionRow>(
      `SELECT ${columns} FROM account_transaction
       WHERE member_id = $1 ORDER BY create_time DESC, id DESC`, [memberId]
    )
    return result.rows.map(toDomain)
  }
}
