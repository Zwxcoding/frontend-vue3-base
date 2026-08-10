import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { setStorage } from '../utils/storage.js'
import { calculateRechargeQuote } from './rechargeQuoteService.js'
import { getStoredRechargeCampaigns } from './rechargeCampaignStorageService.js'
import { getRechargePlanByAmount } from './rechargePlanService.js'
import {
  assertAdminPermission,
  DEFAULT_ADMIN_ACTOR
} from './adminPermissionService.js'
import {
  createOperationLog,
  getTargetHistory
} from './operationLogService.js'
import { hasBackendApi, requestBackend } from '../utils/api.js'

const VALID_STATUSES = ['active', 'inactive']
const VALID_APPROVAL_STATUSES = ['draft', 'pending', 'approved', 'rejected']

const getCampaigns = () => (getStoredRechargeCampaigns() || []).map((item) => ({ ...item }))

const saveCampaigns = (campaigns) => {
  if (!setStorage(STORAGE_KEYS.RECHARGE_CAMPAIGNS, campaigns)) {
    throw new Error('充值营销活动保存失败')
  }
}

const parseTime = (value) => {
  if (!value) return NaN
  return new Date(value).getTime()
}

export const validateRechargeCampaign = (data = {}) => {
  const name = String(data.name || '').trim()
  const thresholdAmount = Number(data.thresholdAmount)
  const bonusAmount = Number(data.bonusAmount)
  const priority = Number(data.priority)
  const status = data.status || 'active'
  const effectMode = data.effectMode || 'override'
  const startTime = String(data.startTime || '').trim()
  const endTime = String(data.endTime || '').trim()
  const approvalStatus = data.approvalStatus || 'draft'

  if (!name) throw new Error('活动名称不能为空')
  if (!Number.isInteger(thresholdAmount) || thresholdAmount <= 0) {
    throw new Error('充值门槛必须为大于0的整数')
  }
  if (!Number.isFinite(bonusAmount) || bonusAmount < 0) {
    throw new Error('赠送金额不能小于0')
  }
  if (!Number.isFinite(priority)) throw new Error('活动优先级必须为数字')
  if (!VALID_STATUSES.includes(status)) throw new Error('活动状态无效')
  if (effectMode !== 'override') throw new Error('活动生效模式仅支持override')
  if (!VALID_APPROVAL_STATUSES.includes(approvalStatus)) throw new Error('活动审批状态无效')
  const startTimestamp = parseTime(startTime)
  const endTimestamp = parseTime(endTime)
  if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
    throw new Error('活动时间无效')
  }
  if (startTimestamp > endTimestamp) throw new Error('活动开始时间不能晚于结束时间')

  return {
    name,
    type: 'recharge',
    thresholdAmount,
    bonusAmount,
    effectMode,
    priority,
    status,
    startTime,
    endTime,
    operator: String(data.operator || ''),
    operationReason: String(data.operationReason || ''),
    approvalStatus
  }
}

const rangesOverlap = (left, right) => (
  parseTime(left.startTime) <= parseTime(right.endTime) &&
  parseTime(right.startTime) <= parseTime(left.endTime)
)

export const checkRechargeCampaignConflicts = (data, editingId = null) => {
  const conflictCampaigns = getCampaigns().filter((campaign) =>
    String(campaign.id) !== String(editingId) &&
    campaign.type === 'recharge' &&
    Number(campaign.thresholdAmount) === Number(data.thresholdAmount) &&
    rangesOverlap(campaign, data)
  )
  return {
    warning: conflictCampaigns.length > 0,
    conflictCampaigns
  }
}

const writeCampaignLog = ({
  actor,
  operationType,
  targetId,
  beforeData,
  afterData,
  reason
}) => createOperationLog({
  operator: actor.username || actor.id || '',
  operatorRole: actor.role,
  operationType,
  targetType: 'RechargeCampaign',
  targetId,
  beforeData,
  afterData,
  reason
})

export const getRechargeCampaignsForAdmin = (actor = DEFAULT_ADMIN_ACTOR) => {
  if (hasBackendApi()) {
    return requestBackend({ url: '/api/admin/recharge/campaigns' })
      .catch(() => getCampaigns().filter((item) => item.type === 'recharge'))
  }
  assertAdminPermission(actor, 'VIEW')
  return getCampaigns()
    .filter((campaign) => campaign.type === 'recharge')
    .sort((a, b) =>
      Number(b.priority || 0) - Number(a.priority || 0) ||
      Number(b.activityId || 0) - Number(a.activityId || 0)
    )
}

