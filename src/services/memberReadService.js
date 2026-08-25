import { createMember } from '../models/member.js'
import { hasBackendApi, requestBackend } from '../utils/api.js'
import { getMemberInfo } from './memberService.js'

export const MEMBER_READ_MODES = Object.freeze({
  SHADOW: 'shadow',
  DATABASE_FIRST: 'database-first'
})

const configuredReadMode = () => globalThis.__CAR_WASH_MEMBER_READ_MODE__ || import.meta.env.VITE_MEMBER_READ_MODE
const configuredMemberToken = () => globalThis.__CAR_WASH_DEV_MEMBER_TOKEN__ || import.meta.env.VITE_DEV_MEMBER_TOKEN || ''

const getReadMode = () => configuredReadMode() === MEMBER_READ_MODES.DATABASE_FIRST
  ? MEMBER_READ_MODES.DATABASE_FIRST
  : MEMBER_READ_MODES.SHADOW

const getIdentityHeader = () => ({
  'x-dev-member-token': configuredMemberToken()
})

const normalizeDatabaseMember = (member, account) => createMember({
  registered: member?.status === 'active',
  phone: member?.mobile || '',
  name: member?.name || '',
  balance: account?.balance || 0
})

const compareSnapshots = (legacy, database) => ({
  balanceMatches: legacy.balance === database.balance,
  phoneMatches: !legacy.phone || !database.phone || legacy.phone === database.phone,
  legacyBalance: legacy.balance,
  databaseBalance: database.balance
})

export const fetchDatabaseMemberSnapshot = async () => {
  const header = getIdentityHeader()
  const [member, account] = await Promise.all([
    requestBackend({ url: '/api/v1/members/me', header }),
    requestBackend({ url: '/api/v1/accounts/me', header })
  ])
  return { member: normalizeDatabaseMember(member, account), account, source: 'database' }
}

export const getMemberReadSnapshot = async () => {
  const legacy = getMemberInfo()
  if (!hasBackendApi()) return { member: legacy, source: 'legacy-storage', comparison: null }

  try {
    const database = await fetchDatabaseMemberSnapshot()
    const comparison = compareSnapshots(legacy, database.member)
    if (!comparison.balanceMatches || !comparison.phoneMatches) {
      console.warn('[member-shadow] Database and legacy member data differ', comparison)
    }
    if (getReadMode() === MEMBER_READ_MODES.DATABASE_FIRST) {
      return { ...database, comparison }
    }
    return { member: legacy, source: 'legacy-storage', shadowSource: 'database', comparison }
  } catch (error) {
    console.warn('[member-read] Database read unavailable; using legacy Storage', error)
    return { member: legacy, source: 'legacy-storage', comparison: null }
  }
}
