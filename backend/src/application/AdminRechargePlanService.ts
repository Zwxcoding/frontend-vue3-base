import { randomUUID } from 'node:crypto'
import { RechargePlan, type RechargePlanStatus } from '../domain/recharge/RechargePlan.js'
import type { RechargePlanRepository } from '../repositories/RechargePlanRepository.js'

export interface RechargePlanAdminInput {
  name?: unknown
  amount?: unknown
  baseBonus?: unknown
  sort?: unknown
  status?: unknown
}

export class AdminRechargePlanService {
  constructor(
    private readonly plans: RechargePlanRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => `plan_${randomUUID()}`
  ) {}

  list(): Promise<readonly RechargePlan[]> { return this.plans.findAll() }

  async create(input: RechargePlanAdminInput): Promise<RechargePlan> {
    const normalized = this.validate(input)
    await this.assertAmountUnique(normalized.amount)
    const timestamp = this.now()
    const plan = new RechargePlan({
      id: this.createId(), ...normalized, version: 1, source: 'admin',
      createTime: timestamp, updateTime: timestamp
    })
    await this.plans.save(plan)
    return plan
  }

  async update(id: string, input: RechargePlanAdminInput): Promise<RechargePlan> {
    const current = await this.requirePlan(id)
    const normalized = this.validate({
      name: input.name ?? current.name,
      amount: input.amount ?? current.amount,
      baseBonus: input.baseBonus ?? current.baseBonus,
      sort: input.sort ?? current.sort,
      status: input.status ?? current.status
    })
    await this.assertAmountUnique(normalized.amount, id)
    const updated = new RechargePlan({
      id: current.id, ...normalized, version: current.version + 1, source: 'admin',
      createTime: current.createTime, updateTime: this.now()
    })
    await this.plans.save(updated)
    return updated
  }

  async changeStatus(id: string, status: unknown): Promise<RechargePlan> {
    return this.update(id, { status })
  }

  private async requirePlan(id: string): Promise<RechargePlan> {
    const plan = await this.plans.findAnyById(id)
    if (!plan) throw new Error('Recharge plan not found')
    return plan
  }

  private async assertAmountUnique(amount: number, editingId?: string): Promise<void> {
    const duplicate = (await this.plans.findAll()).find((plan) =>
      plan.id !== editingId && plan.amount === amount && plan.status === 'active'
    )
    if (duplicate) throw new Error('Active recharge plan amount already exists')
  }

  private validate(input: RechargePlanAdminInput): {
    name: string; amount: number; baseBonus: number; sort: number; status: RechargePlanStatus
  } {
    const name = String(input.name ?? '').trim()
    const amount = Number(input.amount)
    const baseBonus = Number(input.baseBonus)
    const sort = Number(input.sort ?? 0)
    const status = (input.status ?? 'active') as RechargePlanStatus
    if (!name) throw new Error('Recharge plan name is required')
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Recharge plan amount must be greater than 0')
    if (!Number.isFinite(baseBonus) || baseBonus < 0) throw new Error('Base bonus must not be negative')
    if (!Number.isFinite(sort)) throw new Error('Recharge plan sort is invalid')
    if (!['active', 'inactive'].includes(status)) throw new Error('Recharge plan status is invalid')
    return { name, amount, baseBonus, sort, status }
  }
}
