const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export * from './src/services/consumeService.js'
    export { createActivity, getDiscountActivities } from './src/services/activityService.js'
    export { saveMemberInfo } from './src/services/memberService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'consume-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('consume-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'consume-test-bundle.cjs')
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

test('案例1：无活动消费100元，应付100元', () => {
  const result = services.calculateConsumption({
    servicePrice: 100,
    currentActivities: [],
    memberInfo: { balance: 200 }
  })
  assert.deepEqual({
    originalAmount: result.originalPrice,
    discountAmount: result.discountAmount,
    paidAmount: result.paidAmount
  }, {
    originalAmount: 100,
    discountAmount: 0,
    paidAmount: 100
  })
})

test('案例2：单个8折活动，100元应付80元', () => {
  const activity = services.createActivity({
    id: 201,
    name: '8折活动',
    type: 'discount',
    status: 'active',
    priority: 10,
    discountRate: 0.8,
    ...validRange()
  })
  const result = services.calculateConsumption({
    servicePrice: 100,
    currentActivities: [activity],
    memberInfo: { balance: 200 }
  })
  assert.equal(result.originalPrice, 100)
  assert.equal(result.discountRate, 0.8)
  assert.equal(result.discountAmount, 20)
  assert.equal(result.paidAmount, 80)
})

test('案例6：页面、弹窗、扣款、记录和成功页使用同一结果', () => {
  const activity = services.createActivity({
    id: 601,
    name: '统一结果8折',
    type: 'discount',
    status: 'active',
    priority: 10,
    discountRate: 0.8,
    ...validRange()
  })
  services.saveMemberInfo({ registered: true, balance: 200 })
  const pageCalculation = services.calculateConsumption({
    servicePrice: 100,
    currentActivities: [activity],
    memberInfo: { balance: 200 }
  })
  const modalCalculation = pageCalculation
  const consumeResult = services.consume({
    serviceName: '100元洗车',
    calculation: modalCalculation
  })
  const record = services.getConsumeRecords()[0]

  assert.strictEqual(consumeResult.calculation, pageCalculation)
  assert.equal(pageCalculation.paidAmount, 80)
  assert.equal(modalCalculation.paidAmount, 80)
  assert.equal(200 - consumeResult.member.balance, 80)
  assert.equal(record.paidAmount, 80)
  assert.equal(record.activityName, '统一结果8折')

  const consumePage = fs.readFileSync(path.join(projectRoot, 'src/pages/consume/index.vue'), 'utf8')
  const successPage = fs.readFileSync(path.join(projectRoot, 'src/pages/consume/success.vue'), 'utf8')
  assert.match(consumePage, /const calculation = consumptionCalculation\.value/)
  assert.match(consumePage, /content: `本次消费金额 ¥\$\{calculation\.paidAmount\.toFixed\(2\)\}/)
  assert.match(consumePage, /consume\(\{[\s\S]*?calculation,[\s\S]*?\}\)/)
  assert.match(consumePage, /amount=\$\{result\.calculation\.paidAmount\}/)
  assert.match(successPage, /amount\.value = options\.amount/)
})
