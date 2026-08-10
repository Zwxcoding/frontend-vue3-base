const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export {
      migrateRechargeCampaigns,
      getRechargeMigrationState,
      compareRechargeQuoteBeforeAfterMigration
    } from './src/services/rechargeCampaignMigrationService.js'
    export { getStoredRechargeCampaigns } from './src/services/rechargeCampaignStorageService.js'
    export { getRechargePlanByAmount, LEGACY_RECHARGE_PLANS } from './src/services/rechargePlanService.js'
    export { calculateRechargeQuote } from './src/services/rechargeQuoteService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'campaign-migration-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('campaign-migration-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'campaign-migration-test-bundle.cjs')
  loadedModule.paths = Module._nodeModulePaths(projectRoot)
  loadedModule._compile(result.outputFiles[0].text, loadedModule.filename)
  return loadedModule.exports
}

const storage = new Map()
global.uni = {
  getStorageSync: (key) => storage.has(key) ? storage.get(key) : '',
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: (key) => storage.delete(key)
}

const services = loadServices()
const validRange = () => ({
  startTime: new Date(Date.now() - 86400000).toISOString(),
  endTime: new Date(Date.now() + 86400000).toISOString()
})
const createActivity = (data = {}) => ({
  id: data.id ?? 1,
  name: data.name || `活动${data.id ?? 1}`,
  type: data.type || 'recharge',
  rechargeAmount: data.rechargeAmount ?? 100,
  bonusAmount: data.bonusAmount ?? 20,
  priority: data.priority ?? 10,
  status: data.status || 'active',
  ...validRange(),
  ...data
})
const setActivities = (activities) => storage.set('activities', activities)
const getPlan100 = () => services.getRechargePlanByAmount(
  100,
  services.LEGACY_RECHARGE_PLANS
)

test.beforeEach(() => storage.clear())

test('CM-01 单个recharge Activity迁移为Campaign', () => {
  setActivities([createActivity({ id: 101 })])
  const result = services.migrateRechargeCampaigns()
  assert.equal(result.campaigns.length, 1)
  assert.equal(result.campaigns[0].id, 'campaign_101')
  assert.equal(result.campaigns[0].activityId, 101)
})

test('CM-02 discount Activity不迁移', () => {
  setActivities([
    createActivity({ id: 201, type: 'discount', discountRate: 0.8 })
  ])
  services.migrateRechargeCampaigns()
  assert.deepEqual(services.getStoredRechargeCampaigns(), [])
})

test('CM-03 recharge字段映射保持一致', () => {
  setActivities([
    createActivity({
      id: 301,
      rechargeAmount: 200,
      bonusAmount: 50,
      priority: 30
    })
  ])
  const campaign = services.migrateRechargeCampaigns().campaigns[0]
  assert.equal(campaign.thresholdAmount, 200)
  assert.equal(campaign.bonusAmount, 50)
  assert.equal(campaign.priority, 30)
  assert.equal(campaign.effectMode, 'override')
  assert.equal(campaign.source, 'migration')
  assert.equal(campaign.version, 1)
})

test('CM-04 重复迁移保持幂等且不增加Campaign数量', () => {
  setActivities([createActivity({ id: 401 })])
  services.migrateRechargeCampaigns()
  services.migrateRechargeCampaigns()
  const campaigns = services.getStoredRechargeCampaigns()
  assert.equal(campaigns.length, 1)
  assert.equal(campaigns[0].activityId, 401)
})

test('CM-05 成功和失败迁移状态均可感知', () => {
  setActivities([createActivity({ id: 501 })])
  services.migrateRechargeCampaigns()
  const completed = services.getRechargeMigrationState()
  assert.equal(completed.campaignMigrationStatus, 'completed')
  assert.equal(completed.migratedCount, 1)
  assert.equal(completed.errorMessage, '')

  storage.clear()
  setActivities([
    createActivity({ id: 502, rechargeAmount: 'invalid' })
  ])
  services.migrateRechargeCampaigns()
  const failed = services.getRechargeMigrationState()
  assert.equal(failed.campaignMigrationStatus, 'failed')
  assert.match(failed.errorMessage, /充值门槛无效/)
})

test('CM-06 单活动迁移前后Quote影子比较一致', () => {
  setActivities([createActivity({ id: 601 })])
  services.migrateRechargeCampaigns()
  const comparison = services.compareRechargeQuoteBeforeAfterMigration({
    plan: getPlan100()
  })
  assert.equal(comparison.matched, true)
  assert.deepEqual(comparison.legacyAmounts, comparison.migratedAmounts)
})