export const createRechargeCampaign = (data = {}, actor = DEFAULT_ADMIN_ACTOR) => {
  if (hasBackendApi()) return requestBackend({ url: '/api/admin/recharge/campaigns', method: 'POST', data: { ...data, type: 'recharge', effectMode: 'override' } })
  assertAdminPermission(actor, 'CREATE')
  const normalized = validateRechargeCampaign({ ...data, approvalStatus: 'draft' })
  const conflict = checkRechargeCampaignConflicts(normalized)
  const campaigns = getCampaigns()
  const now = new Date().toISOString()
  const activityId = data.activityId ?? Date.now()
  const campaign = {
    id: data.id || `campaign_admin_${activityId}`,
    activityId,
    ...normalized,
    version: 1,
    source: 'admin',
    createTime: now,
    updateTime: now
  }
  saveCampaigns([...campaigns, campaign])
  writeCampaignLog({
    actor,
    operationType: 'CREATE',
    targetId: campaign.id,
    beforeData: null,
    afterData: campaign,
    reason: campaign.operationReason
  })
  return { ...campaign, ...conflict }
}

export const updateRechargeCampaign = (id, data = {}, actor = DEFAULT_ADMIN_ACTOR) => {
  if (hasBackendApi()) return requestBackend({ url: `/api/admin/recharge/campaigns/${id}`, method: 'PUT', data: { ...data, type: 'recharge', effectMode: 'override' } })
  assertAdminPermission(actor, 'UPDATE')
  const campaigns = getCampaigns()
  const index = campaigns.findIndex((campaign) => String(campaign.id) === String(id))
  if (index < 0) throw new Error('充值营销活动不存在')
  const current = campaigns[index]
  const normalized = validateRechargeCampaign({ ...current, ...data })
  const conflict = checkRechargeCampaignConflicts(normalized, current.id)
  const updated = {
    ...current,
    ...normalized,
    id: current.id,
    activityId: current.activityId,
    version: Number(current.version || 0) + 1,
    source: 'admin',
    createTime: current.createTime || new Date().toISOString(),
    updateTime: new Date().toISOString()
  }
  campaigns.splice(index, 1, updated)
  saveCampaigns(campaigns)
  writeCampaignLog({
    actor,
    operationType: 'UPDATE',
    targetId: updated.id,
    beforeData: current,
    afterData: updated,
    reason: updated.operationReason
  })
  return { ...updated, ...conflict }
}

const changeCampaignStatus = (id, status, operationType, operation, actor) => {
  assertAdminPermission(actor, 'ENABLE')
  const campaigns = getCampaigns()
  const index = campaigns.findIndex((campaign) => String(campaign.id) === String(id))
  if (index < 0) throw new Error('充值营销活动不存在')
  const current = campaigns[index]
  const normalized = validateRechargeCampaign({ ...current, ...operation, status })
  const updated = {
    ...current,
    ...normalized,
    id: current.id,
    activityId: current.activityId,
    version: Number(current.version || 0) + 1,
    source: 'admin',
    updateTime: new Date().toISOString()
  }
  campaigns.splice(index, 1, updated)
  saveCampaigns(campaigns)
  writeCampaignLog({
    actor,
    operationType,
    targetId: updated.id,
    beforeData: current,
    afterData: updated,
    reason: updated.operationReason
  })
  return { ...updated }
}

export const disableRechargeCampaign = (
  id,
  operation = {},
  actor = DEFAULT_ADMIN_ACTOR
) => hasBackendApi()
  ? requestBackend({ url: `/api/admin/recharge/campaigns/${id}/status`, method: 'PATCH', data: { ...operation, status: 'inactive' } })
  : changeCampaignStatus(id, 'inactive', 'DISABLE', operation, actor)

export const enableRechargeCampaign = (
  id,
  operation = {},
  actor = DEFAULT_ADMIN_ACTOR
) => hasBackendApi()
  ? requestBackend({ url: `/api/admin/recharge/campaigns/${id}/status`, method: 'PATCH', data: { ...operation, status: 'active' } })
  : changeCampaignStatus(id, 'active', 'ENABLE', operation, actor)

