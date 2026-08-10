import { createRechargePlan } from '../models/rechargePlan.js'
import { getStoredRechargePlans } from './rechargePlanStorageService.js'

export const LEGACY_RECHARGE_PLANS = Object.freeze([
  Object.freeze({ amount: 50, bonus: 5 }),
  Object.freeze({ amount: 100, bonus: 15 }),
  Object.freeze({ amount: 200, bonus: 40 }),
  Object.freeze({ amount: 300, bonus: 50 })
])

export const adaptRechargePlan = (plan) => createRechargePlan({
  ...plan,
  bonusAmount: plan?.bonusAmount ?? plan?.baseBonus
})

export const getRechargePlans = (plans) => {
  const storedPlans = plans === undefined ? getStoredRechargePlans() : null
  const source = plans === undefined
    ? (storedPlans === null ? LEGACY_RECHARGE_PLANS : storedPlans)
    : plans
  return (Array.isArray(source) ? source : [])
    .map(adaptRechargePlan)
    .filter((plan) => plan.status === 'active')
}

export const getRechargePlanByAmount = (amount, plans) => {
  const targetAmount = Number(amount)
  return getRechargePlans(plans).find((plan) => plan.amount === targetAmount) || null
}
