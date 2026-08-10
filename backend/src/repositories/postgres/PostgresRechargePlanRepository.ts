import type { Pool, QueryResultRow } from 'pg'
import { RechargePlan } from '../../domain/recharge/RechargePlan.js'
import type { RechargePlanRepository } from '../RechargePlanRepository.js'

interface RechargePlanRow extends QueryResultRow {
  id: string
  name: string
  amount: string
  base_bonus: string
  status: 'active' | 'inactive'
  sort: number
  version: number
  source: string
  create_time: Date
  update_time: Date
}

const toDomain = (row: RechargePlanRow): RechargePlan => new RechargePlan({
  id: row.id,
  name: row.name,
  amount: Number(row.amount),
  baseBonus: Number(row.base_bonus),
  status: row.status,
  sort: row.sort,
  version: row.version,
  source: row.source,
  createTime: row.create_time,
  updateTime: row.update_time
})

export class PostgresRechargePlanRepository implements RechargePlanRepository {
  constructor(private readonly database: Pool) {}

  async findById(id: string): Promise<RechargePlan | null> {
    const result = await this.database.query<RechargePlanRow>(
      `SELECT id, name, amount, base_bonus, status, sort, version, source, create_time, update_time
       FROM recharge_plan
       WHERE id = $1 AND status = 'active'`,
      [id]
    )
    return result.rows[0] ? toDomain(result.rows[0]) : null
  }

  async findActivePlans(): Promise<readonly RechargePlan[]> {
    const result = await this.database.query<RechargePlanRow>(
      `SELECT id, name, amount, base_bonus, status, sort, version, source, create_time, update_time
       FROM recharge_plan
       WHERE status = 'active'
       ORDER BY sort ASC, id ASC`
    )
    return result.rows.map(toDomain)
  }

  async findAll(): Promise<readonly RechargePlan[]> {
    const result = await this.database.query<RechargePlanRow>(
      `SELECT id, name, amount, base_bonus, status, sort, version, source, create_time, update_time
       FROM recharge_plan ORDER BY sort ASC, id ASC`
    )
    return result.rows.map(toDomain)
  }

  async findAnyById(id: string): Promise<RechargePlan | null> {
    const result = await this.database.query<RechargePlanRow>(
      `SELECT id, name, amount, base_bonus, status, sort, version, source, create_time, update_time
       FROM recharge_plan WHERE id = $1`, [id]
    )
    return result.rows[0] ? toDomain(result.rows[0]) : null
  }

  async save(plan: RechargePlan): Promise<void> {
    await this.database.query(
      `INSERT INTO recharge_plan (
         id, name, amount, base_bonus, status, sort, version, source, create_time, update_time
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         amount = EXCLUDED.amount,
         base_bonus = EXCLUDED.base_bonus,
         status = EXCLUDED.status,
         sort = EXCLUDED.sort,
         version = EXCLUDED.version,
         source = EXCLUDED.source,
         update_time = EXCLUDED.update_time`,
      [plan.id, plan.name, plan.amount, plan.baseBonus, plan.status, plan.sort,
        plan.version, plan.source, plan.createTime, plan.updateTime]
    )
  }
}
