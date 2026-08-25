import type { MemberAccount } from '../domain/account/MemberAccount.js'

export interface MemberAccountRepository {
  findByMemberId(memberId: string): Promise<MemberAccount | null>
  findByIdForUpdate(id: string): Promise<MemberAccount | null>
  create(account: MemberAccount): Promise<void>
  updateBalanceWithVersion(account: MemberAccount, expectedVersion: number): Promise<boolean>
}
