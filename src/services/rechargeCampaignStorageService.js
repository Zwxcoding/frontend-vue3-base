import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { getStorage } from '../utils/storage.js'

const STORAGE_MISSING = Object.freeze({ missing: true })

export const getStoredRechargeCampaigns = () => {
  const stored = getStorage(STORAGE_KEYS.RECHARGE_CAMPAIGNS, STORAGE_MISSING)
  if (stored === STORAGE_MISSING) return null
  return Array.isArray(stored) ? stored.map((campaign) => ({ ...campaign })) : []
}

