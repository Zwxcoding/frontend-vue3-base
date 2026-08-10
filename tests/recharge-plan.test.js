const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')
const storage = new Map()
global.uni = {
  getStorageSync: (key) => storage.has(key) ? storage.get(key) : '',
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: (key) => storage.delete(key)
}

const loadService = () => {
  const result = esbuild.buildSync({
    entryPoints: [path.join(projectRoot, 'src/services/rechargePlanService.js')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('recharge-plan-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'recharge-plan-test-bundle.cjs')
  loadedModule.paths = Module._nodeModulePaths(projectRoot)
  loadedModule._compile(result.outputFiles[0].text, loadedModule.filename)
  return loadedModule.exports
}

const service = loadService()

test.beforeEach(() => storage.clear())

test('RP-01 适配当前四档固定充值套餐且金额不变', () => {
  const plans = service.getRechargePlans()
  assert.deepEqual(
    plans.map(({ amount, bonusAmount }) => ({ amount, bonusAmount })),
    [
      { amount: 50, bonusAmount: 5 },
      { amount: 100, bonusAmount: 15 },
      { amount: 200, bonusAmount: 40 },
      { amount: 300, bonusAmount: 50 }
    ]
  )
})

test('RP-02 RechargePlan输出Quote需要的标准字段', () => {
  const plan = service.adaptRechargePlan({ amount: 100, bonus: 15 })
  assert.deepEqual(plan, {
    id: 'legacy-plan-100',
    name: '充值 ¥100',
    amount: 100,
    bonusAmount: 15,
    status: 'active',
    source: 'legacy-fixed'
  })
})

test('RP-03 支持外部固定套餐输入并过滤inactive套餐', () => {
  const plans = service.getRechargePlans([
    { id: 'enabled', amount: 100, bonus: 10 },
    { id: 'disabled', amount: 200, bonus: 20, status: 'inactive' }
  ])
  assert.equal(plans.length, 1)
  assert.equal(plans[0].id, 'enabled')
})

test('RP-04 可按充值金额取得唯一套餐', () => {
  assert.equal(service.getRechargePlanByAmount(200).bonusAmount, 40)
  assert.equal(service.getRechargePlanByAmount(999), null)
})
