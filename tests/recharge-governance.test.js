const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export {
      createRechargeCampaign,
      updateRechargeCampaign,
      submitRechargeCampaignForApproval,
      approveRechargeCampaign,
      getCampaignVersionHistory,
      checkRechargeCampaignPublishRisk,
      previewRechargeCampaign,
      previewRechargeCampaignTrace
    } from './src/services/rechargeCampaignAdminService.js'
    export { getOperationLogs, getTargetHistory } from './src/services/operationLogService.js'
    export {
      DEFAULT_ADMIN_ACTOR,
      getAdminUsers,
      hasAdminPermission
    } from './src/services/adminPermissionService.js'
    export { recharge, getRechargeRecords } from './src/services/rechargeService.js'
    export { saveMemberInfo } from './src/services/memberService.js'
    export { createActivity } from './src/services/activityService.js'
    export { calculateConsume } from './src/services/consumeService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'governance-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('governance-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'governance-test-bundle.cjs')
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
const ADMIN = services.DEFAULT_ADMIN_ACTOR
const OPERATOR = { id: 'operator', username: 'operator', role: 'OPERATOR', status: 'active' }
const VIEWER = { id: 'viewer', username: 'viewer', role: 'VIEWER', status: 'active' }
const validRange = () => ({
  startTime: new Date(Date.now() - 86400000).toISOString(),
  endTime: new Date(Date.now() + 86400000).toISOString()
})
const campaignData = (data = {}) => ({
  name: data.name || '治理活动',
  thresholdAmount: data.thresholdAmount ?? 100,
  bonusAmount: data.bonusAmount ?? 20,
  effectMode: 'override',
  priority: data.priority ?? 10,
  status: data.status || 'active',
  ...validRange(),
  operationReason: data.operationReason || '治理测试',
  ...data
})
const prepareProduction = () => {
  storage.set('rechargePlans', [{
    id: 'plan-100',
    name: '100元充值套餐',
    amount: 100,
    baseBonus: 15,
    status: 'active',
    sort: 10,
    version: 1,
    source: 'admin'
  }])
  storage.set('rechargeMigrationState', {
    version: 1,
    campaignMigrationStatus: 'completed',
    migratedCount: 0,
    migratedAt: new Date().toISOString(),
    errorMessage: ''
  })
}
const approve = (campaign, actor = ADMIN) => {
  services.submitRechargeCampaignForApproval(campaign.id, actor, '提交审批')
  services.approveRechargeCampaign(campaign.id, ADMIN, '审批通过')
}
const createApproved = (data = {}, actor = ADMIN) => {
  const created = services.createRechargeCampaign(campaignData(data), actor)
  approve(created, actor)
  return created
}

test.beforeEach(() => {
  storage.clear()
  prepareProduction()
})

test('G-01 新增Campaign自动创建CREATE操作日志', () => {
  const created = services.createRechargeCampaign(campaignData({ activityId: 101 }), ADMIN)
  const log = services.getOperationLogs()[0]
  assert.equal(log.operationType, 'CREATE')
  assert.equal(log.targetType, 'RechargeCampaign')
  assert.equal(log.targetId, created.id)
  assert.equal(log.beforeData, null)
  assert.equal(log.afterData.approvalStatus, 'draft')
})

test('G-02 编辑日志保存不可变before/after', () => {
  const created = services.createRechargeCampaign(campaignData({ activityId: 201 }), ADMIN)
  services.updateRechargeCampaign(created.id, { bonusAmount: 30 }, ADMIN)
  const log = services.getOperationLogs()[0]
  assert.equal(log.operationType, 'UPDATE')
  assert.equal(log.beforeData.bonusAmount, 20)
  assert.equal(log.afterData.bonusAmount, 30)
  storage.get('rechargeCampaigns')[0].bonusAmount = 40
  assert.equal(log.afterData.bonusAmount, 30)
})

test('G-03 Campaign版本历史按version升序只读返回', () => {
  const created = services.createRechargeCampaign(campaignData({ activityId: 301 }), ADMIN)
  services.updateRechargeCampaign(created.id, { bonusAmount: 30 }, ADMIN)
  const history = services.getCampaignVersionHistory(created.id, ADMIN)
  assert.deepEqual(history.map((item) => item.version), [1, 2])
  assert.deepEqual(history.map((item) => item.bonusAmount), [20, 30])
})

test('G-04 ADMIN拥有全部治理权限', () => {
  assert.equal(services.getAdminUsers()[0].role, 'ADMIN')
  for (const permission of ['VIEW', 'CREATE', 'UPDATE', 'ENABLE', 'DELETE', 'APPROVE']) {
    assert.equal(services.hasAdminPermission(ADMIN, permission), true)
  }
})

test('G-05 VIEWER禁止创建Campaign', () => {
  assert.throws(
    () => services.createRechargeCampaign(campaignData({ activityId: 501 }), VIEWER),
    /无CREATE权限/
  )
  assert.equal(storage.has('rechargeCampaigns'), false)
})

test('G-06 Service层阻止VIEWER直接修改', () => {
  const created = services.createRechargeCampaign(campaignData({ activityId: 601 }), ADMIN)
  assert.throws(
    () => services.updateRechargeCampaign(created.id, { bonusAmount: 99 }, VIEWER),
    /无UPDATE权限/
  )
  assert.equal(storage.get('rechargeCampaigns')[0].bonusAmount, 20)
})

test('G-07 draft Campaign不参与Quote', () => {
  services.createRechargeCampaign(campaignData({ activityId: 701 }), ADMIN)
  const quote = services.previewRechargeCampaign(100)
  assert.equal(quote.campaign, null)
  assert.equal(quote.totalAmount, 115)
})

test('G-08 approved且active Campaign参与Quote', () => {
  createApproved({ activityId: 801 })
  const quote = services.previewRechargeCampaign(100)
  assert.equal(quote.campaign.activityId, 801)
  assert.equal(quote.totalAmount, 120)
})

test('G-09 发布检查提示冲突和高priority覆盖风险', () => {
  createApproved({ activityId: 901, priority: 20 })
  const risk = services.checkRechargeCampaignPublishRisk(campaignData({
    id: 'candidate',
    activityId: 902,
    priority: 10,
    bonusAmount: 30
  }))
  assert.equal(risk.pass, true)
  assert.ok(risk.warnings.some((item) => item.includes('重叠')))
  assert.ok(risk.warnings.some((item) => item.includes('更高priority')))
})

test('G-10 发布检查提示活动收益低于套餐基础赠送', () => {
  const risk = services.checkRechargeCampaignPublishRisk(campaignData({
    activityId: 1001,
    bonusAmount: 10
  }))
  assert.equal(risk.pass, true)
  assert.ok(risk.warnings.some((item) => item.includes('用户收益可能下降')))
})

test('G-11 Quote预览解释链路与正式Quote完全一致', () => {
  createApproved({ activityId: 1101 })
  const result = services.previewRechargeCampaignTrace(100)
  assert.equal(result.trace.amount, result.quote.amount)
  assert.equal(result.trace.baseBonus, result.quote.baseBonus)
  assert.equal(result.trace.campaignBonus, result.quote.campaignBonus)
  assert.equal(result.trace.finalBonus, result.quote.finalBonus)
  assert.equal(result.trace.totalAmount, result.quote.totalAmount)
  assert.equal(result.trace.effectMode, 'override')
})

test('G-12 Campaign修改不改变历史充值记录', () => {
  const created = createApproved({ activityId: 1201 })
  services.saveMemberInfo({ registered: true, balance: 0 })
  const oldQuote = services.previewRechargeCampaign(100)
  services.recharge({ quote: oldQuote })
  services.updateRechargeCampaign(created.id, { bonusAmount: 30 }, ADMIN)
  const newQuote = services.previewRechargeCampaign(100)
  const historical = services.getRechargeRecords()[0]
  assert.equal(historical.campaignBonus, 20)
  assert.equal(historical.totalAmount, 120)
  assert.equal(newQuote.campaignBonus, 30)
  assert.equal(newQuote.totalAmount, 130)
})

test('G-13 治理能力不影响discount消费', () => {
  services.createActivity({
    id: 1301,
    name: '消费8折',
    type: 'discount',
    status: 'active',
    ...validRange(),
    priority: 10,
    discountRate: 0.8
  })
  createApproved({ activityId: 1302 })
  const result = services.calculateConsume({
    price: 100,
    currentActivities: storage.get('activities')
  })
  assert.equal(result.paidAmount, 80)
})

test('G-14 approved活动继续按高priority选择', () => {
  createApproved({ activityId: 1401, name: 'A', priority: 20, bonusAmount: 20 })
  createApproved({ activityId: 1402, name: 'B', priority: 10, bonusAmount: 30 })
  const quote = services.previewRechargeCampaign(100)
  assert.equal(quote.campaign.activityId, 1401)
  assert.equal(quote.finalBonus, 20)
})

test('G-15 同priority继续按activityId较大选择', () => {
  createApproved({ activityId: 1501, name: 'A', priority: 10, bonusAmount: 20 })
  createApproved({ activityId: 1502, name: 'B', priority: 10, bonusAmount: 30 })
  const quote = services.previewRechargeCampaign(100)
  assert.equal(quote.campaign.activityId, 1502)
  assert.equal(quote.finalBonus, 30)
})

