const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export {
      compareLegacyAndCampaignQuote,
      getRechargeQuoteShadowLog,
      clearRechargeQuoteShadowLog
    } from './src/services/rechargeQuoteShadowService.js'
    export { prepareRechargeCampaignsForShadow } from './src/services/rechargeCampaignSwitchService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'campaign-shadow-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('campaign-shadow-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'campaign-shadow-test-bundle.cjs')
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
const plan = {
  id: 'legacy-plan-100',
  name: '100元充值套餐',
  amount: 100,
  baseBonus: 15,
  status: 'active',
  source: 'legacy-fixed'
}
const validRange = () => ({
  startTime: new Date(Date.now() - 86400000).toISOString(),
  endTime: new Date(Date.now() + 86400000).toISOString()
})
const legacyActivity = (data = {}) => ({
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
const migratedCampaign = (data = {}) => ({
  id: `campaign_${data.activityId ?? 1}`,
  activityId: data.activityId ?? 1,
  name: data.name || `活动${data.activityId ?? 1}`,
  type: 'recharge',
  thresholdAmount: data.thresholdAmount ?? 100,
  bonusAmount: data.bonusAmount ?? 20,
  effectMode: 'override',
  priority: data.priority ?? 10,
  status: data.status || 'active',
  ...validRange(),
  source: 'migration',
  version: 1,
  ...data
})
const compare = (legacyActivities, migratedCampaigns) => (
  services.compareLegacyAndCampaignQuote({
    plan,
    amount: 100,
    legacyActivities,
    migratedCampaigns
  })
)

test.beforeEach(() => {
  storage.clear()
  services.clearRechargeQuoteShadowLog()
})

test('SC-01 无活动时Legacy与Campaign Quote均到账115', () => {
  const result = compare([], [])
  assert.equal(result.identical, true)
  assert.deepEqual(result.diff, [])
  assert.equal(result.legacyQuote.totalAmount, 115)
  assert.equal(result.campaignQuote.totalAmount, 115)
})

test('SC-02 单个充值活动的新旧Quote一致', () => {
  const result = compare(
    [legacyActivity({ id: 201 })],
    [migratedCampaign({ activityId: 201 })]
  )
  assert.equal(result.identical, true)
  assert.equal(result.legacyQuote.finalBonus, 20)
  assert.equal(result.campaignQuote.finalBonus, 20)
})

test('SC-03 高priority竞争时Legacy和Campaign均选择A', () => {
  const result = compare(
    [
      legacyActivity({ id: 301, name: 'A', priority: 20, bonusAmount: 20 }),
      legacyActivity({ id: 302, name: 'B', priority: 10, bonusAmount: 30 })
    ],
    [
      migratedCampaign({ activityId: 301, name: 'A', priority: 20, bonusAmount: 20 }),
      migratedCampaign({ activityId: 302, name: 'B', priority: 10, bonusAmount: 30 })
    ]
  )
  assert.equal(result.identical, true)
  assert.equal(result.legacyQuote.campaign.activityId, 301)
  assert.equal(result.campaignQuote.campaign.activityId, 301)
  assert.equal(result.legacyQuote.finalBonus, result.campaignQuote.finalBonus)
})

test('SC-04 高priority门槛不满足时新旧均选择B', () => {
  const result = compare(
    [
      legacyActivity({ id: 401, name: 'A', rechargeAmount: 500, bonusAmount: 100, priority: 20 }),
      legacyActivity({ id: 402, name: 'B', rechargeAmount: 100, bonusAmount: 10, priority: 10 })
    ],
    [
      migratedCampaign({ activityId: 401, name: 'A', thresholdAmount: 500, bonusAmount: 100, priority: 20 }),
      migratedCampaign({ activityId: 402, name: 'B', thresholdAmount: 100, bonusAmount: 10, priority: 10 })
    ]
  )
  assert.equal(result.identical, true)
  assert.equal(result.legacyQuote.campaign.activityId, 402)
  assert.equal(result.campaignQuote.campaign.activityId, 402)
  assert.equal(result.campaignQuote.totalAmount, 110)
})

test('SC-05 未开始、已结束和inactive活动的新旧有效性一致', () => {
  const cases = [
    {
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 172800000).toISOString()
    },
    {
      startTime: new Date(Date.now() - 172800000).toISOString(),
      endTime: new Date(Date.now() - 86400000).toISOString()
    },
    { status: 'inactive' }
  ]

  cases.forEach((data, index) => {
    const activityId = 501 + index
    const result = compare(
      [legacyActivity({ id: activityId, ...data })],
      [migratedCampaign({ activityId, ...data })]
    )
    assert.equal(result.identical, true)
    assert.equal(result.legacyQuote.campaign, null)
    assert.equal(result.campaignQuote.campaign, null)
    assert.equal(result.campaignQuote.totalAmount, 115)
  })
})

test('SC-06 priority相同时按activityId数字降序且新旧均选择1002', () => {
  const campaigns = [
    migratedCampaign({ activityId: 1001, name: 'A', priority: 10, bonusAmount: 20 }),
    migratedCampaign({ activityId: 1002, name: 'B', priority: 10, bonusAmount: 30 })
  ]
  const prepared = services.prepareRechargeCampaignsForShadow(campaigns)
  assert.deepEqual(prepared.map((item) => item.activityId), [1002, 1001])

  const result = compare(
    [
      legacyActivity({ id: 1001, name: 'A', priority: 10, bonusAmount: 20 }),
      legacyActivity({ id: 1002, name: 'B', priority: 10, bonusAmount: 30 })
    ],
    campaigns
  )
  assert.equal(result.identical, true)
  assert.equal(result.legacyQuote.campaign.activityId, 1002)
  assert.equal(result.campaignQuote.campaign.activityId, 1002)
  assert.equal(result.campaignQuote.finalBonus, 30)
})

test('SC-07 discount数据不会参与任何充值Quote', () => {
  const result = compare(
    [legacyActivity({ id: 701, type: 'discount', discountRate: 0.5 })],
    [{
      id: 'discount-701',
      activityId: 701,
      name: '消费折扣',
      type: 'discount',
      discountRate: 0.5,
      status: 'active',
      ...validRange()
    }]
  )
  assert.equal(result.identical, true)
  assert.equal(result.legacyQuote.campaign, null)
  assert.equal(result.campaignQuote.campaign, null)
  assert.equal(result.campaignQuote.totalAmount, 115)
})

test('SC-08 完整金额、effectMode和规则快照核心字段一致并能检测差异', () => {
  const legacy = [legacyActivity({ id: 801, priority: 10, bonusAmount: 20 })]
  const campaigns = [migratedCampaign({ activityId: 801, priority: 10, bonusAmount: 20 })]
  const result = compare(legacy, campaigns)

  assert.equal(result.identical, true)
  assert.equal(result.legacyQuote.effectMode, 'override')
  assert.equal(result.campaignQuote.effectMode, 'override')
  assert.deepEqual(result.diff, [])
  assert.deepEqual(
    {
      amount: result.campaignQuote.amount,
      baseBonus: result.campaignQuote.baseBonus,
      campaignBonus: result.campaignQuote.campaignBonus,
      finalBonus: result.campaignQuote.finalBonus,
      totalAmount: result.campaignQuote.totalAmount,
      effectMode: result.campaignQuote.effectMode,
      ruleSnapshot: result.campaignQuote.ruleSnapshot
    },
    {
      amount: result.legacyQuote.amount,
      baseBonus: result.legacyQuote.baseBonus,
      campaignBonus: result.legacyQuote.campaignBonus,
      finalBonus: result.legacyQuote.finalBonus,
      totalAmount: result.legacyQuote.totalAmount,
      effectMode: result.legacyQuote.effectMode,
      ruleSnapshot: result.legacyQuote.ruleSnapshot
    }
  )

  const originalError = console.error
  const errors = []
  console.error = (...args) => errors.push(args)
  try {
    const mismatch = compare(
      legacy,
      [migratedCampaign({ activityId: 801, priority: 10, bonusAmount: 25 })]
    )
    assert.equal(mismatch.identical, false)
    assert.ok(mismatch.diff.some((item) => item.field === 'finalBonus'))
    assert.ok(mismatch.diff.some((item) => item.field === 'totalAmount'))
    assert.equal(errors.length, 1)
    const log = services.getRechargeQuoteShadowLog().at(-1)
    assert.equal(log.identical, false)
    assert.equal(log.amount, 100)
    assert.ok(log.diff.length > 0)
  } finally {
    console.error = originalError
  }
})

