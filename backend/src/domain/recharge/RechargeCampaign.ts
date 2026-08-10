import { toMoney } from './money.js'

export type RechargeCampaignStatus = 'active' | 'inactive'
export type RechargeCampaignApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export interface RechargeCampaignProps {
  id: string
  activityId: string | null
  name: string
  thresholdAmount: number
  bonusAmount: number
  priority: number
  effectMode: 'override'
  status: RechargeCampaignStatus
  approvalStatus: RechargeCampaignApprovalStatus
  startTime: Date
  endTime: Date
  version: number
  source?: string
  operator?: string
  operationReason?: string
  createTime?: Date
  updateTime?: Date
}

export class RechargeCampaign {
  public readonly id: string
  public readonly activityId: string | null
  public readonly name: string
  public readonly thresholdAmount: number
  public readonly bonusAmount: number
  public readonly priority: number
  public readonly effectMode: 'override'
  public readonly status: RechargeCampaignStatus
  public readonly approvalStatus: RechargeCampaignApprovalStatus
  public readonly startTime: Date
  public readonly endTime: Date
  public readonly version: number
  public readonly type = 'recharge' as const
  public readonly source: string
  public readonly operator: string
  public readonly operationReason: string
  public readonly createTime: Date
  public readonly updateTime: Date

  constructor(props: RechargeCampaignProps) {
    if (!props.id || !props.name) throw new Error('Recharge campaign identity is required')
    if (props.thresholdAmount <= 0 || props.bonusAmount < 0) throw new Error('Recharge campaign amount is invalid')
    if (props.startTime.getTime() > props.endTime.getTime()) throw new Error('Recharge campaign time range is invalid')
    this.id = props.id
    this.activityId = props.activityId
    this.name = props.name
    this.thresholdAmount = toMoney(props.thresholdAmount)
    this.bonusAmount = toMoney(props.bonusAmount)
    this.priority = props.priority
    this.effectMode = props.effectMode
    this.status = props.status
    this.approvalStatus = props.approvalStatus
    this.startTime = new Date(props.startTime)
    this.endTime = new Date(props.endTime)
    this.version = props.version
    this.source = props.source ?? 'admin'
    this.operator = props.operator ?? ''
    this.operationReason = props.operationReason ?? ''
    this.createTime = new Date(props.createTime ?? 0)
    this.updateTime = new Date(props.updateTime ?? props.createTime ?? 0)
    Object.freeze(this)
  }

  matches(amount: number, now: Date): boolean {
    const timestamp = now.getTime()
    return this.status === 'active' &&
      this.approvalStatus === 'approved' &&
      timestamp >= this.startTime.getTime() &&
      timestamp <= this.endTime.getTime() &&
      amount >= this.thresholdAmount
  }
}
