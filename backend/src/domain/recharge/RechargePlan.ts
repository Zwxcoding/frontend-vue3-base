import { toMoney } from './money.js'

export type RechargePlanStatus = 'active' | 'inactive'

export interface RechargePlanProps {
  id: string
  name: string
  amount: number
  baseBonus: number
  status: RechargePlanStatus
  sort: number
  version: number
  source?: string
  createTime?: Date
  updateTime?: Date
}

export class RechargePlan {
  public readonly id: string
  public readonly name: string
  public readonly amount: number
  public readonly baseBonus: number
  public readonly status: RechargePlanStatus
  public readonly sort: number
  public readonly version: number
  public readonly source: string
  public readonly createTime: Date
  public readonly updateTime: Date

  constructor(props: RechargePlanProps) {
    if (!props.id || !props.name) throw new Error('Recharge plan identity is required')
    if (props.amount <= 0 || props.baseBonus < 0) throw new Error('Recharge plan amount is invalid')
    this.id = props.id
    this.name = props.name
    this.amount = toMoney(props.amount)
    this.baseBonus = toMoney(props.baseBonus)
    this.status = props.status
    this.sort = props.sort
    this.version = props.version
    this.source = props.source ?? 'admin'
    this.createTime = new Date(props.createTime ?? 0)
    this.updateTime = new Date(props.updateTime ?? props.createTime ?? 0)
    Object.freeze(this)
  }

  get isActive(): boolean {
    return this.status === 'active'
  }
}
