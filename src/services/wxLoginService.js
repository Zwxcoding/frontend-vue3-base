import { hasBackendApi, requestBackend } from '../utils/api.js'

const SESSION_TOKEN_STORAGE_KEY = 'wxSessionToken'
const SESSION_MEMBER_ID_KEY = 'wxSessionMemberId'
const SESSION_EXPIRES_AT_KEY = 'wxSessionExpiresAt'

const safeGetStorage = (key) => {
  try {
    if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return ''
    return uni.getStorageSync(key) || ''
  } catch {
    return ''
  }
}

const safeSetStorage = (key, value) => {
  try {
    if (typeof uni === 'undefined' || typeof uni.setStorageSync !== 'function') return
    uni.setStorageSync(key, value)
  } catch {
    /* ignore */
  }
}

const safeRemoveStorage = (key) => {
  try {
    if (typeof uni === 'undefined' || typeof uni.removeStorageSync !== 'function') return
    uni.removeStorageSync(key)
  } catch {
    /* ignore */
  }
}

export const getStoredSessionToken = () => safeGetStorage(SESSION_TOKEN_STORAGE_KEY)

export const getStoredSessionMemberId = () => safeGetStorage(SESSION_MEMBER_ID_KEY)

export const getStoredSessionExpiresAt = () => safeGetStorage(SESSION_EXPIRES_AT_KEY)

const callWxLogin = () => new Promise((resolve, reject) => {
  if (typeof uni === 'undefined' || typeof uni.login !== 'function') {
    reject(new Error('uni.login is unavailable in current environment'))
    return
  }
  uni.login({
    success: (response) => {
      if (response?.code) {
        resolve(response.code)
        return
      }
      reject(new Error(response?.errMsg || 'uni.login returned no code'))
    },
    fail: (error) => reject(new Error(error?.errMsg || 'uni.login failed'))
  })
})

const persistSession = ({ memberId, sessionToken, expiresAt }) => {
  safeSetStorage(SESSION_TOKEN_STORAGE_KEY, sessionToken)
  safeSetStorage(SESSION_MEMBER_ID_KEY, memberId)
  if (expiresAt) safeSetStorage(SESSION_EXPIRES_AT_KEY, expiresAt)
}

const clearSession = () => {
  safeRemoveStorage(SESSION_TOKEN_STORAGE_KEY)
  safeRemoveStorage(SESSION_MEMBER_ID_KEY)
  safeRemoveStorage(SESSION_EXPIRES_AT_KEY)
}

export const isSessionExpired = (now = Date.now()) => {
  const expiresAt = getStoredSessionExpiresAt()
  if (!expiresAt) return false
  const expiresAtMs = Date.parse(expiresAt)
  if (Number.isNaN(expiresAtMs)) return false
  return expiresAtMs <= now
}

export const loginWithWx = async ({ force = false } = {}) => {
  if (!hasBackendApi()) {
    throw new Error('Backend API is unavailable in current environment')
  }
  if (!force) {
    const existing = getStoredSessionToken()
    if (existing && !isSessionExpired()) {
      return { memberId: getStoredSessionMemberId(), sessionToken: existing, expiresAt: getStoredSessionExpiresAt() }
    }
  }
  const code = await callWxLogin()
  const data = await requestBackend({ url: '/api/v1/auth/wx-login', method: 'POST', data: { code } })
  if (!data?.sessionToken || !data?.memberId) {
    throw new Error('wx-login response missing sessionToken or memberId')
  }
  persistSession(data)
  return data
}

export const ensureLogin = async () => {
  if (!hasBackendApi()) return null
  if (getStoredSessionToken() && !isSessionExpired()) {
    return { memberId: getStoredSessionMemberId(), sessionToken: getStoredSessionToken() }
  }
  try {
    return await loginWithWx({ force: true })
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)) || ''
    if (/MEMBER_NOT_REGISTERED|401|Unauthorized|not registered/i.test(message)) {
      return null
    }
    throw error
  }
}

export const logoutWx = async () => {
  if (!hasBackendApi()) {
    clearSession()
    return { ok: true }
  }
  const token = getStoredSessionToken()
  clearSession()
  if (!token) return { ok: true }
  try {
    await requestBackend({
      url: '/api/v1/auth/logout',
      method: 'POST',
      header: { 'x-session-token': token }
    })
  } catch {
    /* ignore network errors on logout */
  }
  return { ok: true }
}

export const buildSessionIdentityHeader = () => {
  const token = getStoredSessionToken()
  if (!token) return {}
  return { 'x-session-token': token }
}
