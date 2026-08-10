import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { getStorage } from '../utils/storage.js'
import { getRechargeActivities } from './activityService.js'
import { prepareRechargeCampaignsForShadow } from './rechargeCampaignSwitchService.js'

export const DEFAULT_RECHARGE_SOURCE_SWITCH = Object.freeze({
  source: 'legacy',
  fallbackEnabled: true
})

export const PRODUCTION_RECHARGE_SOURCE_SWITCH = Object.freeze({
  source: 'campaign',
  fallbackEnabled: true
})

const STORAGE_MISSING = Object.freeze({ missing: true })
const rechargeSourceFallbackLog = []

const isDevelopment = () => (
  typeof process !== 'undefined' &&
  process.env?.NODE_ENV !== 'production'
)

const normalizeSwitch = (config = DEFAULT_RECHARGE_SOURCE_SWITCH) => ({
  source: config?.source === 'campaign' ? 'campaign' : 'legacy',
  fallbackEnabled: config?.fallbackEnabled !== false
})

const readCampaignStorage = () => {
  const stored = getStorage(STORAGE_KEYS.RECHARGE_CAMPAIGNS, STORAGE_MISSING)
  if (stored === STORAGE_MISSING) {
    throw new Error('rechargeCampaigns不存在')
  }
  if (!Array.isArray(stored)) {
    throw new Error('rechargeCampaigns数据结构无效')
  }
  for (const campaign of stored) {
    if (
      !campaign ||
      typeof campaign !== 'object' ||
      campaign.type !== 'recharge' ||
      !Number.isFinite(Number(campaign.thresholdAmount)) ||
      !Number.isFinite(Number(campaign.bonusAmount))
    ) {
      throw new Error('rechargeCampaigns包含无效数据')
    }
  }
  return prepareRechargeCampaignsForShadow(stored)
}

const readMigrationState = () => {
  const state = getStorage(STORAGE_KEYS.RECHARGE_MIGRATION_STATE, null)
  return state && typeof state === 'object'
    ? state
    : { campaignMigrationStatus: 'pending' }
}

export const getRechargeSourceFallbackLog = () => (
  rechargeSourceFallbackLog.map((entry) => ({ ...entry }))
)

export const clearRechargeSourceFallbackLog = () => {
  rechargeSourceFallbackLog.splice(0, rechargeSourceFallbackLog.length)
}

export const recordRechargeSourceFallback = (reason) => {
  const log = {
    time: new Date().toISOString(),
    source: 'campaign',
    fallback: 'legacy',
    reason: reason?.message || String(reason)
  }
  if (isDevelopment()) {
    rechargeSourceFallbackLog.push(log)
    console.warn('[RechargeSourceSwitch] Campaign回退Legacy', log)
  }
  return log
}

export const getLegacyRechargeSource = () => getRechargeActivities()

export const resolveRechargeSource = ({
  config = PRODUCTION_RECHARGE_SOURCE_SWITCH
} = {}) => {
  const sourceSwitch = normalizeSwitch(config)
  if (sourceSwitch.source === 'legacy') {
    return {
      source: 'legacy',
      activities: getLegacyRechargeSource(),
      fallbackEnabled: sourceSwitch.fallbackEnabled,
      fallbackReason: ''
    }
  }

  try {
    const migrationState = readMigrationState()
    if (migrationState.campaignMigrationStatus !== 'completed') {
      throw new Error(`充值活动迁移状态为${migrationState.campaignMigrationStatus}`)
    }
    return {
      source: 'campaign',
      activities: readCampaignStorage(),
      fallbackEnabled: sourceSwitch.fallbackEnabled,
      fallbackReason: ''
    }
  } catch (error) {
    if (!sourceSwitch.fallbackEnabled) throw error
    recordRechargeSourceFallback(error)
    return {
      source: 'legacy',
      activities: getLegacyRechargeSource(),
      fallbackEnabled: true,
      fallbackReason: error.message || String(error)
    }
  }
}
