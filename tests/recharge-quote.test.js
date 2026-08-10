const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export { createActivity, getBestRechargeActivity, getRechargeActivities } from './src/services/activityService.js'
    export { calculateRechargeQuote } from './src/services/rechargeQuoteService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'recharge-quote-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('recharge-quote-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'recharge-quote-test-bundle.cjs')
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
const fixedPlans = [
  { amount: 50, bonus: 5 },
  { amount: 100, bonus: 15 },
  { amount: 200, bonus: 40 },
  { amount: 300, bonus: 50 }
]
const validRange = () => ({
  startTime: new Date(Date.now() - 86400000).toISOString(),
  endTime: new Date(Date.now() + 86400000).toISOString()
})
const createRechargeActivity = (data) => services.createActivity({
  type: 'recharge',
  status: 'active',
  ...validRange(),
  ...data
})
const getLegacyResult = (plan) => {
  const matched = services.getBestRechargeActivity(plan.amount)
  if (matched.activity) return matched
  return {
    ...matched,
    bonusAmount: plan.bonus,
    totalAmount: Number((matched.rechargeAmount + plan.bonus).toFixed(2))
  }
}

test.beforeEach(() => storage.clear())

test('Q-01 无Activity时，四个固定套餐的新Quote与旧充值结果一致', () => {
  fixedPlans.forEach((plan) => {
    const legacy = getLegacyResult(plan)
    const quote = services.calculateRechargeQuote({ plan, currentActivities: [] })

    assert.equal(quote.rechargeAmount, legacy.rechargeAmount)
    assert.equal(quote.bonusAmount, legacy.bonusAmount)
    assert.equal(quote.totalAmount, legacy.totalAmount)
    assert.equal(quote.bonusSource, 'plan')
    assert.equal(quote.activity, null)
  })
})

test('Q-02 满足门槛的Activity覆盖固定套餐赠送，结果与旧逻辑一致', () => {
  createRechargeActivity({
    id: 2001,
    name: '充100送20',
    priority: 10,
    rechargeAmount: 100,
    bonusAmount: 20
  })
  const plan = fixedPlans[1]
  const legacy = getLegacyResult(plan)
  const quote = services.calculateRechargeQuote({
    plan,
    currentActivities: services.getRechargeActivities()
  })

  assert.equal(quote.activity.id, legacy.activity.id)
  assert.equal(quote.bonusAmount, legacy.bonusAmount)
  assert.equal(quote.totalAmount, legacy.totalAmount)
  assert.equal(quote.totalAmount, 120)
  assert.equal(quote.bonusSource, 'campaign')
})

test('Q-03 高优先级但门槛不满足时，不阻塞低优先级符合活动', () => {
  createRechargeActivity({
    id: 3001,
    name: '充500送100',
    priority: 20,
    rechargeAmount: 500,
    bonusAmount: 100
  })
  createRechargeActivity({
    id: 3002,
    name: '充100送10',
    priority: 10,
    rechargeAmount: 100,
    bonusAmount: 10
  })
  const plan = fixedPlans[1]
  const legacy = getLegacyResult(plan)
  const quote = services.calculateRechargeQuote({
    plan,
    currentActivities: services.getRechargeActivities()
  })

  assert.equal(quote.activity.id, 3002)
  assert.equal(quote.activity.id, legacy.activity.id)
  assert.equal(quote.totalAmount, legacy.totalAmount)
})

test('Q-04 显式输入Activity，不读写或迁移Activity Storage', () => {
  const activity = {
    id: 4001,
    name: '显式活动',
    type: 'recharge',
    status: 'active',
    ...validRange(),
    priority: 10,
    rechargeAmount: 200,
    bonusAmount: 60,
    rule: { rechargeAmount: 200, bonusAmount: 60 }
  }
  const quote = services.calculateRechargeQuote({
    plan: fixedPlans[2],
    currentActivities: [activity]
  })

  assert.equal(quote.campaign.activityId, 4001)
  assert.equal(quote.rechargeAmount, 200)
  assert.equal(quote.bonusAmount, 60)
  assert.equal(quote.totalAmount, 260)
  assert.equal(storage.size, 0)
})

test('Q-05 多个符合条件活动时，独立验证priority数字大优先', () => {
  createRechargeActivity({
    id: 5001,
    name: '高优先级活动',
    priority: 20,
    rechargeAmount: 100,
    bonusAmount: 20
  })
  createRechargeActivity({
    id: 5002,
    name: '低优先级高赠送活动',
    priority: 10,
    rechargeAmount: 100,
    bonusAmount: 30
  })

  const quote = services.calculateRechargeQuote({
    plan: fixedPlans[1],
    currentActivities: services.getRechargeActivities()
  })

  assert.equal(quote.campaign.activityId, 5001)
  assert.equal(quote.finalBonus, 20)
  assert.equal(quote.totalAmount, 120)
})

test('Q-06 未开始的活动不能参与Quote计算', () => {
  createRechargeActivity({
    id: 6001,
    name: '未开始活动',
    priority: 20,
    rechargeAmount: 100,
    bonusAmount: 50,
    startTime: new Date(Date.now() + 86400000).toISOString(),
    endTime: new Date(Date.now() + 172800000).toISOString()
  })

  const quote = services.calculateRechargeQuote({
    plan: fixedPlans[1],
    currentActivities: services.getRechargeActivities()
  })

  assert.equal(quote.activity, null)
  assert.equal(quote.finalBonus, 15)
  assert.equal(quote.totalAmount, 115)
})

test('Q-07 Quote显式字段契约完整且保留bonusAmount兼容字段', () => {
  createRechargeActivity({
    id: 7001,
    name: '字段契约活动',
    priority: 10,
    rechargeAmount: 100,
    bonusAmount: 20
  })

  const quote = services.calculateRechargeQuote({
    plan: fixedPlans[1],
    currentActivities: services.getRechargeActivities()
  })

  assert.equal(quote.baseBonus, 15)
  assert.equal(quote.campaignBonus, 20)
  assert.equal(quote.finalBonus, 20)
  assert.equal(quote.bonusAmount, 20)
  assert.equal(quote.effectMode, 'override')
  assert.equal(quote.campaign.thresholdAmount, 100)
  assert.equal(quote.campaign.rechargeAmount, 100)
})

test('Q-08 ruleSnapshot固化本次Quote使用的规则', () => {
  createRechargeActivity({
    id: 8001,
    name: '快照活动',
    priority: 30,
    rechargeAmount: 100,
    bonusAmount: 25
  })

  const quote = services.calculateRechargeQuote({
    plan: fixedPlans[1],
    currentActivities: services.getRechargeActivities()
  })

  assert.deepEqual(quote.ruleSnapshot, {
    planId: 'legacy-plan-100',
    campaignId: 8001,
    thresholdAmount: 100,
    priority: 30,
    baseBonus: 15,
    campaignBonus: 25,
    finalBonus: 25,
    effectMode: 'override'
  })
})
