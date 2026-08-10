const toAmount = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0
}

export const createRechargeQuote = (data = {}) => {
  const amount = toAmount(data.amount)
  const baseBonus = toAmount(data.baseBonus ?? data.plan?.bonusAmount)
  const campaignBonus = toAmount(data.campaignBonus ?? data.campaign?.bonusAmount)
  const effectMode = data.effectMode || data.campaign?.effectMode || 'none'
  const finalBonus = toAmount(
    data.finalBonus ??
    data.bonusAmount ??
    (effectMode === 'override' && data.campaign ? campaignBonus : baseBonus)
  )
  const ruleSnapshot = data.ruleSnapshot || {
    planId: data.plan?.id ?? null,
    campaignId: data.campaign?.activityId ?? data.campaign?.id ?? null,
    thresholdAmount: data.campaign?.thresholdAmount ?? null,
    priority: data.campaign?.priority ?? null,
    baseBonus,
    campaignBonus,
    finalBonus,
    effectMode
  }

  return {
    plan: data.plan || null,
    campaign: data.campaign || null,
    activity: data.activity || data.campaign?.activity || null,
    amount,
    rechargeAmount: amount,
    baseBonus,
    campaignBonus,
    finalBonus,
    bonusAmount: finalBonus,
    totalAmount: toAmount(data.totalAmount ?? amount + finalBonus),
    effectMode,
    ruleSnapshot,
    bonusSource: data.bonusSource || (data.campaign ? 'campaign' : 'plan')
  }
}
