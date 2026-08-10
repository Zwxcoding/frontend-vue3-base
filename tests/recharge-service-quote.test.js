const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export { createActivity } from './src/services/activityService.js'
    export { recharge, getRechargeRecords, validateRechargeQuote } from './src/services/rechargeService.js'
    export { saveMemberInfo, getMemberInfo } from './src/services/memberService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'recharge-service-quote-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('recharge-service-quote-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'recharge-service-quote-test-bundle.cjs')
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
const createQuote = (overrides = {}) => ({
  quoteId: 'quote-A',
  amount: 100,
  rechargeAmount: 100,
  baseBonus: 15,
  campaignBonus: 20,
  finalBonus: 20,
  bonusAmount: 20,
  totalAmount: 120,
  effectMode: 'override',
  campaign: {
    id: 'campaign-A',
    activityId: 'activity-A',
    name: '活动A',
    thresholdAmount: 100,
    bonusAmount: 20,
    effectMode: 'override'
  },
  activity: {
    id: 'activity-A',
    name: '活动A'
  },
  ruleSnapshot: {
    planId: 'legacy-plan-100',
    campaignId: 'activity-A',
    thresholdAmount: 100,
    priority: 10,
    baseBonus: 15,
    campaignBonus: 20,
    finalBonus: 20,
    effectMode: 'override'
  },
  ...overrides
})

test.beforeEach(() => storage.clear())

test('RSQ-01 正常Quote充值：余额和记录均增加120', () => {
  services.saveMemberInfo({ registered: true, balance: 50 })
  const quote = createQuote()
  const result = services.recharge({ quote })

  assert.strictEqual(result.quote, quote)
  assert.equal(result.member.balance, 170)
  assert.equal(services.getMemberInfo().balance, 170)
  assert.equal(result.record.beforeBalance, 50)
  assert.equal(result.record.afterBalance, 170)
  assert.equal(result.record.totalAmount, 120)
})

test('RSQ-02 Quote字段完整保存并保留历史记录字段', () => {
  services.saveMemberInfo({ registered: true, balance: 0 })
  const quote = createQuote()
  const record = services.recharge({ quote }).record

  assert.equal(record.amount, 100)
  assert.equal(record.baseBonus, 15)
  assert.equal(record.campaignBonus, 20)
  assert.equal(record.finalBonus, 20)
  assert.equal(record.effectMode, 'override')
  assert.deepEqual(record.ruleSnapshot, quote.ruleSnapshot)
  assert.equal(record.quoteId, 'quote-A')
  assert.equal(record.campaignId, 'activity-A')
  assert.equal(record.campaignName, '活动A')
  assert.equal(record.bonus, 20)
  assert.equal(record.activityId, 'activity-A')
  assert.equal(record.activityName, '活动A')
})

test('RSQ-03 Storage存在活动B时，Service仍完全使用传入Quote的活动A', () => {
  services.createActivity({
    id: 'activity-B',
    name: '活动B',
    type: 'recharge',
    status: 'active',
    startTime: new Date(Date.now() - 86400000).toISOString(),
    endTime: new Date(Date.now() + 86400000).toISOString(),
    priority: 999,
    rechargeAmount: 100,
    bonusAmount: 999
  })
  services.saveMemberInfo({ registered: true, balance: 0 })

  const record = services.recharge({ quote: createQuote() }).record
  assert.equal(record.campaignId, 'activity-A')
  assert.equal(record.campaignName, '活动A')
  assert.equal(record.finalBonus, 20)
  assert.equal(record.totalAmount, 120)
  assert.equal(record.afterBalance, 120)
})

test('RSQ-04 非法Quote拒绝充值且不改变余额和记录', () => {
  services.saveMemberInfo({ registered: true, balance: 50 })

  assert.throws(
    () => services.recharge({ quote: createQuote({ totalAmount: 999 }) }),
    /充值报价到账金额不一致/
  )
  assert.equal(services.getMemberInfo().balance, 50)
  assert.equal(services.getRechargeRecords().length, 0)
})

test('RSQ-05 空Quote拒绝充值', () => {
  services.saveMemberInfo({ registered: true, balance: 50 })

  assert.throws(() => services.recharge({}), /充值报价不能为空/)
  assert.equal(services.getMemberInfo().balance, 50)
  assert.equal(services.getRechargeRecords().length, 0)
})

test('RSQ-06 历史充值记录仍可按原字段读取', () => {
  const legacyRecord = {
    id: 6001,
    amount: 100,
    bonus: 15,
    totalAmount: 115,
    activityId: null,
    activityName: '',
    beforeBalance: 0,
    afterBalance: 115,
    createTime: '2026-01-01T00:00:00.000Z'
  }
  storage.set('rechargeRecords', [legacyRecord])

  const records = services.getRechargeRecords()
  assert.equal(records.length, 1)
  assert.deepEqual(records[0], legacyRecord)
})

