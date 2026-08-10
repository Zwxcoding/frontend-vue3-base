const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export {
      getRechargeCampaignsForAdmin,
      createRechargeCampaign,
      updateRechargeCampaign,
      enableRechargeCampaign,
      disableRechargeCampaign,
      submitRechargeCampaignForApproval,
      approveRechargeCampaign,
      checkRechargeCampaignConflicts,
      previewRechargeCampaign
    } from './src/services/rechargeCampaignAdminService.js'
    export { calculateRechargeQuote } from './src/services/rechargeQuoteService.js'
    export { createActivity } from './src/services/activityService.js'
    export { calculateConsume } from './src/services/consumeService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'campaign-admin-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('campaign-admin-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'campaign-admin-test-bundle.cjs')
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
const campaignData = (data = {}) => ({
  name: data.name || '充值活动',
  thresholdAmount: data.thresholdAmount ?? 100,
  bonusAmount: data.bonusAmount ?? 20,
  effectMode: data.effectMode || 'override',
  priority: data.priority ?? 10,
  status: data.status || 'active',
  ...validRange(),
  operator: 'admin',
  operationReason: data.operationReason || '',
  ...data
})
const createApprovedCampaign = (data = {}) => {
  const created = services.createRechargeCampaign(campaignData(data))
  services.submitRechargeCampaignForApproval(created.id)
  services.approveRechargeCampaign(created.id)
  return services.getRechargeCampaignsForAdmin().find((item) => item.id === created.id)
}
const prepareProduction = () => {
  storage.set('rechargePlans', [{
    id: 'legacy_plan_100',
    name: '100元充值套餐',
    amount: 100,
    baseBonus: 15,
    status: 'active',
    sort: 20,
    version: 1,
    source: 'migration'
  }])
  storage.set('rechargeMigrationState', {
    version: 1,
    campaignMigrationStatus: 'completed',
    migratedCount: 0,
    migratedAt: new Date().toISOString(),
    errorMessage: ''
  })
}

test.beforeEach(() => {
  storage.clear()
  prepareProduction()
})

test('CA-A01 管理员读取rechargeCampaigns列表', () => {
  storage.set('rechargeCampaigns', [{
    id: 'campaign_1',
    activityId: 1,
    type: 'recharge',
    ...campaignData({ name: '已存活动' }),
    version: 1,
    source: 'admin'
  }])
  assert.equal(services.getRechargeCampaignsForAdmin().length, 1)
})

test('CA-A02 新增充值活动并写入Storage', () => {
  const created = services.createRechargeCampaign(campaignData({
    activityId: 201,
    name: '新增活动'
  }))
  assert.equal(created.activityId, 201)
  assert.equal(created.effectMode, 'override')
  assert.equal(created.approvalStatus, 'draft')
  assert.ok(storage.get('rechargeCampaigns').some((item) => item.id === created.id))
})

test('CA-A03 编辑Campaign后version递增', () => {
  const created = services.createRechargeCampaign(campaignData({ activityId: 301 }))
  const updated = services.updateRechargeCampaign(created.id, { bonusAmount: 30 })
  assert.equal(updated.bonusAmount, 30)
  assert.equal(updated.version, 2)
  assert.equal(updated.activityId, 301)
})

test('CA-A04 inactive活动不参与Quote，上架后恢复', () => {
  const created = createApprovedCampaign({ activityId: 401 })
  services.disableRechargeCampaign(created.id)
  assert.equal(services.previewRechargeCampaign(100).totalAmount, 115)
  services.enableRechargeCampaign(created.id)
  assert.equal(services.previewRechargeCampaign(100).totalAmount, 120)
})

test('CA-A05 删除语义为软删除', () => {
  const created = services.createRechargeCampaign(campaignData({ activityId: 501 }))
  services.disableRechargeCampaign(created.id)
  const stored = storage.get('rechargeCampaigns')
  assert.equal(stored.length, 1)
  assert.equal(stored[0].status, 'inactive')
})

test('CA-A06 thresholdAmount=0保存失败', () => {
  assert.throws(
    () => services.createRechargeCampaign(campaignData({ thresholdAmount: 0 })),
    /充值门槛必须/
  )
})

test('CA-A07 bonusAmount小于0保存失败', () => {
  assert.throws(
    () => services.createRechargeCampaign(campaignData({ bonusAmount: -1 })),
    /赠送金额不能小于0/
  )
})

test('CA-A08 startTime晚于endTime保存失败', () => {
  assert.throws(() => services.createRechargeCampaign(campaignData({
    startTime: new Date(Date.now() + 86400000).toISOString(),
    endTime: new Date(Date.now() - 86400000).toISOString()
  })), /开始时间不能晚于结束时间/)
})

test('CA-A09 同门槛且时间重叠返回冲突warning但允许保存', () => {
  services.createRechargeCampaign(campaignData({ activityId: 901, priority: 20 }))
  const second = services.createRechargeCampaign(campaignData({
    activityId: 902,
    name: '低优先级冲突活动',
    priority: 10,
    bonusAmount: 30
  }))
  assert.equal(second.warning, true)
  assert.equal(second.conflictCampaigns.length, 1)
  assert.equal(storage.get('rechargeCampaigns').length, 2)
})

test('CA-A10 活动预览复用正式Quote并返回到账120', () => {
  createApprovedCampaign({ activityId: 1001 })
  const quote = services.previewRechargeCampaign(100)
  assert.equal(quote.baseBonus, 15)
  assert.equal(quote.campaignBonus, 20)
  assert.equal(quote.finalBonus, 20)
  assert.equal(quote.totalAmount, 120)
})

test('CA-A11 Campaign修改后旧Quote保持不变', () => {
  const created = createApprovedCampaign({ activityId: 1101 })
  const oldQuote = services.previewRechargeCampaign(100)
  services.updateRechargeCampaign(created.id, { bonusAmount: 30 })
  const newQuote = services.previewRechargeCampaign(100)
  assert.equal(oldQuote.campaignBonus, 20)
  assert.equal(oldQuote.totalAmount, 120)
  assert.equal(newQuote.campaignBonus, 30)
  assert.equal(newQuote.totalAmount, 130)
})

test('CA-A12 Campaign覆盖Plan而不叠加赠送', () => {
  createApprovedCampaign({ activityId: 1201 })
  const quote = services.previewRechargeCampaign(100)
  assert.equal(quote.baseBonus, 15)
  assert.equal(quote.campaignBonus, 20)
  assert.equal(quote.finalBonus, 20)
  assert.notEqual(quote.finalBonus, 35)
})

test('CA-A13 Campaign管理不影响discount消费计算', () => {
  services.createActivity({
    id: 1301,
    name: '消费8折',
    type: 'discount',
    status: 'active',
    ...validRange(),
    priority: 10,
    discountRate: 0.8
  })
  const before = services.calculateConsume({ price: 100, currentActivities: storage.get('activities') })
  services.createRechargeCampaign(campaignData({ activityId: 1302 }))
  const after = services.calculateConsume({ price: 100, currentActivities: storage.get('activities') })
  assert.equal(before.paidAmount, 80)
  assert.equal(after.paidAmount, 80)
})

test('CA-A14 多活动时选择高priority活动A', () => {
  createApprovedCampaign({
    activityId: 1401, name: 'A', priority: 20, bonusAmount: 20
  })
  createApprovedCampaign({
    activityId: 1402, name: 'B', priority: 10, bonusAmount: 30
  })
  const quote = services.previewRechargeCampaign(100)
  assert.equal(quote.campaign.activityId, 1401)
  assert.equal(quote.finalBonus, 20)
})

test('CA-A15 同priority时选择activityId较大的活动', () => {
  createApprovedCampaign({
    activityId: 1501, name: 'A', priority: 10, bonusAmount: 20
  })
  createApprovedCampaign({
    activityId: 1502, name: 'B', priority: 10, bonusAmount: 30
  })
  const quote = services.previewRechargeCampaign(100)
  assert.equal(quote.campaign.activityId, 1502)
  assert.equal(quote.finalBonus, 30)
})
