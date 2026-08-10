import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { Pool } from 'pg'
import { CreateRechargeQuote } from '../src/application/CreateRechargeQuote.js'
import { runMigrations } from '../src/database/migrate.js'
import { RechargePlan } from '../src/domain/recharge/RechargePlan.js'
import { PostgresRechargeCampaignRepository } from '../src/repositories/postgres/PostgresRechargeCampaignRepository.js'
import { PostgresRechargePlanRepository } from '../src/repositories/postgres/PostgresRechargePlanRepository.js'
import { PostgresRechargeQuoteRepository } from '../src/repositories/postgres/PostgresRechargeQuoteRepository.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests')
}

const database = new Pool({ connectionString: databaseUrl })
const plans = new PostgresRechargePlanRepository(database)
const campaigns = new PostgresRechargeCampaignRepository(database)
const quotes = new PostgresRechargeQuoteRepository(database)
const now = new Date('2026-08-08T08:00:00.000Z')

before(async () => {
  await runMigrations(database)
})

beforeEach(async () => {
  await database.query('TRUNCATE recharge_quote, recharge_campaign, recharge_plan CASCADE')
})

after(async () => {
  await database.end()
})

const saveCampaign = async (input: {
  id: string
  activityId: string
  bonus: number
  priority: number
  status?: 'active' | 'inactive'
  approvalStatus?: 'approved' | 'pending'
}): Promise<void> => {
  await database.query(
    `INSERT INTO recharge_campaign (
       id, activity_id, name, threshold_amount, bonus_amount, priority,
       effect_mode, status, approval_status, start_time, end_time, version
     ) VALUES ($1, $2, $3, 100, $4, $5, 'override', $6, $7, $8, $9, 1)`,
    [
      input.id, input.activityId, input.id, input.bonus, input.priority,
      input.status ?? 'active', input.approvalStatus ?? 'approved',
      new Date('2026-01-01T00:00:00.000Z'), new Date('2026-12-31T23:59:59.999Z')
    ]
  )
}

const plan = new RechargePlan({
  id: 'plan-100', name: '100元套餐', amount: 100, baseBonus: 15,
  status: 'active', sort: 10, version: 1
})

test('Plan从PostgreSQL保存并读取，非active Plan不可报价', async () => {
  await plans.save(plan)
  assert.deepEqual(await plans.findById(plan.id), plan)
  assert.equal((await plans.findActivePlans()).length, 1)

  await plans.save(new RechargePlan({ ...plan, id: 'plan-inactive', status: 'inactive' }))
  assert.equal(await plans.findById('plan-inactive'), null)
  assert.equal((await plans.findActivePlans()).length, 1)
})

test('Campaign只读取当前有效、active、approved且满足门槛的数据', async () => {
  await saveCampaign({ id: 'effective', activityId: '1001', bonus: 20, priority: 10 })
  await saveCampaign({ id: 'inactive', activityId: '1002', bonus: 30, priority: 30, status: 'inactive' })
  await saveCampaign({ id: 'pending', activityId: '1003', bonus: 40, priority: 40, approvalStatus: 'pending' })
  const result = await campaigns.findEffectiveCampaigns(100, now)
  assert.deepEqual(result.map((item) => item.id), ['effective'])
})

test('生成Quote、保存数据库并读取后结构与金额完全一致', async () => {
  await plans.save(plan)
  await saveCampaign({ id: 'campaign-20', activityId: '1001', bonus: 20, priority: 10 })
  const useCase = new CreateRechargeQuote({
    plans, campaigns, quotes, now: () => new Date(now),
    createId: () => '00000000-0000-4000-8000-000000000001'
  })
  const created = await useCase.execute(plan.id)
  const stored = await quotes.findById(created.id)

  assert.ok(stored)
  assert.deepEqual(stored, created)
  assert.equal(stored.finalBonus, 20)
  assert.equal(stored.totalAmount, 120)
  assert.deepEqual(stored.ruleSnapshot, created.ruleSnapshot)
})

test('Campaign按priority DESC选择', async () => {
  await plans.save(plan)
  await saveCampaign({ id: 'low', activityId: '1002', bonus: 18, priority: 10 })
  await saveCampaign({ id: 'high', activityId: '1001', bonus: 25, priority: 20 })
  const result = await campaigns.findEffectiveCampaigns(100, now)
  assert.deepEqual(result.map((item) => item.id), ['high', 'low'])
})

test('同priority时activityId DESC且Quote选择较大activityId', async () => {
  await plans.save(plan)
  await saveCampaign({ id: 'campaign-1001', activityId: '1001', bonus: 18, priority: 10 })
  await saveCampaign({ id: 'campaign-1002', activityId: '1002', bonus: 22, priority: 10 })
  const result = await campaigns.findEffectiveCampaigns(100, now)
  assert.deepEqual(result.map((item) => item.id), ['campaign-1002', 'campaign-1001'])

  const quote = await new CreateRechargeQuote({
    plans, campaigns, quotes, now: () => new Date(now),
    createId: () => '00000000-0000-4000-8000-000000000002'
  }).execute(plan.id)
  assert.equal(quote.campaignId, 'campaign-1002')
  assert.equal(quote.totalAmount, 122)
})

test('Quote Repository不提供修改删除且同ID不能覆盖', async () => {
  await plans.save(plan)
  const quote = await new CreateRechargeQuote({
    plans, campaigns, quotes, now: () => new Date(now),
    createId: () => '00000000-0000-4000-8000-000000000003'
  }).execute(plan.id)

  assert.equal('update' in quotes, false)
  assert.equal('delete' in quotes, false)
  await assert.rejects(() => quotes.save(quote), /duplicate key|unique constraint/i)
  assert.deepEqual(await quotes.findById(quote.id), quote)
})
