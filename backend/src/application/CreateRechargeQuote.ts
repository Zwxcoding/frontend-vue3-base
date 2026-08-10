import { randomUUID } from 'node:crypto'
import { createRechargeQuote } from '../domain/recharge/RechargeQuoteService.js'
import type { RechargeQuote } from '../domain/recharge/RechargeQuote.js'
import type { RechargeCampaignRepository } from '../repositories/RechargeCampaignRepository.js'
import type { RechargePlanRepository } from '../repositories/RechargePlanRepository.js'
import type { RechargeQuoteRepository } from '../repositories/RechargeQuoteRepository.js'

export interface CreateRechargeQuoteDependencies {
  plans: RechargePlanRepository
  campaigns: RechargeCampaignRepository
  quotes: RechargeQuoteRepository
  now?: () => Date
  createId?: () => string
  quoteTtlMs?: number
}

export class CreateRechargeQuote {
  constructor(private readonly dependencies: CreateRechargeQuoteDependencies) {}

  async execute(planId: string): Promise<RechargeQuote> {
    if (!planId) throw new Error('planId is required')
    const plan = await this.dependencies.plans.findById(planId)
    if (!plan) throw new Error('Recharge plan not found')
    const now = this.dependencies.now?.() ?? new Date()
    const campaigns = await this.dependencies.campaigns.findEffectiveCampaigns(plan.amount, now)
    const quote = createRechargeQuote({
      id: this.dependencies.createId?.() ?? randomUUID(),
      plan,
      campaigns,
      now,
      expireTime: new Date(now.getTime() + (this.dependencies.quoteTtlMs ?? 10 * 60 * 1000))
    })
    await this.dependencies.quotes.save(quote)
    return quote
  }
}
