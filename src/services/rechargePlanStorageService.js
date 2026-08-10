import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { getStorage, setStorage } from '../utils/storage.js'

const STORAGE_MISSING = Object.freeze({ missing: true })

export const DEFAULT_RECHARGE_PLAN_STORAGE = Object.freeze([
  Object.freeze({ id: 'legacy_plan_50', name: '50元充值套餐', amount: 50, baseBonus: 5, status: 'active', sort: 10, version: 1, source: 'migration' }),
  Object.freeze({ id: 'legacy_plan_100', name: '100元充值套餐', amount: 100, baseBonus: 15, status: 'active', sort: 20, version: 1, source: 'migration' }),
  Object.freeze({ id: 'legacy_plan_200', name: '200元充值套餐', amount: 200, baseBonus: 40, status: 'active', sort: 30, version: 1, source: 'migration' }),
  Object.freeze({ id: 'legacy_plan_300', name: '300元充值套餐', amount: 300, baseBonus: 50, status: 'active', sort: 40, version: 1, source: 'migration' })
])

const clonePlan = (plan) => ({ ...plan })

export const getStoredRechargePlans = () => {
  const stored = getStorage(STORAGE_KEYS.RECHARGE_PLANS, STORAGE_MISSING)
  if (stored === STORAGE_MISSING) return null
  return Array.isArray(stored) ? stored.map(clonePlan) : []
}

export const initializeRechargeStorage = () => {
  const existingPlans = getStoredRechargePlans()
  if (existingPlans !== null) return existingPlans

  const now = new Date().toISOString()
  const plans = DEFAULT_RECHARGE_PLAN_STORAGE.map((plan) => ({
    ...clonePlan(plan),
    createTime: now,
    updateTime: now
  }))
  setStorage(STORAGE_KEYS.RECHARGE_PLANS, plans)
  return plans
}

