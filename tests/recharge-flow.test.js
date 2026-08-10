const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export { createActivity, updateActivity } from './src/services/activityService.js'
    export { getRechargePlanByAmount } from './src/services/rechargePlanService.js'
    export { calculateRechargeQuote } from './src/services/rechargeQuoteService.js'
    export { recharge, getRechargeRecords } from './src/services/rechargeService.js'
    export { saveMemberInfo, getMemberInfo } from './src/services/memberService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'recharge-flow-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('recharge-flow-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'recharge-flow-test-bundle.cjs')
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
const createCampaignActivity = (data) => services.createActivity({
  type: 'recharge',
  status: 'active',
  ...validRange(),
  ...data
})
const getPlan100 = () => services.getRechargePlanByAmount(100)

test.beforeEach(() => storage.clear())

test('RF-01 无活动充值：Quote、余额和记录均为115', () => {
  services.saveMemberInfo({ registered: true, balance: 20 })
  const quote = services.calculateRechargeQuote({
    plan: getPlan100(),
    currentActivities: []
  })
  const result = services.recharge({ quote })

  assert.equal(quote.baseBonus, 15)
  assert.equal(quote.campaignBonus, 0)
  assert.equal(quote.finalBonus, 15)
  assert.equal(quote.totalAmount, 115)
  assert.equal(result.member.balance, 135)
  assert.equal(result.record.totalAmount, 115)
})

test('RF-02 活动覆盖套餐：Quote到账120并保存规则快照', () => {
  createCampaignActivity({
    id: 2001,
    name: '充100送20',
    rechargeAmount: 100,
    bonusAmount: 20,
    priority: 10
  })
  services.saveMemberInfo({ registered: true, balance: 0 })
  const quote = services.calculateRechargeQuote({ plan: getPlan100() })
  const result = services.recharge({ quote })

  assert.equal(quote.baseBonus, 15)
  assert.equal(quote.campaignBonus, 20)
  assert.equal(quote.finalBonus, 20)
  assert.equal(quote.totalAmount, 120)
  assert.equal(result.member.balance, 120)
  assert.equal(result.record.totalAmount, 120)
  assert.deepEqual(result.record.ruleSnapshot, quote.ruleSnapshot)
})

test('RF-03 高priority活动门槛不满足时选择低priority符合活动', () => {
  createCampaignActivity({
    id: 3001,
    name: '活动A',
    rechargeAmount: 500,
    bonusAmount: 100,
    priority: 20
  })
  createCampaignActivity({
    id: 3002,
    name: '活动B',
    rechargeAmount: 100,
    bonusAmount: 10,
    priority: 10
  })
  services.saveMemberInfo({ registered: true, balance: 0 })
  const quote = services.calculateRechargeQuote({ plan: getPlan100() })
  const result = services.recharge({ quote })

  assert.equal(quote.campaign.activityId, 3002)
  assert.equal(quote.campaign.name, '活动B')
  assert.equal(quote.totalAmount, 110)
  assert.equal(result.member.balance, 110)
  assert.equal(result.record.totalAmount, 110)
})

test('RF-04 活动修改不改变已保存充值记录的Quote快照', () => {
  const activity = createCampaignActivity({
    id: 4001,
    name: '可编辑活动',
    rechargeAmount: 100,
    bonusAmount: 20,
    priority: 10
  })
  services.saveMemberInfo({ registered: true, balance: 0 })
  const firstQuote = services.calculateRechargeQuote({ plan: getPlan100() })
  services.recharge({ quote: firstQuote })

  services.updateActivity(activity.id, { bonusAmount: 30 })
  const currentQuote = services.calculateRechargeQuote({ plan: getPlan100() })
  const historicalRecord = services.getRechargeRecords()[0]

  assert.equal(currentQuote.campaignBonus, 30)
  assert.equal(currentQuote.totalAmount, 130)
  assert.equal(historicalRecord.campaignBonus, 20)
  assert.equal(historicalRecord.finalBonus, 20)
  assert.equal(historicalRecord.totalAmount, 120)
  assert.equal(historicalRecord.ruleSnapshot.campaignBonus, 20)
})

test('RF-05 页面Quote、余额变化和充值记录使用同一个totalAmount', () => {
  createCampaignActivity({
    id: 5001,
    name: '一致性活动',
    rechargeAmount: 100,
    bonusAmount: 25,
    priority: 10
  })
  services.saveMemberInfo({ registered: true, balance: 40 })
  const quote = services.calculateRechargeQuote({ plan: getPlan100() })
  const result = services.recharge({ quote })
  const balanceDelta = result.record.afterBalance - result.record.beforeBalance
  const rechargePage = fs.readFileSync(
    path.join(projectRoot, 'src/pages/recharge/recharge.vue'),
    'utf8'
  )

  assert.equal(quote.totalAmount, 125)
  assert.equal(balanceDelta, quote.totalAmount)
  assert.equal(result.record.totalAmount, quote.totalAmount)
  assert.strictEqual(result.quote, quote)
  assert.match(rechargePage, /const totalAmount = computed\(\(\) => rechargeCalculation\.value\.totalAmount\)/)
  assert.match(rechargePage, /quote: rechargeCalculation\.value/)
})

test('RF-06 非法Quote拒绝且余额、充值记录均不变化', () => {
  services.saveMemberInfo({ registered: true, balance: 40 })
  const quote = services.calculateRechargeQuote({
    plan: getPlan100(),
    currentActivities: []
  })
  const invalidQuote = { ...quote, totalAmount: 999 }

  assert.throws(
    () => services.recharge({ quote: invalidQuote }),
    /充值报价到账金额不一致/
  )
  assert.equal(services.getMemberInfo().balance, 40)
  assert.equal(services.getRechargeRecords().length, 0)
})

