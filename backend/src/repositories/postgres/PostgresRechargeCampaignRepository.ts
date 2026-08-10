import type { Pool, QueryResultRow } from 'pg'
import { RechargeCampaign } from '../../domain/recharge/RechargeCampaign.js'
import type { RechargeCampaignRepository } from '../RechargeCampaignRepository.js'

interface RechargeCampaignRow extends QueryResultRow {
  id: string
  activity_id: string | null
  name: string
  threshold_amount: string
  bonus_amount: string
  priority: number
  effect_mode: 'override'
  status: 'active' | 'inactive'
  approval_status: 'draft' | 'pending' | 'approved' | 'rejected'
  start_time: Date
  end_time: Date
  version: number
  source: string
  operator: string
  operation_reason: string
  create_time: Date
  update_time: Date
}

const toDomain = (row: RechargeCampaignRow): RechargeCampaign => new RechargeCampaign({
  id: row.id,
  activityId: row.activity_id,
  name: row.name,
  thresholdAmount: Number(row.threshold_amount),
  bonusAmount: Number(row.bonus_amount),
  priority: row.priority,
  effectMode: row.effect_mode,
  status: row.status,
  approvalStatus: row.approval_status,
  startTime: row.start_time,
  endTime: row.end_time,
  version: row.version,
  source: row.source,
  operator: row.operator,
  operationReason: row.operation_reason,
  createTime: row.create_time,
  updateTime: row.update_time
})

export class PostgresRechargeCampaignRepository implements RechargeCampaignRepository {
  constructor(private readonly database: Pool) {}

  async findEffectiveCampaigns(amount: number, now: Date): Promise<readonly RechargeCampaign[]> {
    const result = await this.database.query<RechargeCampaignRow>(
      `SELECT id, activity_id, name, threshold_amount, bonus_amount, priority,
              effect_mode, status, approval_status, start_time, end_time, version,
              source, operator, operation_reason, create_time, update_time
       FROM recharge_campaign
       WHERE status = 'active'
         AND approval_status = 'approved'
         AND start_time <= $1
         AND end_time >= $1
         AND threshold_amount <= $2
       ORDER BY priority DESC, activity_id DESC NULLS LAST`,
      [now, amount]
    )
    return result.rows.map(toDomain)
  }

  async findAll(): Promise<readonly RechargeCampaign[]> {
    const result = await this.database.query<RechargeCampaignRow>(
      `SELECT id, activity_id, name, threshold_amount, bonus_amount, priority,
              effect_mode, status, approval_status, start_time, end_time, version,
              source, operator, operation_reason, create_time, update_time
       FROM recharge_campaign ORDER BY priority DESC, activity_id DESC NULLS LAST`
    )
    return result.rows.map(toDomain)
  }

  async findById(id: string): Promise<RechargeCampaign | null> {
    const result = await this.database.query<RechargeCampaignRow>(
      `SELECT id, activity_id, name, threshold_amount, bonus_amount, priority,
              effect_mode, status, approval_status, start_time, end_time, version,
              source, operator, operation_reason, create_time, update_time
       FROM recharge_campaign WHERE id = $1`, [id]
    )
    return result.rows[0] ? toDomain(result.rows[0]) : null
  }

  async save(campaign: RechargeCampaign): Promise<void> {
    await this.database.query(
      `INSERT INTO recharge_campaign (
        id, activity_id, name, threshold_amount, bonus_amount, priority, effect_mode,
        status, approval_status, start_time, end_time, version, source, operator,
        operation_reason, create_time, update_time
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, threshold_amount=EXCLUDED.threshold_amount,
        bonus_amount=EXCLUDED.bonus_amount, priority=EXCLUDED.priority,
        effect_mode=EXCLUDED.effect_mode, status=EXCLUDED.status,
        approval_status=EXCLUDED.approval_status, start_time=EXCLUDED.start_time,
        end_time=EXCLUDED.end_time, version=EXCLUDED.version, source=EXCLUDED.source,
        operator=EXCLUDED.operator, operation_reason=EXCLUDED.operation_reason,
        update_time=EXCLUDED.update_time`,
      [campaign.id, campaign.activityId, campaign.name, campaign.thresholdAmount,
        campaign.bonusAmount, campaign.priority, campaign.effectMode, campaign.status,
        campaign.approvalStatus, campaign.startTime, campaign.endTime, campaign.version,
        campaign.source, campaign.operator, campaign.operationReason,
        campaign.createTime, campaign.updateTime]
    )
  }
}
