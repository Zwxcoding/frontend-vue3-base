import type { MemberAccount } from '../../domain/account/MemberAccount.js'
import type { MemberAccountRepository } from '../../repositories/MemberAccountRepository.js'

export class GetAccount {
  constructor(private readonly accounts: MemberAccountRepository) {}

  async execute(memberId: string): Promise<MemberAccount> {
    const account = await this.accounts.findByMemberId(memberId)
    if (!account) throw new Error('Member account not found')
    return account
  }
}
