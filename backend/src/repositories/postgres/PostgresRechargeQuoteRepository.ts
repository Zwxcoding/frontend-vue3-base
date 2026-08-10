import type { Pool, QueryResultRow } from 'pg'
import { RechargeQuote, type RechargeRuleSnapshot } from '../../domain/recharge/RechargeQuote.js'
import type { RechargeQuoteRepository } from '../RechargeQuoteRepository.js'

interface RechargeQuoteRow extends QueryResultRow {
  id: string
  plan_id: string
  campaign_id: string | null
  amount: string
  base_bonus: string
  campaign_bonus: string
  final_bonus: string
  total_amount: string
  effect_mode: 'none' | 'override'
  rule_snapshot: RechargeRuleSnapshot
  expire_time: Date
  create_time: Date
}

const toDomain = (row: RechargeQuoteRow): RechargeQuote => RechargeQuote.restore({
  id: row.id,
  planId: row.plan_id,
  campaignId: row.campaign_id,
  amount: Number(row.amount),
  baseBonus: Number(row.base_bonus),
  campaignBonus: Number(row.campaign_bonus),
  finalBonus: Number(row.final_bonus),
  totalAmount: Number(row.total_amount),
  effectMode: row.effect_mode,
  ruleSnapshot: row.rule_snapshot,
  expireTime: row.expire_time,
  createTime: row.create_time
})

export class PostgresRechargeQuoteRepository implements RechargeQuoteRepository {
  constructor(private readonly database: Pool) {}

  async save(quote: RechargeQuote): Promise<void> {
    await this.database.query(
      `INSERT INTO recharge_quote (
         id, plan_id, campaign_id, amount, base_bonus, campaign_bonus,
         final_bonus, total_amount, effect_mode, rule_snapshot, expire_time, create_time
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)`,
      [
        quote.id, quote.planId, quote.campaignId, quote.amount, quote.baseBonus,
        quote.campaignBonus, quote.finalBonus, quote.totalAmount, quote.effectMode,
        JSON.stringify(quote.ruleSnapshot), quote.expireTime, quote.createTime
      ]
    )
  }

  async findById(id: string): Promise<RechargeQuote | null> {
    const result = await this.database.query<RechargeQuoteRow>(
      `SELECT id, plan_id, campaign_id, amount, base_bonus, campaign_bonus,
              final_bonus, total_amount, effect_mode, rule_snapshot, expire_time, create_time
       FROM recharge_quote
       WHERE id = $1`,
      [id]
    )
    return result.rows[0] ? toDomain(result.rows[0]) : null
  }
}
