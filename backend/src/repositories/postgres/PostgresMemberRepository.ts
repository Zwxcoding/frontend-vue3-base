import type { Pool, PoolClient, QueryResultRow } from 'pg'
import { Member } from '../../domain/member/Member.js'
import type { MemberRepository } from '../MemberRepository.js'

interface MemberRow extends QueryResultRow {
  id: string
  openid: string | null
  mobile: string | null
  name: string | null
  status: 'active' | 'inactive'
  create_time: Date
  update_time: Date
}

const toDomain = (row: MemberRow): Member => new Member({
  id: row.id, openid: row.openid, mobile: row.mobile, name: row.name,
  status: row.status, createTime: row.create_time, updateTime: row.update_time
})

export class PostgresMemberRepository implements MemberRepository {
  constructor(private readonly database: Pool | PoolClient) {}

  async findById(id: string): Promise<Member | null> {
    const result = await this.database.query<MemberRow>(
      'SELECT id, openid, mobile, name, status, create_time, update_time FROM member WHERE id = $1', [id]
    )
    return result.rows[0] ? toDomain(result.rows[0]) : null
  }

  async findByOpenid(openid: string): Promise<Member | null> {
    const result = await this.database.query<MemberRow>(
      'SELECT id, openid, mobile, name, status, create_time, update_time FROM member WHERE openid = $1', [openid]
    )
    return result.rows[0] ? toDomain(result.rows[0]) : null
  }

  async save(member: Member): Promise<void> {
    await this.database.query(
      `INSERT INTO member (id, openid, mobile, name, status, create_time, update_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [member.id, member.openid, member.mobile, member.name, member.status, member.createTime, member.updateTime]
    )
  }

  async updateProfile(member: Member): Promise<void> {
    const result = await this.database.query(
      `UPDATE member SET mobile = $2, name = $3, update_time = $4 WHERE id = $1`,
      [member.id, member.mobile, member.name, member.updateTime]
    )
    if (result.rowCount !== 1) throw new Error('Member not found')
  }
}
