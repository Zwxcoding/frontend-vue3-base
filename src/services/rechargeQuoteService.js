import { createRechargeQuote } from '../models/rechargeQuote.js'
import { adaptRechargePlan } from './rechargePlanService.js'
import { getBestRechargeCampaign } from './rechargeCampaignService.js'
import {
  getLegacyRechargeSource,
  PRODUCTION_RECHARGE_SOURCE_SWITCH,
  recordRechargeSourceFallback,
  resolveRechargeSource
} from './rechargeSourceSwitchService.js'

export const calculateRechargeQuote = ({
  plan,
  currentActivities,
  sourceSwitch
} = {}) => {
  const normalizedPlan = adaptRechargePlan(plan)
  if (normalizedPlan.status !== 'active' || normalizedPlan.amount <= 0) {
    throw new Error('充值套餐无效')
  }

  const buildQuote = (activities) => {
    const campaign = getBestRechargeCampaign(normalizedPlan.amount, activities)
    const matchedActivity = campaign?.activity || null
    const baseBonus = normalizedPlan.bonusAmount
    const campaignBonus = campaign?.bonusAmount || 0
    const effectMode = campaign?.effectMode || 'none'
    const finalBonus = campaign ? campaignBonus : baseBonus

    return createRechargeQuote({
      plan: normalizedPlan,
      campaign,
      activity: matchedActivity,
      amount: normalizedPlan.amount,
      baseBonus,
      campaignBonus,
      finalBonus,
      totalAmount: normalizedPlan.amount + finalBonus,
      effectMode,
      bonusSource: campaign ? 'campaign' : 'plan'
    })
  }

  if (currentActivities !== undefined) {
    return buildQuote(currentActivities)
  }

  const resolution = resolveRechargeSource({
    config: sourceSwitch || PRODUCTION_RECHARGE_SOURCE_SWITCH
  })
  try {
    return buildQuote(resolution.activities)
  } catch (error) {
    if (resolution.source !== 'campaign' || !resolution.fallbackEnabled) throw error
    recordRechargeSourceFallback(`Campaign Quote计算失败：${error.message || error}`)
    return buildQuote(getLegacyRechargeSource())
  }
}
