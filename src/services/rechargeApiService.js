import { hasBackendApi, requestBackend } from '../utils/api.js'
import { getRechargePlans } from './rechargePlanService.js'
import { calculateRechargeQuote } from './rechargeQuoteService.js'

export const getRechargePlansFromBackend = () => {
  if (!hasBackendApi()) return getRechargePlans()
  return requestBackend({ url: '/api/v1/recharge/plans' }).catch(() => getRechargePlans())
}

export const createRechargeQuoteFromBackend = (plan) => {
  if (!hasBackendApi()) return calculateRechargeQuote({ plan })
  return requestBackend({
    url: '/api/v1/recharge/quotes',
    method: 'POST',
    data: { planId: plan.id }
  }).catch(() => calculateRechargeQuote({ plan }))
}
