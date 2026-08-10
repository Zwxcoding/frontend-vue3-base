const toNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export const createRechargeCampaign = (activity = {}) => {
  const thresholdAmount = toNumber(
    activity.thresholdAmount ??
    activity.rechargeAmount ??
    activity.rule?.thresholdAmount ??
    activity.rule?.rechargeAmount
  )
  const bonusAmount = toNumber(
    activity.bonusAmount ??
    activity.giftAmount ??
    activity.bonus ??
    activity.rule?.bonusAmount
  )

  return {
    id: activity.id ?? null,
    activityId: activity.id ?? null,
    name: activity.name || activity.activityName || '',
    type: 'recharge',
    status: activity.status === 'inactive' ? 'inactive' : 'active',
    startTime: activity.startTime || activity.startDate || '',
    endTime: activity.endTime || activity.endDate || '',
    priority: toNumber(activity.priority),
    thresholdAmount,
    rechargeAmount: thresholdAmount,
    bonusAmount,
    effectMode: activity.effectMode || activity.rule?.effectMode || 'override',
    source: 'activity',
    activity
  }
}
