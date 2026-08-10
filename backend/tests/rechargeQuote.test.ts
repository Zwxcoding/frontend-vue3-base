import assert from 'node:assert/strict'
import test from 'node:test'
import { CreateRechargeQuote } from '../src/application/CreateRechargeQuote.js'
import { RechargeCampaign } from '../src/domain/recharge/RechargeCampaign.js'
import { RechargePlan } from '../src/domain/recharge/RechargePlan.js'
import type { RechargeQuote } from '../src/domain/recharge/RechargeQuote.js'
import type { RechargeCampaignRepository } from '../src/repositories/RechargeCampaignRepository.js'
import type { RechargePlanRepository } from '../src/repositories/RechargePlanRepository.js'
import type { RechargeQuoteRepository } from '../src/repositories/RechargeQuoteRepository.js'

const now = new Date('2026-08-08T08:00:00.000Z')
const plan = new RechargePlan({
  id: 'plan-100', name: '100元套餐', amount: 100, baseBonus: 15,
  status: 'active', sort: 10, version: 1
})

class PlanMemoryRepository implements RechargePlanRepository {
  async findById(id: string): Promise<RechargePlan | null> {
    return id === plan.id ? plan : null
  }
  async findActivePlans(): Promise<readonly RechargePlan[]> { return [plan] }
  async findAll(): Promise<readonly RechargePlan[]> { return [plan] }
  async findAnyById(id: string): Promise<RechargePlan | null> { return this.findById(id) }
  async save(): Promise<void> {}
}

class CampaignMemoryRepository implements RechargeCampaignRepository {
  constructor(private readonly items: readonly RechargeCampaign[]) {}
  async findEffectiveCampaigns(): Promise<readonly RechargeCampaign[]> { return this.items }
  async findAll(): Promise<readonly RechargeCampaign[]> { return this.items }
  async findById(id: string): Promise<RechargeCampaign | null> {
    return this.items.find((item) => item.id === id) ?? null
  }
  async save(): Promise<void> {}
}

class QuoteMemoryRepository implements RechargeQuoteRepository {
  readonly items = new Map<string, RechargeQuote>()
  async save(quote: RechargeQuote): Promise<void> { this.items.set(quote.id, quote) }
  async findById(id: string): Promise<RechargeQuote | null> { return this.items.get(id) ?? null }
}

const campaign = (id: string, activityId: string, bonusAmount: number, priority: number) =>
  new RechargeCampaign({
    id, activityId, name: id, thresholdAmount: 100, bonusAmount, priority,
    effectMode: 'override', status: 'active', approvalStatus: 'approved',
    startTime: new Date('2026-01-01T00:00:00.000Z'),
    endTime: new Date('2026-12-31T23:59:59.999Z'), version: 1
  })

const createUseCase = (campaigns: readonly RechargeCampaign[]) => new CreateRechargeQuote({
  plans: new PlanMemoryRepository(),
  campaigns: new CampaignMemoryRepository(campaigns),
  quotes: new QuoteMemoryRepository(),
  now: () => new Date(now),
  createId: () => 'stable-quote-id'
})

test('同输入产生相同Quote', async () => {
  const first = await createUseCase([]).execute(plan.id)
  const second = await createUseCase([]).execute(plan.id)
  assert.deepEqual(first, second)
})

test('无活动时finalBonus等于baseBonus且金额一致', async () => {
  const quote = await createUseCase([]).execute(plan.id)
  assert.equal(quote.baseBonus, 15)
  assert.equal(quote.campaignBonus, 0)
  assert.equal(quote.finalBonus, 15)
  assert.equal(quote.totalAmount, 115)
})

test('Campaign按priority数字降序选择并覆盖套餐赠送', async () => {
  const quote = await createUseCase([
    campaign('campaign-low', '1001', 18, 10),
    campaign('campaign-high', '1000', 20, 20)
  ]).execute(plan.id)
  assert.equal(quote.campaignId, 'campaign-high')
  assert.equal(quote.campaignBonus, 20)
  assert.equal(quote.finalBonus, 20)
  assert.equal(quote.totalAmount, 120)
})

test('priority相同时保持当前前端activityId较大优先语义', async () => {
  const quote = await createUseCase([
    campaign('campaign-1001', '1001', 18, 10),
    campaign('campaign-1002', '1002', 22, 10)
  ]).execute(plan.id)
  assert.equal(quote.campaignId, 'campaign-1002')
  assert.equal(quote.totalAmount, 122)
})
