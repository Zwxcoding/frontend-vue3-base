import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { createConsumeRecord, normalizeConsumeRecord } from '../models/consume.js'
import { getStorage, setStorage } from '../utils/storage.js'
import { getBestActivity, getDiscountActivities } from './activityService.js'
import { getMemberInfo, updateBalance } from './memberService.js'

export const getConsumeRecords = () => {
  const records = getStorage(STORAGE_KEYS.CONSUME_RECORDS, [])
  return (Array.isArray(records) ? records : []).map(normalizeConsumeRecord).sort((a, b) => b.id - a.id)
}

export const calculateConsumption = ({ servicePrice, currentActivities = [], memberInfo = null }) => {
  const originalPrice = Number(servicePrice)
  if (!Number.isFinite(originalPrice) || originalPrice < 0) {
    throw new Error('消费金额无效')
  }

  const discountActivities = Array.isArray(currentActivities)
    ? currentActivities.filter((activity) => activity.type === 'discount')
    : []
  const activity = getBestActivity(discountActivities)
  const discountRate = activity ? Number(activity.rule.discountRate) : 1
  const discountAmount = Number((originalPrice * (1 - discountRate)).toFixed(2))
  const paidAmount = Number((originalPrice * discountRate).toFixed(2))
  void memberInfo
  return {
    activity,
    originalPrice,
    discountRate,
    discountAmount,
    paidAmount
  }
}

export const calculateConsume = ({ price, currentActivities = [], memberInfo = null }) => calculateConsumption({
  servicePrice: price,
  currentActivities,
  memberInfo
})

export const consume = (data) => {
  const member = getMemberInfo()
  const calculation = data.calculation || calculateConsumption({
    servicePrice: data.originalAmount ?? data.originalPrice,
    currentActivities: data.currentActivities || getDiscountActivities(),
    memberInfo: member
  })
  if (member.balance < calculation.paidAmount) throw new Error('当前余额不足，请先充值后再消费。')

  const balanceBefore = member.balance
  const balanceAfter = Number((balanceBefore - calculation.paidAmount).toFixed(2))
  const record = createConsumeRecord({
    ...data,
    ...calculation,
    activityId: calculation.activity?.id || null,
    activityName: calculation.activity?.name || '',
    couponAmount: 0,
    vehicle: data.vehicle || member.plate,
    balanceBefore,
    balanceAfter
  })
  setStorage(STORAGE_KEYS.CONSUME_RECORDS, [record, ...getConsumeRecords()])
  const updatedMember = updateBalance(balanceAfter)
  return { member: updatedMember, record, calculation }
}
