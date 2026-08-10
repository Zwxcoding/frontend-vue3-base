const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export { createActivity } from './src/services/activityService.js'
    export {
      adaptRechargeCampaign,
      getRechargeCampaigns,
      getBestRechargeCampaign
    } from './src/services/rechargeCampaignService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'campaign-adapter-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('campaign-adapter-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'campaign-adapter-test-bundle.cjs')
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
const createRechargeActivity = (data) => services.createActivity({
  type: 'recharge',
  status: 'active',
  ...validRange(),
  ...data
})

test.beforeEach(() => storage.clear())

test('RC-01 将现有recharge Activity适配为RechargeCampaign', () => {
  const activity = createRechargeActivity({
    id: 101,
    name: '充100送20',
    priority: 10,
    rechargeAmount: 100,
    bonusAmount: 20
  })
  const campaign = services.adaptRechargeCampaign(activity)

  assert.equal(campaign.activityId, 101)
  assert.equal(campaign.thresholdAmount, 100)
  assert.equal(campaign.bonusAmount, 20)
  assert.equal(campaign.effectMode, 'override')
  assert.strictEqual(campaign.activity, activity)
})

test('RC-02 默认读取现有Activity Storage且只输出recharge类型', () => {
  createRechargeActivity({
    id: 201,
    rechargeAmount: 100,
    bonusAmount: 10
  })
  services.createActivity({
    id: 202,
    type: 'discount',
    status: 'active',
    ...validRange(),
    discountRate: 0.8
  })

  const campaigns = services.getRechargeCampaigns()
  assert.equal(campaigns.length, 1)
  assert.equal(campaigns[0].activityId, 201)
})

test('RC-03 金额过滤后按priority选择最佳Campaign', () => {
  createRechargeActivity({
    id: 301,
    priority: 30,
    rechargeAmount: 500,
    bonusAmount: 100
  })
  createRechargeActivity({
    id: 302,
    priority: 20,
    rechargeAmount: 100,
    bonusAmount: 20
  })
  createRechargeActivity({
    id: 303,
    priority: 10,
    rechargeAmount: 100,
    bonusAmount: 30
  })

  const campaign = services.getBestRechargeCampaign(100)
  assert.equal(campaign.activityId, 302)
  assert.equal(campaign.bonusAmount, 20)
})

test('RC-04 显式Activity输入只做适配，不写入Storage', () => {
  const activity = {
    id: 401,
    name: '显式Campaign',
    type: 'recharge',
    status: 'active',
    ...validRange(),
    priority: 10,
    rule: { rechargeAmount: 200, bonusAmount: 50 }
  }
  const campaigns = services.getRechargeCampaigns([activity])

  assert.equal(campaigns[0].thresholdAmount, 200)
  assert.equal(campaigns[0].bonusAmount, 50)
  assert.equal(storage.size, 0)
})

