import assert from 'node:assert/strict'
import test from 'node:test'
import { AdminRechargePlanService } from '../src/application/AdminRechargePlanService.js'
import { RechargePlan } from '../src/domain/recharge/RechargePlan.js'
import type { RechargePlanRepository } from '../src/repositories/RechargePlanRepository.js'

class Plans implements RechargePlanRepository {
  items = new Map<string, RechargePlan>()
  async findById(id: string) { const item = this.items.get(id); return item?.isActive ? item : null }
  async findAnyById(id: string) { return this.items.get(id) ?? null }
  async findActivePlans() { return [...this.items.values()].filter((item) => item.isActive) }
  async findAll() { return [...this.items.values()] }
  async save(plan: RechargePlan) { this.items.set(plan.id, plan) }
}

test('Plan后台支持查询、新增、编辑、version递增和上下架', async () => {
  const repository = new Plans()
  const service = new AdminRechargePlanService(repository, () => new Date('2026-08-09T00:00:00Z'), () => 'plan-admin-100')
  const created = await service.create({ name: '100元套餐', amount: 100, baseBonus: 15, sort: 20 })
  assert.equal(created.version, 1)
  assert.equal(created.source, 'admin')
  assert.equal((await service.list()).length, 1)

  const updated = await service.update(created.id, { baseBonus: 20 })
  assert.equal(updated.version, 2)
  assert.equal(updated.baseBonus, 20)
  const disabled = await service.changeStatus(created.id, 'inactive')
  assert.equal(disabled.version, 3)
  assert.equal((await repository.findActivePlans()).length, 0)
  const enabled = await service.changeStatus(created.id, 'active')
  assert.equal(enabled.version, 4)
})

test('Plan参数校验拒绝非法金额和赠送', async () => {
  const service = new AdminRechargePlanService(new Plans())
  await assert.rejects(() => service.create({ name: '无效', amount: 0, baseBonus: 0 }), /greater than 0/)
  await assert.rejects(() => service.create({ name: '无效', amount: 100, baseBonus: -1 }), /negative/)
})
