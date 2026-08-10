const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export * from './src/services/activityService.js'
    export { calculateConsumption } from './src/services/consumeService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'activity-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('activity-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'activity-test-bundle.cjs')
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

test.beforeEach(() => storage.clear())

test('案例3：活动从8折修改为7折后，重新计算为70且旧结果不复用', () => {
  services.createActivity({
    id: 301,
    name: '可编辑活动',
    type: 'discount',
    status: 'active',
    priority: 10,
    discountRate: 0.8,
    ...validRange()
  })
  const beforeEdit = services.calculateConsumption({
    servicePrice: 100,
    currentActivities: services.getDiscountActivities(),
    memberInfo: {}
  })
  services.updateActivity(301, {
    name: '可编辑活动',
    type: 'discount',
    status: 'active',
    priority: 10,
    discountRate: 0.7,
    ...validRange()
  })
  const afterEdit = services.calculateConsumption({
    servicePrice: 100,
    currentActivities: services.getDiscountActivities(),
    memberInfo: {}
  })
  assert.equal(beforeEdit.paidAmount, 80)
  assert.equal(afterEdit.paidAmount, 70)
  assert.notStrictEqual(afterEdit, beforeEdit)
})

test('案例4：删除8折活动后，100元恢复原价', () => {
  services.createActivity({
    id: 401,
    name: '待删除活动',
    type: 'discount',
    status: 'active',
    priority: 10,
    discountRate: 0.8,
    ...validRange()
  })
  assert.equal(services.deleteActivity(401), true)
  const result = services.calculateConsumption({
    servicePrice: 100,
    currentActivities: services.getDiscountActivities(),
    memberInfo: {}
  })
  assert.equal(result.activity, null)
  assert.equal(result.discountRate, 1)
  assert.equal(result.paidAmount, 100)
})

test('案例5：priority数字越大越优先，选择priority=20的7折活动', () => {
  services.createActivity({
    id: 501,
    name: '活动A',
    type: 'discount',
    status: 'active',
    priority: 10,
    discountRate: 0.8,
    ...validRange()
  })
  services.createActivity({
    id: 502,
    name: '活动B',
    type: 'discount',
    status: 'active',
    priority: 20,
    discountRate: 0.7,
    ...validRange()
  })
  const result = services.calculateConsumption({
    servicePrice: 100,
    currentActivities: services.getDiscountActivities(),
    memberInfo: {}
  })
  assert.equal(result.activity.name, '活动B')
  assert.equal(result.activity.priority, 20)
  assert.equal(result.discountRate, 0.7)
  assert.equal(result.paidAmount, 70)
})
