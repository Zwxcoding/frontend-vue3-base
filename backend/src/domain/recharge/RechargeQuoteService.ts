import { RechargeQuote } from './RechargeQuote.js'
import type { RechargeCampaign } from './RechargeCampaign.js'
import type { RechargePlan } from './RechargePlan.js'

const numericActivityId = (campaign: RechargeCampaign): number => {
  const value = Number(campaign.activityId ?? campaign.id)
  return Number.isFinite(value) ? value : 0
}

export const selectBestRechargeCampaign = (
  plan: RechargePlan,
  campaigns: readonly RechargeCampaign[],
  now: Date
): RechargeCampaign | null => campaigns
  .filter((campaign) => campaign.matches(plan.amount, now))
  .sort((left, right) =>
    right.priority - left.priority || numericActivityId(right) - numericActivityId(left)
  )[0] ?? null

export const createRechargeQuote = (input: {
  id: string
  plan: RechargePlan
  campaigns: readonly RechargeCampaign[]
  now: Date
  expireTime: Date
}): RechargeQuote => {
  if (!input.plan.isActive) throw new Error('Recharge plan is not active')
  const campaign = selectBestRechargeCampaign(input.plan, input.campaigns, input.now)
  return new RechargeQuote({
    id: input.id,
    plan: input.plan,
    campaign,
    createTime: input.now,
    expireTime: input.expireTime
  })
}
