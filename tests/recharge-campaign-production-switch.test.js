const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export { calculateRechargeQuote } from './src/services/rechargeQuoteService.js'
    export {
      DEFAULT_RECHARGE_SOURCE_SWITCH,
      PRODUCTION_RECHARGE_SOURCE_SWITCH,
      getRechargeSourceFallbackLog,
      clearRechargeSourceFallbackLog
    } from './src/services/rechargeSourceSwitchService.js'
    export { recharge, getRechargeRecords } from './src/services/rechargeService.js'
    export { saveMemberInfo, getMemberInfo } from './src/services/memberService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'campaign-production-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('campaign-production-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'campaign-production-test-bundle.cjs')
  loadedModule.paths = Module._nodeModulePaths(projectRoot)
  loadedModule._compile(result.outputFiles[0].text, loadedModule.filename)
  return loadedModule.exports
}

const storage = new Map()
global.uni = {
  getStorageSync: (key) => {
    const stored = storage.get(key)
    if (stored instanceof Error) throw stored
    return storage.has(key) ? stored : ''
  },
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: (key) => storage.delete(key)
}

const services = loadServices()
const plan = {
  id: 'legacy-plan-100',
  name: '100元充值套餐',
  amount: 100,
  baseBonus: 15,
  status: 'active',
  source: 'legacy-fixed'
}
const validRange = () => ({
  startTime: new Date(Date.now() - 86400000).toISOString(),
  endTime: new Date(Date.now() + 86400000).toISOString()
})
const activity = (data = {}) => ({
  id: data.id ?? 1,
  name: data.name || `活动${data.id ?? 1}`,
  type: data.type || 'recharge',
  rechargeAmount: data.rechargeAmount ?? 100,
  bonusAmount: data.bonusAmount ?? 20,
  priority: data.priority ?? 10,
  status: data.status || 'active',
  ...validRange(),
  ...data
})
const campaign = (data = {}) => ({
  id: `campaign_${data.activityId ?? 1}`,
  activityId: data.activityId ?? 1,
  name: data.name || `活动${data.activityId ?? 1}`,
  type: 'recharge',
  thresholdAmount: data.thresholdAmount ?? 100,
  bonusAmount: data.bonusAmount ?? 20,
  effectMode: 'override',
  priority: data.priority ?? 10,
  status: data.status || 'active',
  ...validRange(),
  source: 'migration',
  version: 1,
  ...data
})
const completeMigration = () => storage.set('rechargeMigrationState', {
  version: 1,
  campaignMigrationStatus: 'completed',
  migratedCount: 1,
  migratedAt: new Date().toISOString(),
  errorMessage: ''
})
const setLegacy = (activities) => storage.set('activities', activities)
const setCampaigns = (campaigns) => storage.set('rechargeCampaigns', campaigns)
const quote = (sourceSwitch) => services.calculateRechargeQuote({
  plan,
  ...(sourceSwitch ? { sourceSwitch } : {})
})

test.beforeEach(() => {
  storage.clear()
  services.clearRechargeSourceFallbackLog()
})

test('PC-01 默认Legacy配置读取Activity并正常生成Quote', () => {
  setLegacy([activity({ id: 101, bonusAmount: 20 })])
  const result = quote(services.DEFAULT_RECHARGE_SOURCE_SWITCH)
  assert.equal(result.campaign.activityId, 101)
  assert.equal(result.totalAmount, 120)
})

test('PC-02 生产Campaign模式读取rechargeCampaigns', () => {
  setLegacy([activity({ id: 201, bonusAmount: 20 })])
  setCampaigns([campaign({ activityId: 202, bonusAmount: 30 })])
  completeMigration()
  const result = quote()
  assert.equal(services.PRODUCTION_RECHARGE_SOURCE_SWITCH.source, 'campaign')
  assert.equal(result.campaign.activityId, 202)
  assert.equal(result.totalAmount, 130)
})

test('PC-03 同一规则的新旧Quote金额一致', () => {
  setLegacy([activity({ id: 301, bonusAmount: 20 })])
  setCampaigns([campaign({ activityId: 301, bonusAmount: 20 })])
  completeMigration()
  const legacyQuote = quote(services.DEFAULT_RECHARGE_SOURCE_SWITCH)
  const campaignQuote = quote()

  for (const field of ['amount', 'baseBonus', 'campaignBonus', 'finalBonus', 'totalAmount']) {
    assert.equal(campaignQuote[field], legacyQuote[field])
  }
})