test('CM-07 高priority活动迁移前后均选择A', () => {
  setActivities([
    createActivity({ id: 701, name: 'A', bonusAmount: 20, priority: 20 }),
    createActivity({ id: 702, name: 'B', bonusAmount: 30, priority: 10 })
  ])
  services.migrateRechargeCampaigns()
  const comparison = services.compareRechargeQuoteBeforeAfterMigration({
    plan: getPlan100()
  })

  assert.equal(comparison.legacyQuote.campaign.activityId, 701)
  assert.equal(comparison.migratedQuote.campaign.activityId, 701)
  assert.equal(comparison.legacyQuote.campaign.priority, 20)
  assert.equal(comparison.migratedQuote.campaign.priority, 20)
  assert.equal(comparison.legacyQuote.finalBonus, comparison.migratedQuote.finalBonus)
  assert.equal(comparison.legacyQuote.totalAmount, comparison.migratedQuote.totalAmount)
})

test('CM-08 未开始、已结束和inactive活动迁移前后均不生效', () => {
  const cases = [
    createActivity({
      id: 801,
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 172800000).toISOString()
    }),
    createActivity({
      id: 802,
      startTime: new Date(Date.now() - 172800000).toISOString(),
      endTime: new Date(Date.now() - 86400000).toISOString()
    }),
    createActivity({ id: 803, status: 'inactive' })
  ]

  for (const activity of cases) {
    storage.clear()
    setActivities([activity])
    services.migrateRechargeCampaigns()
    const comparison = services.compareRechargeQuoteBeforeAfterMigration({
      plan: getPlan100()
    })
    assert.equal(comparison.matched, true)
    assert.equal(comparison.legacyQuote.campaign, null)
    assert.equal(comparison.migratedQuote.campaign, null)
    assert.equal(comparison.legacyQuote.totalAmount, 115)
    assert.equal(comparison.migratedQuote.totalAmount, 115)
  }
})

test('CM-09 迁移不修改原activities数量和字段', () => {
  const activities = [
    createActivity({ id: 901, priority: 30 }),
    createActivity({ id: 902, type: 'discount', discountRate: 0.8 })
  ]
  setActivities(activities)
  const before = JSON.parse(JSON.stringify(storage.get('activities')))
  services.migrateRechargeCampaigns()
  const after = storage.get('activities')

  assert.deepEqual(after, before)
  assert.equal(after.length, 2)
  assert.deepEqual(
    ['id', 'type', 'rechargeAmount', 'bonusAmount', 'priority', 'status']
      .map((field) => after[0][field]),
    ['id', 'type', 'rechargeAmount', 'bonusAmount', 'priority', 'status']
      .map((field) => before[0][field])
  )
})

test('CM-10 部分失败可感知、成功数据不重复且旧Activity不丢失', () => {
  const activities = [
    createActivity({ id: 1001 }),
    createActivity({ id: 1002, rechargeAmount: 'invalid' })
  ]
  setActivities(activities)
  services.migrateRechargeCampaigns()

  assert.equal(services.getRechargeMigrationState().campaignMigrationStatus, 'failed')
  assert.match(services.getRechargeMigrationState().errorMessage, /1002/)
  assert.equal(services.getStoredRechargeCampaigns().length, 1)
  assert.equal(storage.get('activities').length, 2)

  services.migrateRechargeCampaigns()
  assert.equal(services.getStoredRechargeCampaigns().length, 1)
  assert.equal(storage.get('activities').length, 2)
})

test('CM-11 activities不存在或无recharge数据时完成空迁移', () => {
  let result = services.migrateRechargeCampaigns()
  assert.deepEqual(result.campaigns, [])
  assert.equal(result.state.campaignMigrationStatus, 'completed')

  storage.clear()
  setActivities([createActivity({ id: 1101, type: 'discount' })])
  result = services.migrateRechargeCampaigns()
  assert.deepEqual(result.campaigns, [])
  assert.equal(result.state.campaignMigrationStatus, 'completed')
})

test('CM-12 完整新旧Quote金额字段完全一致', () => {
  setActivities([
    createActivity({
      id: 1201,
      rechargeAmount: 100,
      bonusAmount: 20,
      priority: 10
    })
  ])
  services.migrateRechargeCampaigns()
  const comparison = services.compareRechargeQuoteBeforeAfterMigration({
    plan: getPlan100()
  })

  assert.equal(comparison.matched, true)
  assert.deepEqual(comparison.legacyAmounts, {
    amount: 100,
    baseBonus: 15,
    campaignBonus: 20,
    finalBonus: 20,
    totalAmount: 120
  })
  assert.deepEqual(comparison.migratedAmounts, comparison.legacyAmounts)
})