export const deleteRechargeCampaign = (
  id,
  operation = {},
  actor = DEFAULT_ADMIN_ACTOR
) => {
  if (hasBackendApi()) {
    return requestBackend({ url: `/api/admin/recharge/campaigns/${id}/status`, method: 'PATCH', data: { ...operation, status: 'inactive' } })
  }
  assertAdminPermission(actor, 'DELETE')
  return changeCampaignStatus(id, 'inactive', 'DELETE', operation, actor)
}

const changeApprovalStatus = (id, approvalStatus, actor, reason = '') => {
  assertAdminPermission(actor, approvalStatus === 'pending' ? 'UPDATE' : 'APPROVE')
  return updateRechargeCampaign(id, {
    approvalStatus,
    operator: actor.username || actor.id || '',
    operationReason: reason
  }, actor)
}

export const submitRechargeCampaignForApproval = (
  id,
  actor = DEFAULT_ADMIN_ACTOR,
  reason = ''
) => changeApprovalStatus(id, 'pending', actor, reason)

export const approveRechargeCampaign = (
  id,
  actor = DEFAULT_ADMIN_ACTOR,
  reason = ''
) => changeApprovalStatus(id, 'approved', actor, reason)

export const rejectRechargeCampaign = (
  id,
  actor = DEFAULT_ADMIN_ACTOR,
  reason = ''
) => changeApprovalStatus(id, 'rejected', actor, reason)

export const getCampaignVersionHistory = (
  id,
  actor = DEFAULT_ADMIN_ACTOR
) => {
  assertAdminPermission(actor, 'VIEW')
  return getTargetHistory('RechargeCampaign', id)
    .filter((log) => log.afterData)
    .map((log) => ({
      version: log.afterData.version,
      bonusAmount: log.afterData.bonusAmount,
      operator: log.operator,
      time: log.createTime,
      operationType: log.operationType,
      data: log.afterData
    }))
    .sort((a, b) => Number(a.version || 0) - Number(b.version || 0))
}

export const checkRechargeCampaignPublishRisk = (data = {}) => {
  if (hasBackendApi()) return { pass: true, warnings: [], errors: [] }
  const warnings = []
  const errors = []
  let normalized = null
  try {
    normalized = validateRechargeCampaign(data)
  } catch (error) {
    errors.push(error.message || String(error))
  }
  if (normalized) {
    const conflict = checkRechargeCampaignConflicts(normalized, data.id)
    if (conflict.warning) {
      warnings.push('存在同门槛且有效期重叠的充值活动')
      if (conflict.conflictCampaigns.some((item) =>
        Number(item.priority) > normalized.priority
      )) {
        warnings.push('存在更高priority活动，当前活动可能不会生效')
      }
    }
    const plan = getRechargePlanByAmount(normalized.thresholdAmount)
    if (plan && normalized.bonusAmount < Number(plan.bonusAmount || 0)) {
      warnings.push('活动赠送低于套餐基础赠送，上线后用户收益可能下降')
    }
  }
  return {
    pass: errors.length === 0,
    warnings,
    errors
  }
}

export const previewRechargeCampaign = (amount) => {
  if (hasBackendApi()) {
    return requestBackend({ url: '/api/admin/recharge/campaigns/preview', method: 'POST', data: { amount } })
      .then((result) => result.quote)
  }
  const plan = getRechargePlanByAmount(amount)
  if (!plan) throw new Error('未找到对应充值套餐')
  return calculateRechargeQuote({ plan })
}

export const previewRechargeCampaignTrace = (amount) => {
  if (hasBackendApi()) return requestBackend({ url: '/api/admin/recharge/campaigns/preview', method: 'POST', data: { amount } })
  const quote = previewRechargeCampaign(amount)
  return {
    quote,
    trace: {
      amount: quote.amount,
      planName: quote.plan?.name || '',
      baseBonus: quote.baseBonus,
      campaignName: quote.campaign?.name || '',
      campaignBonus: quote.campaignBonus,
      effectMode: quote.effectMode,
      finalBonus: quote.finalBonus,
      totalAmount: quote.totalAmount
    }
  }
}
