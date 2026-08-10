const ROLE_PERMISSIONS = Object.freeze({
  ADMIN: Object.freeze(['VIEW', 'CREATE', 'UPDATE', 'ENABLE', 'DELETE', 'APPROVE']),
  OPERATOR: Object.freeze(['VIEW', 'CREATE', 'UPDATE', 'ENABLE']),
  VIEWER: Object.freeze(['VIEW'])
})

export const DEFAULT_ADMIN_ACTOR = Object.freeze({
  id: 'admin',
  username: 'admin',
  role: 'ADMIN',
  status: 'active'
})

export const getAdminUsers = () => {
  const users = getStorage(STORAGE_KEYS.ADMIN_USERS, [DEFAULT_ADMIN_ACTOR])
  return Array.isArray(users) ? users.map((user) => ({ ...user })) : []
}

export const getAdminUserByUsername = (username) => getAdminUsers()
  .find((user) => user.username === username) || null

export const hasAdminPermission = (actor, permission) => {
  if (!actor || actor.status === 'inactive') return false
  return (ROLE_PERMISSIONS[actor.role] || []).includes(permission)
}

export const assertAdminPermission = (actor = DEFAULT_ADMIN_ACTOR, permission) => {
  if (!hasAdminPermission(actor, permission)) {
    throw new Error(`当前角色无${permission}权限`)
  }
  return true
}
import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { getStorage } from '../utils/storage.js'

