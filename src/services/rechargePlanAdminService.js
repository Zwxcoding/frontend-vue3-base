import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { setStorage } from '../utils/storage.js'
import { getStoredRechargePlans, initializeRechargeStorage } from './rechargePlanStorageService.js'
import { assertAdminPermission, DEFAULT_ADMIN_ACTOR } from './adminPermissionService.js'
import { createOperationLog } from './operationLogService.js'
import { hasBackendApi, requestBackend } from '../utils/api.js'

const VALID_STATUSES = ['active', 'inactive']

const getPlans = () => {
  const stored = getStoredRechargePlans()
  return (stored === null ? initializeRechargeStorage() : stored).map((plan) => ({ ...plan }))
}

const savePlans = (plans) => {
  if (!setStorage(STORAGE_KEYS.RECHARGE_PLANS, plans)) throw new Error('充值套餐保存失败')
}

const writePlanLog = ({
  actor,
  operationType,
  targetId,
  beforeData,
  afterData,
  reason = ''
}) => createOperationLog({
  operator: actor.username || actor.id || '',
  operatorRole: actor.role,
  operationType,
  targetType: 'RechargePlan',
  targetId,
  beforeData,
  afterData,
  reason
})

const validatePlan = (data, plans, editingId = null) => {
  const name = String(data.name || '').trim()
  const amount = Number(data.amount)
  const baseBonus = Number(data.baseBonus)
  const status = data.status || 'active'
  const sort = Number(data.sort ?? 0)
  if (!name) throw new Error('套餐名称不能为空')
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('充值金额必须为大于0的整数')
  if (!Number.isFinite(baseBonus) || baseBonus < 0) throw new Error('基础赠送金额不能小于0')
  if (!VALID_STATUSES.includes(status)) throw new Error('套餐状态无效')
  if (!Number.isFinite(sort)) throw new Error('套餐排序必须为数字')
  const duplicate = plans.find((plan) =>
    String(plan.id) !== String(editingId) &&
    Number(plan.amount) === amount &&
    plan.status === status
  )
  if (duplicate) throw new Error('存在相同充值金额套餐')
  return { name, amount, baseBonus, status, sort }
}

export const getRechargePlansForAdmin = (actor = DEFAULT_ADMIN_ACTOR) => {
  if (hasBackendApi()) {
    return requestBackend({ url: '/api/admin/recharge/plans' })
      .catch(() => getPlans().sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0)))
  }
  assertAdminPermission(actor, 'VIEW')
  return getPlans().sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
}

export const createRechargePlan = (data = {}, actor = DEFAULT_ADMIN_ACTOR) => {
  if (hasBackendApi()) return requestBackend({ url: '/api/admin/recharge/plans', method: 'POST', data })
  assertAdminPermission(actor, 'CREATE')
  const plans = getPlans()
  const normalized = validatePlan(data, plans)
  const now = new Date().toISOString()
  const plan = {
    id: data.id || `plan_${Date.now()}`,
    ...normalized,
    version: 1,
    source: 'admin',
    createTime: now,
    updateTime: now
  }
  savePlans([...plans, plan])
  writePlanLog({
    actor,
    operationType: 'CREATE',
    targetId: plan.id,
    beforeData: null,
    afterData: plan,
    reason: data.operationReason || ''
  })
  return { ...plan }
}

export const updateRechargePlan = (id, data = {}, actor = DEFAULT_ADMIN_ACTOR) => {
  if (hasBackendApi()) return requestBackend({ url: `/api/admin/recharge/plans/${id}`, method: 'PUT', data })
  assertAdminPermission(actor, 'UPDATE')
  const plans = getPlans()
  const index = plans.findIndex((plan) => String(plan.id) === String(id))
  if (index < 0) throw new Error('充值套餐不存在')
  const current = plans[index]
  const normalized = validatePlan({ ...current, ...data }, plans, current.id)
  const updated = {
    ...current,
    ...normalized,
    id: current.id,
    version: Number(current.version || 0) + 1,
    source: 'admin',
    createTime: current.createTime || new Date().toISOString(),
    updateTime: new Date().toISOString()
  }
  plans.splice(index, 1, updated)
  savePlans(plans)
  writePlanLog({
    actor,
    operationType: 'UPDATE',
    targetId: updated.id,
    beforeData: current,
    afterData: updated,
    reason: data.operationReason || ''
  })
  return { ...updated }
}

const changePlanStatus = (id, status, operationType, actor, reason = '') => {
  assertAdminPermission(actor, 'ENABLE')
  const plans = getPlans()
  const index = plans.findIndex((plan) => String(plan.id) === String(id))
  if (index < 0) throw new Error('充值套餐不存在')
  const current = plans[index]
  const normalized = validatePlan({ ...current, status }, plans, current.id)
  const updated = {
    ...current,
    ...normalized,
    version: Number(current.version || 0) + 1,
    source: 'admin',
    updateTime: new Date().toISOString()
  }
  plans.splice(index, 1, updated)
  savePlans(plans)
  writePlanLog({
    actor,
    operationType,
    targetId: updated.id,
    beforeData: current,
    afterData: updated,
    reason
  })
  return { ...updated }
}

export const disableRechargePlan = (
  id,
  actor = DEFAULT_ADMIN_ACTOR,
  reason = ''
) => hasBackendApi()
  ? requestBackend({ url: `/api/admin/recharge/plans/${id}/status`, method: 'PATCH', data: { status: 'inactive', operationReason: reason } })
  : changePlanStatus(id, 'inactive', 'DISABLE', actor, reason)

export const enableRechargePlan = (
  id,
  actor = DEFAULT_ADMIN_ACTOR,
  reason = ''
) => hasBackendApi()
  ? requestBackend({ url: `/api/admin/recharge/plans/${id}/status`, method: 'PATCH', data: { status: 'active', operationReason: reason } })
  : changePlanStatus(id, 'active', 'ENABLE', actor, reason)

export const deleteRechargePlan = (
  id,
  actor = DEFAULT_ADMIN_ACTOR,
  reason = ''
) => {
  if (hasBackendApi()) {
    return requestBackend({ url: `/api/admin/recharge/plans/${id}/status`, method: 'PATCH', data: { status: 'inactive', operationReason: reason } })
  }
  assertAdminPermission(actor, 'DELETE')
  return changePlanStatus(id, 'inactive', 'DELETE', actor, reason)
}
