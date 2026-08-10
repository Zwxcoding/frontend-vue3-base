import { createRechargeCampaign } from '../models/rechargeCampaign.js'
import { getBestActivity, getRechargeActivities } from './activityService.js'
import { getStoredRechargeCampaigns } from './rechargeCampaignStorageService.js'

const getCampaignActivity = (campaign) => campaign?.activity || campaign
const resolveCampaignSource = (activities) => {
  if (activities !== undefined) return Array.isArray(activities) ? activities : []
  const storedCampaigns = getStoredRechargeCampaigns()
  return storedCampaigns === null ? getRechargeActivities() : storedCampaigns
}

export const adaptRechargeCampaign = (activity) => {
  const normalized = createRechargeCampaign({
    ...activity,
    id: activity?.activityId ?? activity?.id
  })
  return {
    ...normalized,
    id: activity?.id ?? normalized.id,
    activityId: activity?.activityId ?? normalized.activityId,
    approvalStatus: activity?.approvalStatus || 'approved',
    source: activity?.source || 'activity',
    activity
  }
}

export const getRechargeCampaigns = (activities) => {
  const source = resolveCampaignSource(activities)
  return source
    .map(getCampaignActivity)
    .filter((activity) =>
      activity?.type === 'recharge' &&
      (activity.approvalStatus || 'approved') === 'approved'
    )
    .map(adaptRechargeCampaign)
}

export const getBestRechargeCampaign = (
  amount,
  activities
) => {
  const rechargeAmount = Number(amount)
  if (!Number.isFinite(rechargeAmount) || rechargeAmount <= 0) return null

  const matchedActivity = getBestActivity(
    resolveCampaignSource(activities)
      .map(getCampaignActivity)
      .filter((activity) => (activity?.approvalStatus || 'approved') === 'approved'),
    (activity) => activity.type === 'recharge' &&
      rechargeAmount >= Number(
        activity.thresholdAmount ??
        activity.rechargeAmount ??
        activity.rule?.thresholdAmount ??
        activity.rule?.rechargeAmount
      )
  )

  return matchedActivity ? adaptRechargeCampaign(matchedActivity) : null
}
