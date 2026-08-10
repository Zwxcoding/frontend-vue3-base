import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { createMember } from '../models/member.js'
import { getStorage, setStorage } from '../utils/storage.js'

export const getMemberInfo = () => {
  const stored = getStorage(STORAGE_KEYS.MEMBER_INFO, null)
  if (stored && typeof stored === 'object') return createMember(stored)

  const legacyBalance = getStorage(STORAGE_KEYS.MEMBER_BALANCE, 0)
  return createMember({ balance: legacyBalance })
}

export const saveMemberInfo = (data = {}) => {
  const member = createMember({ ...getMemberInfo(), ...data })
  setStorage(STORAGE_KEYS.MEMBER_INFO, member)
  return member
}

export const updateBalance = (balance) => saveMemberInfo({ balance })
