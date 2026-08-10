const toNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export const normalizeDiscountRate = (value) => {
  const rate = toNumber(value, 1)
  return rate > 1 ? Number((rate / 10).toFixed(4)) : rate
}

export const createActivity = (data = {}) => {
  const type = data.type || (data.activityType === 'discount' ? 'discount' : 'recharge')
  const legacyRechargeAmount = data.rechargeAmount ?? data.rule?.rechargeAmount
  const legacyBonusAmount = data.bonusAmount ?? data.giftAmount ?? data.bonus ?? data.rule?.bonusAmount
  const legacyDiscountRate = data.discountRate ?? data.discount ?? data.rule?.discountRate
  const rechargeAmount = toNumber(legacyRechargeAmount)
  const bonusAmount = toNumber(legacyBonusAmount)
  const discountRate = normalizeDiscountRate(legacyDiscountRate)

  return {
    id: data.id || Date.now(),
    name: data.name || data.activityName || '活动',
    type: type === 'discount' ? 'discount' : 'recharge',
    status: data.status === 'inactive' ? 'inactive' : 'active',
    startTime: data.startTime || data.startDate || '',
    endTime: data.endTime || data.endDate || '',
    priority: toNumber(data.priority),
    ...(type === 'discount' ? { discountRate } : { rechargeAmount, bonusAmount }),
    rule: type === 'discount' ? { discountRate } : { rechargeAmount, bonusAmount },
    createTime: data.createTime || data.createdAt || new Date().toISOString()
  }
}
