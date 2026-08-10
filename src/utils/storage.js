import { STORAGE_LEGACY_KEYS } from '../constants/storageKeys.js'

const hasValue = (value) => value !== undefined && value !== null && value !== ''

export const getStorage = (key, defaultValue = null) => {
  try {
    const value = uni.getStorageSync(key)
    if (hasValue(value)) return value

    const legacyKeys = STORAGE_LEGACY_KEYS[key] || []
    for (const legacyKey of legacyKeys) {
      const legacyValue = uni.getStorageSync(legacyKey)
      if (hasValue(legacyValue)) return legacyValue
    }
  } catch (error) {
    console.warn(`[storage] failed to read ${key}`, error)
  }
  return defaultValue
}

export const setStorage = (key, value) => {
  try {
    uni.setStorageSync(key, value)
    return true
  } catch (error) {
    console.warn(`[storage] failed to write ${key}`, error)
    return false
  }
}

export const removeStorage = (key) => {
  try {
    uni.removeStorageSync(key)
    return true
  } catch (error) {
    console.warn(`[storage] failed to remove ${key}`, error)
    return false
  }
}
