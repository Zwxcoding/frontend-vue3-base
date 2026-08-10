const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export { createActivity, getBestRechargeActivity } from './src/services/activityService.js'
    export { recharge, getRechargeRecords } from './src/services/rechargeService.js'
    export { calculateRechargeQuote } from './src/services/rechargeQuoteService.js'
    export { saveMemberInfo, getMemberInfo } from './src/services/memberService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'recharge-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('recharge-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'recharge-test-bundle.cjs')
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
const now = () => Date.now()
const validRange = () => ({
  startTime: new Date(now() - 86400000).toISOString(),
  endTime: new Date(now() + 86400000).toISOString()
})
const expiredRange = () => ({
  startTime: new Date(now() - 172800000).toISOString(),
  endTime: new Date(now() - 86400000).toISOString()
})
const createRechargeActivity = (data) => services.createActivity({
  type: 'recharge',
  status: 'active',
  ...validRange(),
  ...data
})

test.beforeEach(() => storage.clear())

test('R-01 正常充值赠送：充值200送50，到账250', () => {
  createRechargeActivity({
    id: 101,
    name: '充200送50',
    priority: 10,
    rechargeAmount: 200,
    bonusAmount: 50
  })
  const result = services.getBestRechargeActivity(200)
  assert.equal(result.activity.id, 101)
  assert.equal(result.rechargeAmount, 200)
  assert.equal(result.bonusAmount, 50)
  assert.equal(result.totalAmount, 250)
})

test('R-02 多活动先过滤金额：500门槛不阻塞100门槛', () => {
  createRechargeActivity({
    id: 201,
    name: '活动A',
    priority: 20,
    rechargeAmount: 500,
    bonusAmount: 100
  })
  createRechargeActivity({
    id: 202,
    name: '活动B',
    priority: 10,
    rechargeAmount: 100,
    bonusAmount: 10
  })
  const result = services.getBestRechargeActivity(100)
  assert.equal(result.activity.id, 202)
  assert.equal(result.activity.name, '活动B')
  assert.equal(result.bonusAmount, 10)
  assert.equal(result.totalAmount, 110)
})

test('R-03 满足门槛的多活动按priority降序选择', () => {
  createRechargeActivity({
    id: 301,
    name: '活动A',
    priority: 20,
    rechargeAmount: 100,
    bonusAmount: 20
  })
  createRechargeActivity({
    id: 302,
    name: '活动B',
    priority: 10,
    rechargeAmount: 100,
    bonusAmount: 10
  })
  const result = services.getBestRechargeActivity(100)
  assert.equal(result.activity.id, 301)
  assert.equal(result.bonusAmount, 20)
})

test('R-04 高priority活动过期时使用低priority有效活动', () => {
  createRechargeActivity({
    id: 401,
    name: '过期活动A',
    priority: 20,
    rechargeAmount: 100,
    bonusAmount: 20,
    ...expiredRange()
  })
  createRechargeActivity({
    id: 402,
    name: '有效活动B',
    priority: 10,
    rechargeAmount: 100,
    bonusAmount: 10
  })
  const result = services.getBestRechargeActivity(100)
  assert.equal(result.activity.id, 402)
})

test('R-05 高priority活动inactive时使用低priority active活动', () => {
  createRechargeActivity({
    id: 501,
    name: '停用活动A',
    status: 'inactive',
    priority: 20,
    rechargeAmount: 100,
    bonusAmount: 20
  })
  createRechargeActivity({
    id: 502,
    name: '启用活动B',
    priority: 10,
    rechargeAmount: 100,
    bonusAmount: 10
  })
  const result = services.getBestRechargeActivity(100)
  assert.equal(result.activity.id, 502)
})

test('R-06 priority相同时选择id较大的活动', () => {
  createRechargeActivity({
    id: 601,
    name: '活动A',
    priority: 10,
    rechargeAmount: 100,
    bonusAmount: 10
  })
  createRechargeActivity({
    id: 602,
    name: '活动B',
    priority: 10,
    rechargeAmount: 100,
    bonusAmount: 20
  })
  const result = services.getBestRechargeActivity(100)
  assert.equal(result.activity.id, 602)
  assert.equal(result.activity.name, '活动B')
})

test('R-07 无符合金额条件活动时不使用赠送活动', () => {
  createRechargeActivity({
    id: 701,
    name: '最低充200',
    priority: 10,
    rechargeAmount: 200,
    bonusAmount: 50
  })
  const result = services.getBestRechargeActivity(100)
  assert.equal(result.activity, null)
  assert.equal(result.rechargeAmount, 100)
  assert.equal(result.bonusAmount, 0)
  assert.equal(result.totalAmount, 100)
})

test('R-08 统一结果保证余额和充值记录一致', () => {
  createRechargeActivity({
    id: 801,
    name: '记录一致性活动',
    priority: 10,
    rechargeAmount: 200,
    bonusAmount: 50
  })
  services.saveMemberInfo({ registered: true, balance: 100 })
  const quote = services.calculateRechargeQuote({
    plan: { amount: 200, bonus: 40 }
  })
  const result = services.recharge({ quote })
  const record = services.getRechargeRecords()[0]

  assert.strictEqual(result.quote, quote)
  assert.strictEqual(result.calculation, quote)
  assert.equal(result.member.balance, 350)
  assert.equal(services.getMemberInfo().balance, 350)
  assert.equal(record.amount, 200)
  assert.equal(record.bonus, 50)
  assert.equal(record.totalAmount, 250)
  assert.equal(record.activityId, 801)
  assert.equal(record.activityName, '记录一致性活动')
  assert.equal(record.beforeBalance, 100)
  assert.equal(record.afterBalance, 350)

  const rechargePage = fs.readFileSync(path.join(projectRoot, 'src/pages/recharge/recharge.vue'), 'utf8')
  assert.match(rechargePage, /getRechargePlansFromBackend\(\)/)
  assert.match(rechargePage, /createRechargeQuoteFromBackend\(option\)/)
  assert.match(rechargePage, /quote: rechargeCalculation\.value/)
  assert.doesNotMatch(rechargePage, /currentActivities|getRechargeActivities/)
  assert.doesNotMatch(rechargePage, /getBestRechargeActivity\(selectedPackage\.value\.amount\)/)
  assert.doesNotMatch(rechargePage, /getBestActivity\(rechargeActivities/)
})
