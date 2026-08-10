import { toMoney } from './money.js'
import type { RechargeCampaign } from './RechargeCampaign.js'
import type { RechargePlan } from './RechargePlan.js'

export interface RechargeRuleSnapshot {
  planId: string
  planVersion: number
  campaignId: string | null
  campaignVersion: number | null
  thresholdAmount: number | null
  priority: number | null
  baseBonus: number
  campaignBonus: number
  finalBonus: number
  effectMode: 'none' | 'override'
}

export interface RechargeQuoteProps {
  id: string
  plan: RechargePlan
  campaign: RechargeCampaign | null
  expireTime: Date
  createTime: Date
}

export interface StoredRechargeQuoteProps {
  id: string
  planId: string
  campaignId: string | null
  amount: number
  baseBonus: number
  campaignBonus: number
  finalBonus: number
  totalAmount: number
  effectMode: 'none' | 'override'
  ruleSnapshot: RechargeRuleSnapshot
  expireTime: Date
  createTime: Date
}

export class RechargeQuote {
  public readonly id: string
  public readonly quoteId: string
  public readonly planId: string
  public readonly campaignId: string | null
  public readonly amount: number
  public readonly rechargeAmount: number
  public readonly baseBonus: number
  public readonly campaignBonus: number
  public readonly finalBonus: number
  public readonly bonusAmount: number
  public readonly totalAmount: number
  public readonly effectMode: 'none' | 'override'
  public readonly bonusSource: 'plan' | 'campaign'
  public readonly ruleSnapshot: Readonly<RechargeRuleSnapshot>
  public readonly expireTime: Date
  public readonly createTime: Date

  constructor(props: RechargeQuoteProps) {
    const campaignBonus = props.campaign?.bonusAmount ?? 0
    const finalBonus = props.campaign ? campaignBonus : props.plan.baseBonus
    const effectMode = props.campaign ? props.campaign.effectMode : 'none'
    this.id = props.id
    this.quoteId = props.id
    this.planId = props.plan.id
    this.campaignId = props.campaign?.id ?? null
    this.amount = props.plan.amount
    this.rechargeAmount = props.plan.amount
    this.baseBonus = props.plan.baseBonus
    this.campaignBonus = toMoney(campaignBonus)
    this.finalBonus = toMoney(finalBonus)
    this.bonusAmount = this.finalBonus
    this.totalAmount = toMoney(this.amount + this.finalBonus)
    this.effectMode = effectMode
    this.bonusSource = props.campaign ? 'campaign' : 'plan'
    this.ruleSnapshot = Object.freeze({
      planId: props.plan.id,
      planVersion: props.plan.version,
      campaignId: props.campaign?.id ?? null,
      campaignVersion: props.campaign?.version ?? null,
      thresholdAmount: props.campaign?.thresholdAmount ?? null,
      priority: props.campaign?.priority ?? null,
      baseBonus: this.baseBonus,
      campaignBonus: this.campaignBonus,
      finalBonus: this.finalBonus,
      effectMode: this.effectMode
    })
    this.expireTime = new Date(props.expireTime)
    this.createTime = new Date(props.createTime)
    Object.freeze(this)
  }

  static restore(props: StoredRechargeQuoteProps): RechargeQuote {
    if (toMoney(props.amount + props.finalBonus) !== toMoney(props.totalAmount)) {
      throw new Error('Stored recharge quote amount is inconsistent')
    }
    const quote = Object.create(RechargeQuote.prototype) as RechargeQuote
    Object.assign(quote, {
      id: props.id,
      quoteId: props.id,
      planId: props.planId,
      campaignId: props.campaignId,
      amount: toMoney(props.amount),
      rechargeAmount: toMoney(props.amount),
      baseBonus: toMoney(props.baseBonus),
      campaignBonus: toMoney(props.campaignBonus),
      finalBonus: toMoney(props.finalBonus),
      bonusAmount: toMoney(props.finalBonus),
      totalAmount: toMoney(props.totalAmount),
      effectMode: props.effectMode,
      bonusSource: props.campaignId ? 'campaign' : 'plan',
      ruleSnapshot: Object.freeze({ ...props.ruleSnapshot }),
      expireTime: new Date(props.expireTime),
      createTime: new Date(props.createTime)
    })
    return Object.freeze(quote)
  }
}
