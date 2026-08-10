export const STORAGE_KEYS = Object.freeze({
  MEMBER_INFO: 'memberInfo',
  MEMBER_DATA: 'memberData',
  MEMBER_BALANCE: 'memberBalance',
  CONSUME_RECORDS: 'consumeRecords',
  ACTIVITIES: 'activities',
  ACTIVITY_LIST: 'activityList',
  RECHARGE_PLANS: 'rechargePlans',
  RECHARGE_CAMPAIGNS: 'rechargeCampaigns',
  RECHARGE_MIGRATION_STATE: 'rechargeMigrationState',
  RECHARGE_OPERATION_LOGS: 'rechargeOperationLogs',
  ADMIN_USERS: 'adminUsers',
  RECHARGE_RECORDS: 'rechargeRecords'
})

export const STORAGE_LEGACY_KEYS = Object.freeze({
  [STORAGE_KEYS.MEMBER_INFO]: [STORAGE_KEYS.MEMBER_DATA, STORAGE_KEYS.MEMBER_BALANCE],
  [STORAGE_KEYS.ACTIVITIES]: [STORAGE_KEYS.ACTIVITY_LIST]
})
