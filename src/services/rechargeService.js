import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { getStorage, setStorage } from '../utils/storage.js'
import { getMemberInfo, updateBalance } from './memberService.js'

const VALID_EFFECT_MODES = ['none', 'override']
const toAmount = (value) => Number(Number(value).toFixed(2))
const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key)

export const getRechargeRecords = () => {
  const records = getStorage(STORAGE_KEYS.RECHARGE_RECORDS, [])
  return Array.isArray(records) ? records : []
}

export const validateRechargeQuote = (quote) => {
  if (!quote || typeof quote !== 'object' || Array.isArray(quote)) {
    throw new Error('充值报价不能为空')
  }

  const amount = Number(quote.amount ?? quote.rechargeAmount)
  const baseBonus = Number(quote.baseBonus ?? 0)
  const campaignBonus = Number(quote.campaignBonus ?? 0)
  const finalBonus = Number(quote.finalBonus ?? quote.bonusAmount)
  const totalAmount = Number(quote.totalAmount)
  const effectMode = quote.effectMode

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('充值报价金额无效')
  }
  if (
    !Number.isFinite(baseBonus) ||
    baseBonus < 0 ||
    !Number.isFinite(campaignBonus) ||
    campaignBonus < 0 ||
    !Number.isFinite(finalBonus) ||
    finalBonus < 0
  ) {
    throw new Error('充值报价赠送金额无效')
  }
  if (!Number.isFinite(totalAmount) || toAmount(amount + finalBonus) !== toAmount(totalAmount)) {
    throw new Error('充值报价到账金额不一致')
  }
  if (!VALID_EFFECT_MODES.includes(effectMode)) {
    throw new Error('充值报价生效模式无效')
  }

  if (quote.ruleSnapshot !== undefined && quote.ruleSnapshot !== null) {
    const snapshot = quote.ruleSnapshot
    const requiredFields = [
      'planId',
      'campaignId',
      'thresholdAmount',
      'priority',
      'baseBonus',
      'campaignBonus',
      'finalBonus',
      'effectMode'
    ]
    if (
      typeof snapshot !== 'object' ||
      Array.isArray(snapshot) ||
      requiredFields.some((field) => !hasOwn(snapshot, field)) ||
      Number(snapshot.baseBonus) !== baseBonus ||
      Number(snapshot.campaignBonus) !== campaignBonus ||
      Number(snapshot.finalBonus) !== finalBonus ||
      snapshot.effectMode !== effectMode ||
      (snapshot.thresholdAmount !== null && !Number.isFinite(Number(snapshot.thresholdAmount))) ||
      (snapshot.priority !== null && !Number.isFinite(Number(snapshot.priority)))
    ) {
      throw new Error('充值报价规则快照无效')
    }
  }

  return {
    amount: toAmount(amount),
    baseBonus: toAmount(baseBonus),
    campaignBonus: toAmount(campaignBonus),
    finalBonus: toAmount(finalBonus),
    totalAmount: toAmount(totalAmount),
    effectMode
  }
}

export const recharge = ({ quote } = {}) => {
  const validated = validateRechargeQuote(quote)
  const appliedCampaign = quote.campaign || null
  const appliedActivity = quote.activity || appliedCampaign?.activity || null
  const campaignId = appliedCampaign?.activityId ??
    appliedCampaign?.id ??
    quote.ruleSnapshot?.campaignId ??
    appliedActivity?.id ??
    null
  const campaignName = appliedCampaign?.name || appliedActivity?.name || ''
  const member = getMemberInfo()
  const beforeBalance = Number(member.balance)
  const afterBalance = toAmount(beforeBalance + validated.totalAmount)
  const updatedMember = updateBalance(afterBalance)
  const recordId = Date.now()
  const quoteId = quote.quoteId || `quote-${recordId}`
  const record = {
    id: recordId,
    quoteId,
    amount: validated.amount,
    baseBonus: validated.baseBonus,
    campaignBonus: validated.campaignBonus,
    finalBonus: validated.finalBonus,
    bonus: validated.finalBonus,
    totalAmount: validated.totalAmount,
    effectMode: validated.effectMode,
    campaignId,
    campaignName,
    activityId: campaignId,
    activityName: campaignName,
    ruleSnapshot: quote.ruleSnapshot || null,
    beforeBalance,
    afterBalance,
    createTime: new Date().toISOString()
  }
  setStorage(STORAGE_KEYS.RECHARGE_RECORDS, [record, ...getRechargeRecords()])
  return {
    member: updatedMember,
    record,
    activity: appliedActivity,
    quote,
    calculation: quote
  }
}
