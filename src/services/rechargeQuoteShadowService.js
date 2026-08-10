import { calculateRechargeQuote } from './rechargeQuoteService.js'
import { prepareRechargeCampaignsForShadow } from './rechargeCampaignSwitchService.js'

const AMOUNT_FIELDS = [
  'amount',
  'baseBonus',
  'campaignBonus',
  'finalBonus',
  'totalAmount',
  'effectMode'
]
const SNAPSHOT_FIELDS = [
  'campaignId',
  'thresholdAmount',
  'priority',
  'baseBonus',
  'campaignBonus',
  'finalBonus',
  'effectMode'
]
const rechargeQuoteShadowLog = []

const isDevelopment = () => (
  typeof process !== 'undefined' &&
  process.env?.NODE_ENV !== 'production'
)

const addDiff = (diff, field, legacyValue, campaignValue) => {
  if (legacyValue !== campaignValue) {
    diff.push({ field, legacyValue, campaignValue })
  }
}

export const getRechargeQuoteShadowLog = () => (
  rechargeQuoteShadowLog.map((entry) => ({
    ...entry,
    diff: entry.diff.map((item) => ({ ...item }))
  }))
)

export const clearRechargeQuoteShadowLog = () => {
  rechargeQuoteShadowLog.splice(0, rechargeQuoteShadowLog.length)
}

export const compareLegacyAndCampaignQuote = ({
  plan,
  amount,
  legacyActivities = [],
  migratedCampaigns = []
} = {}) => {
  const quotePlan = amount === undefined ? plan : { ...plan, amount }
  const legacyQuote = calculateRechargeQuote({
    plan: quotePlan,
    currentActivities: Array.isArray(legacyActivities) ? legacyActivities : []
  })
  const campaignQuote = calculateRechargeQuote({
    plan: quotePlan,
    currentActivities: prepareRechargeCampaignsForShadow(migratedCampaigns)
  })
  const diff = []

  for (const field of AMOUNT_FIELDS) {
    addDiff(diff, field, legacyQuote[field], campaignQuote[field])
  }
  for (const field of SNAPSHOT_FIELDS) {
    addDiff(
      diff,
      `ruleSnapshot.${field}`,
      legacyQuote.ruleSnapshot?.[field] ?? null,
      campaignQuote.ruleSnapshot?.[field] ?? null
    )
  }

  const result = {
    identical: diff.length === 0,
    legacyQuote,
    campaignQuote,
    diff
  }
  if (isDevelopment()) {
    const log = {
      time: new Date().toISOString(),
      amount: legacyQuote.amount,
      identical: result.identical,
      legacyQuoteId: legacyQuote.quoteId || null,
      campaignQuoteId: campaignQuote.quoteId || null,
      diff: diff.map((item) => ({ ...item }))
    }
    rechargeQuoteShadowLog.push(log)
    if (!result.identical) {
      console.error('[RechargeQuote Shadow] Legacy与Campaign报价不一致', log)
    }
  }

  return result
}

