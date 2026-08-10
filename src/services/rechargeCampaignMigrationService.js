import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { getStorage, setStorage } from '../utils/storage.js'
import { calculateRechargeQuote } from './rechargeQuoteService.js'
import { getStoredRechargeCampaigns } from './rechargeCampaignStorageService.js'

const MIGRATION_VERSION = 1
const PENDING_STATE = Object.freeze({
  version: MIGRATION_VERSION,
  campaignMigrationStatus: 'pending',
  migratedCount: 0,
  migratedAt: null,
  errorMessage: ''
})

const toNumber = (value, field, activityId) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    throw new Error(`Activity ${activityId ?? 'unknown'} 的${field}无效`)
  }
  return number
}

const readLegacyActivities = () => {
  const activities = getStorage(STORAGE_KEYS.ACTIVITIES, [])
  return Array.isArray(activities) ? activities : []
}

const writeMigrationState = (state) => {
  const saved = setStorage(STORAGE_KEYS.RECHARGE_MIGRATION_STATE, state)
  if (!saved) throw new Error('充值活动迁移状态保存失败')
  return state
}

export const getRechargeMigrationState = () => {
  const state = getStorage(STORAGE_KEYS.RECHARGE_MIGRATION_STATE, null)
  return state && typeof state === 'object'
    ? { ...PENDING_STATE, ...state }
    : { ...PENDING_STATE }
}

export const convertActivityToRechargeCampaign = (activity, now = new Date().toISOString()) => {
  if (!activity || activity.type !== 'recharge') {
    throw new Error('仅支持迁移recharge Activity')
  }
  if (activity.id === undefined || activity.id === null || activity.id === '') {
    throw new Error('Recharge Activity缺少id')
  }

  const thresholdAmount = toNumber(
    activity.thresholdAmount ??
      activity.rechargeAmount ??
      activity.rule?.thresholdAmount ??
      activity.rule?.rechargeAmount,
    '充值门槛',
    activity.id
  )
  const bonusAmount = toNumber(
    activity.bonusAmount ??
      activity.giftAmount ??
      activity.bonus ??
      activity.rule?.bonusAmount,
    '赠送金额',
    activity.id
  )
  const priority = toNumber(activity.priority ?? 0, '优先级', activity.id)
  if (thresholdAmount < 0 || bonusAmount < 0) {
    throw new Error(`Activity ${activity.id} 的金额不能为负数`)
  }

  return {
    id: `campaign_${activity.id}`,
    activityId: activity.id,
    name: activity.name || activity.activityName || '充值活动',
    type: 'recharge',
    thresholdAmount,
    bonusAmount,
    effectMode: 'override',
    priority,
    status: activity.status === 'inactive' ? 'inactive' : 'active',
    startTime: activity.startTime || activity.startDate || '',
    endTime: activity.endTime || activity.endDate || '',
    source: 'migration',
    version: MIGRATION_VERSION,
    createTime: now,
    updateTime: now
  }
}

export const migrateRechargeCampaigns = () => {
  const startedAt = new Date().toISOString()
  writeMigrationState({
    version: MIGRATION_VERSION,
    campaignMigrationStatus: 'running',
    migratedCount: 0,
    migratedAt: null,
    errorMessage: ''
  })

  const legacyActivities = readLegacyActivities()
  const rechargeActivities = legacyActivities.filter((activity) => activity?.type === 'recharge')
  const existingCampaigns = getStoredRechargeCampaigns() || []
  const campaigns = existingCampaigns.map((campaign) => ({ ...campaign }))
  const existingActivityIds = new Set(
    campaigns.map((campaign) => String(campaign.activityId ?? campaign.id))
  )
  const errors = []

  for (const activity of rechargeActivities) {
    const activityKey = String(activity?.id)
    if (existingActivityIds.has(activityKey) || existingActivityIds.has(`campaign_${activityKey}`)) {
      continue
    }
    try {
      const campaign = convertActivityToRechargeCampaign(activity, startedAt)
      campaigns.push(campaign)
      existingActivityIds.add(String(campaign.activityId))
    } catch (error) {
      errors.push(error.message || String(error))
    }
  }

  if (!setStorage(STORAGE_KEYS.RECHARGE_CAMPAIGNS, campaigns)) {
    errors.push('rechargeCampaigns保存失败')
  }

  const migratedActivityIds = new Set(
    campaigns.map((campaign) => String(campaign.activityId ?? campaign.id))
  )
  const migratedCount = rechargeActivities.filter((activity) =>
    migratedActivityIds.has(String(activity?.id))
  ).length
  const state = {
    version: MIGRATION_VERSION,
    campaignMigrationStatus: errors.length > 0 ? 'failed' : 'completed',
    migratedCount,
    migratedAt: new Date().toISOString(),
    errorMessage: errors.join('; ')
  }
  writeMigrationState(state)

  return {
    campaigns,
    state,
    errors
  }
}

const pickQuoteAmounts = (quote) => ({
  amount: quote.amount,
  baseBonus: quote.baseBonus,
  campaignBonus: quote.campaignBonus,
  finalBonus: quote.finalBonus,
  totalAmount: quote.totalAmount
})

export const compareRechargeQuoteBeforeAfterMigration = ({
  plan,
  legacyActivities = readLegacyActivities(),
  migratedCampaigns = getStoredRechargeCampaigns() || []
} = {}) => {
  const legacyQuote = calculateRechargeQuote({
    plan,
    currentActivities: legacyActivities.filter((activity) => activity?.type === 'recharge')
  })
  const migratedQuote = calculateRechargeQuote({
    plan,
    currentActivities: migratedCampaigns
  })
  const legacyAmounts = pickQuoteAmounts(legacyQuote)
  const migratedAmounts = pickQuoteAmounts(migratedQuote)

  return {
    matched: Object.keys(legacyAmounts).every(
      (field) => legacyAmounts[field] === migratedAmounts[field]
    ),
    legacyQuote,
    migratedQuote,
    legacyAmounts,
    migratedAmounts
  }
}

