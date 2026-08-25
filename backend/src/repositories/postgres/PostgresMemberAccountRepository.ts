import type { Pool, PoolClient, QueryResultRow } from 'pg'
import { MemberAccount } from '../../domain/account/MemberAccount.js'
import type { MemberAccountRepository } from '../MemberAccountRepository.js'

interface AccountRow extends QueryResultRow {
  id: string
  member_id: string
  balance: string
  version: number
  status: 'active' | 'frozen' | 'closed'
  create_time: Date
  update_time: Date
}

const columns = 'id, member_id, balance, version, status, create_time, update_time'
const toDomain = (row: AccountRow): MemberAccount => new MemberAccount({
  id: row.id, memberId: row.member_id, balance: Number(row.balance), version: row.version,
  status: row.status, createTime: row.create_time, updateTime: row.update_time
})

export class PostgresMemberAccountRepository implements MemberAccountRepository {
  constructor(private readonly database: Pool | PoolClient) {}

  async findByMemberId(memberId: string): Promise<MemberAccount | null> {
    const result = await this.database.query<AccountRow>(
      `SELECT ${columns} FROM member_account WHERE member_id = $1`, [memberId]
    )
    return result.rows[0] ? toDomain(result.rows[0]) : null
  }

  async findByIdForUpdate(id: string): Promise<MemberAccount | null> {
    const result = await this.database.query<AccountRow>(
      `SELECT ${columns} FROM member_account WHERE id = $1 FOR UPDATE`, [id]
    )
    return result.rows[0] ? toDomain(result.rows[0]) : null
  }

  async create(account: MemberAccount): Promise<void> {
    await this.database.query(
      `INSERT INTO member_account (id, member_id, balance, version, status, create_time, update_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [account.id, account.memberId, account.balance, account.version, account.status,
        account.createTime, account.updateTime]
    )
  }

  async updateBalanceWithVersion(account: MemberAccount, expectedVersion: number): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE member_account
       SET balance = $2, version = $3, update_time = $4
       WHERE id = $1 AND version = $5`,
      [account.id, account.balance, account.version, account.updateTime, expectedVersion]
    )
    return result.rowCount === 1
  }
}
