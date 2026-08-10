const toAmount = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0
}

export const createRechargePlan = (data = {}) => {
  const amount = toAmount(data.amount ?? data.rechargeAmount)
  const bonusAmount = toAmount(data.bonusAmount ?? data.bonus)

  return {
    id: data.id ?? `legacy-plan-${amount}`,
    name: data.name || `充值 ¥${amount}`,
    amount,
    bonusAmount,
    status: data.status === 'inactive' ? 'inactive' : 'active',
    source: data.source || 'legacy-fixed'
  }
}