test('PC-04 页面不再传currentActivities且Quote由后端API生成', () => {
  const page = fs.readFileSync(
    path.join(projectRoot, 'src/pages/recharge/recharge.vue'),
    'utf8'
  )
  assert.doesNotMatch(page, /currentActivities/)
  assert.doesNotMatch(page, /getRechargeActivities|getBestRechargeActivity|getBestActivity/)
  assert.match(page, /createRechargeQuoteFromBackend\(option\)/)
  assert.match(page, /quote: rechargeCalculation\.value/)
})

test('PC-05 migrationState未完成时Campaign模式自动回退Legacy', () => {
  setLegacy([activity({ id: 501, bonusAmount: 20 })])
  setCampaigns([campaign({ activityId: 502, bonusAmount: 30 })])
  storage.set('rechargeMigrationState', {
    version: 1,
    campaignMigrationStatus: 'pending'
  })
  const result = quote()
  assert.equal(result.campaign.activityId, 501)
  assert.equal(result.totalAmount, 120)
  assert.match(services.getRechargeSourceFallbackLog()[0].reason, /pending/)
})

test('PC-06 rechargeCampaigns不存在时回退Legacy', () => {
  setLegacy([activity({ id: 601, bonusAmount: 20 })])
  completeMigration()
  const result = quote()
  assert.equal(result.campaign.activityId, 601)
  assert.equal(result.totalAmount, 120)
  assert.match(services.getRechargeSourceFallbackLog()[0].reason, /不存在/)
})

test('PC-07 Campaign Storage读取异常时回退Legacy', () => {
  setLegacy([activity({ id: 701, bonusAmount: 20 })])
  storage.set('rechargeCampaigns', new Error('模拟Campaign读取失败'))
  completeMigration()
  const result = quote()
  assert.equal(result.campaign.activityId, 701)
  assert.equal(result.totalAmount, 120)
  assert.ok(services.getRechargeSourceFallbackLog().length > 0)
})

test('PC-08 同priority时按activityId较大选择1002', () => {
  setCampaigns([
    campaign({ activityId: 1001, bonusAmount: 20, priority: 10 }),
    campaign({ activityId: 1002, bonusAmount: 30, priority: 10 })
  ])
  completeMigration()
  const result = quote()
  assert.equal(result.campaign.activityId, 1002)
  assert.equal(result.finalBonus, 30)
})

test('PC-09 Campaign Quote充值后余额增加120', () => {
  setCampaigns([campaign({ activityId: 901, bonusAmount: 20 })])
  completeMigration()
  services.saveMemberInfo({ registered: true, balance: 50 })
  const result = services.recharge({ quote: quote() })
  assert.equal(result.member.balance, 170)
  assert.equal(result.record.afterBalance - result.record.beforeBalance, 120)
})

test('PC-10 Campaign Quote充值记录新旧字段和金额一致', () => {
  setCampaigns([campaign({ activityId: 10001, name: '生产活动', bonusAmount: 20 })])
  completeMigration()
  services.saveMemberInfo({ registered: true, balance: 0 })
  const result = services.recharge({ quote: quote() })
  const record = result.record

  assert.equal(record.totalAmount, 120)
  assert.equal(record.finalBonus, 20)
  assert.equal(record.bonus, 20)
  assert.equal(record.campaignId, 10001)
  assert.equal(record.activityId, 10001)
  assert.equal(record.campaignName, '生产活动')
  assert.equal(record.activityName, '生产活动')
  assert.deepEqual(record.ruleSnapshot, result.quote.ruleSnapshot)
})

test('PC-11 discount数据不会进入生产充值Campaign', () => {
  setLegacy([activity({ id: 1101, type: 'discount', discountRate: 0.8 })])
  setCampaigns([])
  completeMigration()
  const result = quote()
  assert.equal(result.campaign, null)
  assert.equal(result.totalAmount, 115)
})

test('PC-12 历史充值记录仍按旧字段读取', () => {
  const historical = {
    id: 1201,
    amount: 100,
    bonus: 15,
    totalAmount: 115,
    activityId: 1,
    activityName: '旧活动'
  }
  storage.set('rechargeRecords', [historical])
  assert.deepEqual(services.getRechargeRecords(), [historical])
})
