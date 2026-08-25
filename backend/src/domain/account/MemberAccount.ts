export type AccountStatus = 'active' | 'frozen' | 'closed'

export interface MemberAccountProperties {
  id: string
  memberId: string
  balance: number
  version: number
  status: AccountStatus
  createTime: Date
  updateTime: Date
}

const money = (value: number): number => Number(value.toFixed(2))

export class MemberAccount {
  readonly id: string
  readonly memberId: string
  readonly balance: number
  readonly version: number
  readonly status: AccountStatus
  readonly createTime: Date
  readonly updateTime: Date

  constructor(properties: MemberAccountProperties) {
    if (!properties.id || !properties.memberId) throw new Error('Account identity is required')
    if (!Number.isFinite(properties.balance) || properties.balance < 0) throw new Error('Account balance is invalid')
    if (!Number.isInteger(properties.version) || properties.version <= 0) throw new Error('Account version is invalid')
    if (!['active', 'frozen', 'closed'].includes(properties.status)) throw new Error('Account status is invalid')
    this.id = properties.id
    this.memberId = properties.memberId
    this.balance = money(properties.balance)
    this.version = properties.version
    this.status = properties.status
    this.createTime = new Date(properties.createTime)
    this.updateTime = new Date(properties.updateTime)
  }

  getBalance(): number { return this.balance }

  credit(amount: number, now = new Date()): MemberAccount {
    this.assertActive()
    this.assertAmount(amount)
    return this.withBalance(this.balance + amount, now)
  }

  debit(amount: number, now = new Date()): MemberAccount {
    this.assertActive()
    this.assertAmount(amount)
    if (this.balance < money(amount)) throw new Error('Insufficient account balance')
    return this.withBalance(this.balance - amount, now)
  }

  refund(amount: number, now = new Date()): MemberAccount {
    return this.credit(amount, now)
  }

  private withBalance(balance: number, now: Date): MemberAccount {
    return new MemberAccount({ ...this, balance: money(balance), version: this.version + 1, updateTime: now })
  }

  private assertActive(): void {
    if (this.status !== 'active') throw new Error('Account is not active')
  }

  private assertAmount(amount: number): void {
    if (!Number.isFinite(amount) || money(amount) <= 0) throw new Error('Account amount must be greater than 0')
  }
}
