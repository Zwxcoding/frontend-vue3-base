const toPriority = (campaign) => {
  const priority = Number(campaign?.priority)
  return Number.isFinite(priority) ? priority : 0
}

const toActivityId = (campaign) => {
  const rawId = campaign?.activityId ?? campaign?.id
  const numericId = Number(rawId)
  return Number.isFinite(numericId) ? numericId : 0
}

export const prepareRechargeCampaignsForShadow = (campaigns = []) => (
  Array.isArray(campaigns) ? campaigns : []
)
  .filter((campaign) => campaign?.type === 'recharge')
  .map((campaign) => ({ ...campaign }))
  .sort((a, b) =>
    toPriority(b) - toPriority(a) ||
    toActivityId(b) - toActivityId(a)
  )

