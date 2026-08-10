const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export {
      createRechargePlan,
      updateRechargePlan,
      disableRechargePlan,
      enableRechargePlan,
      getRechargePlansForAdmin
    } from './src/services/rechargePlanAdminService.js'
    export { getRechargePlans, getRechargePlanByAmount } from './src/services/rechargePlanService.js'
    export { calculateRechargeQuote } from './src/services/rechargeQuoteService.js'
    export { createActivity } from './src/services/activityService.js'
    export { calculateConsume } from './src/services/consumeService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'plan-admin-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('plan-admin-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'plan-admin-test-bundle.cjs')
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
const getPlan100 = () => services.getRechargePlansForAdmin().find((plan) => plan.amount === 100)

test.beforeEach(() => storage.clear())

test('RP-A01 管理员读取初始化后的4个rechargePlans', () => {
  assert.equal(services.getRechargePlansForAdmin().length, 4)
  assert.equal(storage.get('rechargePlans').length, 4)
})

test('RP-A02 新增500元赠送100套餐并写入Storage', () => {
  const created = services.createRechargePlan({
    name: '500元充值套餐', amount: 500, baseBonus: 100, status: 'active', sort: 50
  })
  assert.equal(created.amount, 500)
  assert.equal(created.baseBonus, 100)
  assert.ok(storage.get('rechargePlans').some((plan) => plan.id === created.id))
})

test('RP-A03 编辑基础赠送后version递增', () => {
  const current = getPlan100()
  const updated = services.updateRechargePlan(current.id, { baseBonus: 20 })
  assert.equal(updated.baseBonus, 20)
  assert.equal(updated.version, current.version + 1)
})

test('RP-A04 inactive套餐用户端不可选，上架后恢复', () => {
  const current = getPlan100()
  services.disableRechargePlan(current.id)
  assert.equal(services.getRechargePlans().some((plan) => plan.amount === 100), false)
  services.enableRechargePlan(current.id)
  assert.equal(services.getRechargePlans().some((plan) => plan.amount === 100), true)
})

test('RP-A05 删除请求执行软删除，不物理删除', () => {
  const current = getPlan100()
  services.disableRechargePlan(current.id)
  const stored = storage.get('rechargePlans')
  assert.equal(stored.length, 4)
  assert.equal(stored.find((plan) => plan.id === current.id).status, 'inactive')
})

test('RP-A06 amount=0拒绝保存', () => {
  assert.throws(() => services.createRechargePlan({
    name: '非法套餐', amount: 0, baseBonus: 0, status: 'active', sort: 1
  }), /充值金额必须/)
})

test('RP-A07 baseBonus=-1拒绝保存', () => {
  assert.throws(() => services.createRechargePlan({
    name: '非法赠送', amount: 500, baseBonus: -1, status: 'active', sort: 1
  }), /基础赠送金额/)
})

test('RP-A08 相同amount和status禁止重复', () => {
  getPlan100()
  assert.throws(() => services.createRechargePlan({
    name: '重复套餐', amount: 100, baseBonus: 99, status: 'active', sort: 99
  }), /存在相同充值金额套餐/)
})

test('RP-A09 后台修改100套餐后新Quote的baseBonus为20', () => {
  const current = getPlan100()
  services.updateRechargePlan(current.id, { baseBonus: 20 })
  const quote = services.calculateRechargeQuote({
    plan: services.getRechargePlanByAmount(100),
    currentActivities: []
  })
  assert.equal(quote.baseBonus, 20)
  assert.equal(quote.totalAmount, 120)
})

test('RP-A10 套餐修改不会改变已生成的历史Quote', () => {
  const current = getPlan100()
  const oldQuote = services.calculateRechargeQuote({
    plan: services.getRechargePlanByAmount(100),
    currentActivities: []
  })
  services.updateRechargePlan(current.id, { baseBonus: 20 })
  assert.equal(oldQuote.baseBonus, 15)
  assert.equal(oldQuote.finalBonus, 15)
  assert.equal(oldQuote.totalAmount, 115)
})

test('RP-A11 Campaign赠送20继续覆盖套餐基础赠送15', () => {
  const quote = services.calculateRechargeQuote({
    plan: services.getRechargePlanByAmount(100),
    currentActivities: [{
      id: 1101,
      name: '充100送20',
      type: 'recharge',
      status: 'active',
      startTime: new Date(Date.now() - 86400000).toISOString(),
      endTime: new Date(Date.now() + 86400000).toISOString(),
      priority: 10,
      thresholdAmount: 100,
      bonusAmount: 20
    }]
  })
  assert.equal(quote.baseBonus, 15)
  assert.equal(quote.campaignBonus, 20)
  assert.equal(quote.finalBonus, 20)
  assert.equal(quote.totalAmount, 120)
})

test('RP-A12 套餐修改不影响消费discount计算', () => {
  services.createActivity({
    id: 1201,
    name: '消费8折',
    type: 'discount',
    status: 'active',
    startTime: new Date(Date.now() - 86400000).toISOString(),
    endTime: new Date(Date.now() + 86400000).toISOString(),
    priority: 10,
    discountRate: 0.8
  })
  const before = services.calculateConsume({ price: 100, currentActivities: storage.get('activities') })
  services.updateRechargePlan(getPlan100().id, { baseBonus: 20 })
  const after = services.calculateConsume({ price: 100, currentActivities: storage.get('activities') })
  assert.equal(before.paidAmount, 80)
  assert.equal(after.paidAmount, 80)
  assert.equal(after.discountRate, 0.8)
})

