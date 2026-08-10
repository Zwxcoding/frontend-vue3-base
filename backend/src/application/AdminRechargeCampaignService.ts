import { randomUUID } from 'node:crypto'
import { RechargeCampaign, type RechargeCampaignApprovalStatus, type RechargeCampaignStatus } from '../domain/recharge/RechargeCampaign.js'
import { createRechargeQuote } from '../domain/recharge/RechargeQuoteService.js'
import type { RechargeCampaignRepository } from '../repositories/RechargeCampaignRepository.js'
import type { RechargePlanRepository } from '../repositories/RechargePlanRepository.js'

export interface RechargeCampaignAdminInput {
  name?: unknown; type?: unknown; thresholdAmount?: unknown; bonusAmount?: unknown
  priority?: unknown; effectMode?: unknown; status?: unknown; approvalStatus?: unknown
  startTime?: unknown; endTime?: unknown; operator?: unknown; operationReason?: unknown
}

export class AdminRechargeCampaignService {
  constructor(
    private readonly campaigns: RechargeCampaignRepository,
    private readonly plans: RechargePlanRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => `campaign_admin_${randomUUID()}`
  ) {}

  list(): Promise<readonly RechargeCampaign[]> { return this.campaigns.findAll() }

  async create(input: RechargeCampaignAdminInput) {
    const normalized = this.validate({ ...input, approvalStatus: input.approvalStatus ?? 'draft' })
    const timestamp = this.now()
    const id = this.createId()
    const campaign = new RechargeCampaign({
      id, activityId: id, ...normalized, version: 1, source: 'admin',
      createTime: timestamp, updateTime: timestamp
    })
    const conflicts = await this.findConflicts(campaign)
    await this.campaigns.save(campaign)
    return { ...campaign, warning: conflicts.length > 0, conflictCampaigns: conflicts }
  }

  async update(id: string, input: RechargeCampaignAdminInput) {
    const current = await this.requireCampaign(id)
    const normalized = this.validate({
      name: input.name ?? current.name, type: input.type ?? current.type,
      thresholdAmount: input.thresholdAmount ?? current.thresholdAmount,
      bonusAmount: input.bonusAmount ?? current.bonusAmount,
      priority: input.priority ?? current.priority, effectMode: input.effectMode ?? current.effectMode,
      status: input.status ?? current.status, approvalStatus: input.approvalStatus ?? current.approvalStatus,
      startTime: input.startTime ?? current.startTime, endTime: input.endTime ?? current.endTime,
      operator: input.operator ?? current.operator, operationReason: input.operationReason ?? current.operationReason
    })
    const updated = new RechargeCampaign({
      id: current.id, activityId: current.activityId, ...normalized,
      version: current.version + 1, source: 'admin', createTime: current.createTime,
      updateTime: this.now()
    })
    const conflicts = await this.findConflicts(updated, id)
    await this.campaigns.save(updated)
    return { ...updated, warning: conflicts.length > 0, conflictCampaigns: conflicts }
  }

  changeStatus(id: string, status: unknown, operation: RechargeCampaignAdminInput = {}) {
    return this.update(id, { ...operation, status })
  }

  async preview(amountInput: unknown) {
    const amount = Number(amountInput)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Preview amount is invalid')
    const plan = (await this.plans.findActivePlans()).find((item) => item.amount === amount)
    if (!plan) throw new Error('Recharge plan not found')
    const now = this.now()
    const effective = await this.campaigns.findEffectiveCampaigns(amount, now)
    const quote = createRechargeQuote({
      id: `preview_${randomUUID()}`, plan, campaigns: effective, now,
      expireTime: new Date(now.getTime() + 10 * 60 * 1000)
    })
    return { quote, trace: {
      amount: quote.amount, planName: plan.name, baseBonus: quote.baseBonus,
      campaignName: effective.find((item) => item.id === quote.campaignId)?.name ?? '',
      campaignBonus: quote.campaignBonus, effectMode: quote.effectMode,
      finalBonus: quote.finalBonus, totalAmount: quote.totalAmount
    } }
  }

  private async requireCampaign(id: string): Promise<RechargeCampaign> {
    const campaign = await this.campaigns.findById(id)
    if (!campaign) throw new Error('Recharge campaign not found')
    return campaign
  }

  private async findConflicts(candidate: RechargeCampaign, editingId?: string) {
    return (await this.campaigns.findAll()).filter((item) =>
      item.id !== editingId && item.thresholdAmount === candidate.thresholdAmount &&
      item.startTime.getTime() <= candidate.endTime.getTime() &&
      candidate.startTime.getTime() <= item.endTime.getTime()
    )
  }

  private validate(input: RechargeCampaignAdminInput) {
    const name = String(input.name ?? '').trim()
    const type = String(input.type ?? 'recharge')
    const thresholdAmount = Number(input.thresholdAmount)
    const bonusAmount = Number(input.bonusAmount)
    const priority = Number(input.priority ?? 0)
    const effectMode = String(input.effectMode ?? 'override') as 'override'
    const status = String(input.status ?? 'active') as RechargeCampaignStatus
    const approvalStatus = String(input.approvalStatus ?? 'draft') as RechargeCampaignApprovalStatus
    const startTime = new Date(input.startTime as string | Date)
    const endTime = new Date(input.endTime as string | Date)
    if (!name) throw new Error('Recharge campaign name is required')
    if (type !== 'recharge') throw new Error('Recharge campaign type must be recharge')
    if (!Number.isFinite(thresholdAmount) || thresholdAmount <= 0) throw new Error('Threshold amount must be greater than 0')
    if (!Number.isFinite(bonusAmount) || bonusAmount < 0) throw new Error('Bonus amount must not be negative')
    if (!Number.isFinite(priority)) throw new Error('Campaign priority is invalid')
    if (effectMode !== 'override') throw new Error('Effect mode must be override')
    if (!['active', 'inactive'].includes(status)) throw new Error('Campaign status is invalid')
    if (!['draft', 'pending', 'approved', 'rejected'].includes(approvalStatus)) throw new Error('Campaign approval status is invalid')
    if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) || startTime > endTime) throw new Error('Campaign time range is invalid')
    return { name, thresholdAmount, bonusAmount, priority, effectMode, status,
      approvalStatus, startTime, endTime, operator: String(input.operator ?? ''),
      operationReason: String(input.operationReason ?? '') }
  }
}
