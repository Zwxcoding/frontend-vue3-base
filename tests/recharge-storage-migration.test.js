const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export { createActivity } from './src/services/activityService.js'
    export { initializeRechargeStorage, getStoredRechargePlans } from './src/services/rechargePlanStorageService.js'
    export { getStoredRechargeCampaigns } from './src/services/rechargeCampaignStorageService.js'
    export { getRechargePlans, getRechargePlanByAmount, LEGACY_RECHARGE_PLANS } from './src/services/rechargePlanService.js'
    export { getRechargeCampaigns, getBestRechargeCampaign } from './src/services/rechargeCampaignService.js'
    export { calculateRechargeQuote } from './src/services/rechargeQuoteService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'recharge-storage-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('recharge-storage-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'recharge-storage-test-bundle.cjs')
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
const createLegacyActivity = (data) => services.createActivity({
  type: 'recharge',
  status: 'active',
  ...validRange(),
  ...data
})
const createStoredCampaign = (data = {}) => ({
  id: data.id || 'stored-campaign',
  name: data.name || '新Storage活动',
  type: 'recharge',
  thresholdAmount: data.thresholdAmount ?? 100,
  bonusAmount: data.bonusAmount ?? 30,
  effectMode: 'override',
  priority: data.priority ?? 10,
  status: 'active',
  ...validRange(),
  version: 1,
  source: 'migration'
})

test.beforeEach(() => storage.clear())

test('SM-01 空Storage初始化生成4个默认套餐', () => {
  const plans = services.initializeRechargeStorage()
  assert.equal(plans.length, 4)
  assert.equal(storage.get('rechargePlans').length, 4)
  assert.equal(storage.has('rechargeCampaigns'), false)
})

test('SM-02 重复初始化不会产生重复套餐', () => {
  const first = services.initializeRechargeStorage()
  const second = services.initializeRechargeStorage()
  assert.equal(first.length, 4)
  assert.equal(second.length, 4)
  assert.equal(storage.get('rechargePlans').length, 4)
})

test('SM-03 初始化套餐金额和基础赠送与旧固定套餐一致', () => {
  services.initializeRechargeStorage()
  const plans = services.getStoredRechargePlans()
  assert.deepEqual(
    plans.map(({ amount, baseBonus }) => ({ amount, baseBonus })),
    [
      { amount: 50, baseBonus: 5 },
      { amount: 100, baseBonus: 15 },
      { amount: 200, baseBonus: 40 },
      { amount: 300, baseBonus: 50 }
    ]
  )
})

test('SM-04 rechargePlans存在时优先于旧固定套餐读取', () => {
  storage.set('rechargePlans', [{
    id: 'new-plan-100',
    name: '新套餐',
    amount: 100,
    baseBonus: 20,
    status: 'active',
    sort: 10,
    version: 1,
    source: 'storage'
  }])
  const plan = services.getRechargePlanByAmount(100)
  assert.equal(plan.bonusAmount, 20)
  assert.equal(plan.source, 'storage')
})

test('SM-05 旧Activity正确转换为thresholdAmount和override Campaign', () => {
  const activity = createLegacyActivity({
    id: 5001,
    rechargeAmount: 100,
    bonusAmount: 20,
    priority: 10
  })
  const campaign = services.getRechargeCampaigns([activity])[0]
  assert.equal(campaign.thresholdAmount, 100)
  assert.equal(campaign.bonusAmount, 20)
  assert.equal(campaign.effectMode, 'override')
  assert.equal(activity.rechargeAmount, 100)
})

test('SM-06 rechargeCampaigns存在时优先于activities读取', () => {
  createLegacyActivity({
    id: 6001,
    name: '旧活动',
    rechargeAmount: 100,
    bonusAmount: 20,
    priority: 10
  })
  storage.set('rechargeCampaigns', [
    createStoredCampaign({ id: 'new-6002', bonusAmount: 30 })
  ])

  const campaign = services.getBestRechargeCampaign(100)
  assert.equal(campaign.id, 'new-6002')
  assert.equal(campaign.bonusAmount, 30)
})

test('SM-07 rechargePlans不存在时回退旧固定套餐', () => {
  storage.delete('rechargePlans')
  const plan = services.getRechargePlanByAmount(100)
  assert.equal(plan.amount, 100)
  assert.equal(plan.bonusAmount, 15)
  assert.equal(plan.source, 'legacy-fixed')
})

test('SM-08 新旧数据源生成的Quote金额完全一致', () => {
  const legacyActivity = createLegacyActivity({
    id: 8001,
    name: '等价活动',
    rechargeAmount: 100,
    bonusAmount: 20,
    priority: 10
  })
  const legacyPlan = services.getRechargePlanByAmount(
    100,
    services.LEGACY_RECHARGE_PLANS
  )
  const legacyQuote = services.calculateRechargeQuote({
    plan: legacyPlan,
    currentActivities: [legacyActivity]
  })

  storage.set('rechargePlans', [{
    id: 'new-plan-100',
    name: '100元充值套餐',
    amount: 100,
    baseBonus: 15,
    status: 'active',
    sort: 20,
    version: 1,
    source: 'migration'
  }])
  storage.set('rechargeCampaigns', [
    createStoredCampaign({
      id: 8001,
      name: '等价活动',
      thresholdAmount: 100,
      bonusAmount: 20,
      priority: 10
    })
  ])
  const storageQuote = services.calculateRechargeQuote({
    plan: services.getRechargePlanByAmount(100)
  })

  assert.deepEqual(
    {
      amount: storageQuote.amount,
      baseBonus: storageQuote.baseBonus,
      campaignBonus: storageQuote.campaignBonus,
      finalBonus: storageQuote.finalBonus,
      totalAmount: storageQuote.totalAmount
    },
    {
      amount: legacyQuote.amount,
      baseBonus: legacyQuote.baseBonus,
      campaignBonus: legacyQuote.campaignBonus,
      finalBonus: legacyQuote.finalBonus,
      totalAmount: legacyQuote.totalAmount
    }
  )
})

