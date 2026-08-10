import assert from 'node:assert/strict'
import test from 'node:test'
import { AdminRechargeCampaignService } from '../src/application/AdminRechargeCampaignService.js'
import { RechargeCampaign } from '../src/domain/recharge/RechargeCampaign.js'
import { RechargePlan } from '../src/domain/recharge/RechargePlan.js'
import type { RechargeCampaignRepository } from '../src/repositories/RechargeCampaignRepository.js'
import type { RechargePlanRepository } from '../src/repositories/RechargePlanRepository.js'

class Campaigns implements RechargeCampaignRepository {
  items = new Map<string, RechargeCampaign>()
  async findAll() { return [...this.items.values()] }
  async findById(id: string) { return this.items.get(id) ?? null }
  async save(item: RechargeCampaign) { this.items.set(item.id, item) }
  async findEffectiveCampaigns(amount: number, now: Date) {
    return [...this.items.values()].filter((item) => item.matches(amount, now))
  }
}
class Plans implements RechargePlanRepository {
  plan = new RechargePlan({ id: 'plan-100', name: '100元', amount: 100, baseBonus: 15, status: 'active', sort: 1, version: 1 })
  async findById(id: string) { return id === this.plan.id ? this.plan : null }
  async findAnyById(id: string) { return this.findById(id) }
  async findActivePlans() { return [this.plan] }
  async findAll() { return [this.plan] }
  async save(plan: RechargePlan) { this.plan = plan }
}

const now = new Date('2026-08-09T00:00:00Z')
const input = { name: '充值活动', type: 'recharge', thresholdAmount: 100, bonusAmount: 20,
  priority: 10, effectMode: 'override', status: 'active', approvalStatus: 'approved',
  startTime: '2026-08-01T00:00:00Z', endTime: '2026-08-31T00:00:00Z', operator: 'admin' }

test('Campaign支持新增、编辑、冲突提示、preview和历史Quote隔离', async () => {
  const campaigns = new Campaigns()
  let sequence = 0
  const service = new AdminRechargeCampaignService(campaigns, new Plans(), () => new Date(now), () => `campaign-${++sequence}`)
  const first = await service.create(input)
  assert.equal(first.version, 1)
  const conflict = await service.create({ ...input, name: '冲突活动', priority: 5 })
  assert.equal(conflict.warning, true)

  const oldPreview = await service.preview(100)
  assert.equal(oldPreview.quote.finalBonus, 20)
  await service.update(first.id, { bonusAmount: 30 })
  const newPreview = await service.preview(100)
  assert.equal(oldPreview.quote.finalBonus, 20)
  assert.equal(newPreview.quote.finalBonus, 30)
  assert.equal(newPreview.quote.totalAmount, 130)
})

test('Campaign校验固定recharge与override并验证时间', async () => {
  const service = new AdminRechargeCampaignService(new Campaigns(), new Plans())
  await assert.rejects(() => service.create({ ...input, type: 'discount' }), /must be recharge/)
  await assert.rejects(() => service.create({ ...input, effectMode: 'stack' }), /must be override/)
  await assert.rejects(() => service.create({ ...input, startTime: input.endTime, endTime: input.startTime }), /time range/)
})
