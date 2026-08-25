export type AccountTransactionType = 'RECHARGE' | 'CONSUME' | 'REFUND'

export interface AccountTransactionProperties {
  id: string
  memberId: string
  accountId: string
  transactionType: AccountTransactionType
  amount: number
  beforeBalance: number
  afterBalance: number
  referenceType: string
  referenceId: string
  createTime: Date
}

export class AccountTransaction {
  readonly id: string
  readonly memberId: string
  readonly accountId: string
  readonly transactionType: AccountTransactionType
  readonly amount: number
  readonly beforeBalance: number
  readonly afterBalance: number
  readonly referenceType: string
  readonly referenceId: string
  readonly createTime: Date

  constructor(properties: AccountTransactionProperties) {
    if (!properties.id || !properties.memberId || !properties.accountId) throw new Error('Transaction identity is required')
    if (!['RECHARGE', 'CONSUME', 'REFUND'].includes(properties.transactionType)) throw new Error('Transaction type is invalid')
    if (!Number.isFinite(properties.amount) || properties.amount <= 0) throw new Error('Transaction amount must be greater than 0')
    if (!properties.referenceType.trim() || !properties.referenceId.trim()) throw new Error('Transaction reference is required')
    this.id = properties.id
    this.memberId = properties.memberId
    this.accountId = properties.accountId
    this.transactionType = properties.transactionType
    this.amount = Number(properties.amount.toFixed(2))
    this.beforeBalance = Number(properties.beforeBalance.toFixed(2))
    this.afterBalance = Number(properties.afterBalance.toFixed(2))
    this.referenceType = properties.referenceType.trim()
    this.referenceId = properties.referenceId.trim()
    this.createTime = new Date(properties.createTime)
    Object.freeze(this)
  }
}
