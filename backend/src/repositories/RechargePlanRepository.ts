import type { RechargePlan } from '../domain/recharge/RechargePlan.js'

export interface RechargePlanRepository {
  findById(id: string): Promise<RechargePlan | null>
  findActivePlans(): Promise<readonly RechargePlan[]>
  findAll(): Promise<readonly RechargePlan[]>
  findAnyById(id: string): Promise<RechargePlan | null>
  save(plan: RechargePlan): Promise<void>
}
