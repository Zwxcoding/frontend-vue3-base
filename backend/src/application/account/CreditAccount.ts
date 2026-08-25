import type { AccountOperationResult, AccountService } from '../../domain/account/AccountService.js'
import type { MemberAccountRepository } from '../../repositories/MemberAccountRepository.js'

export class CreditAccount {
  constructor(
    private readonly accounts: MemberAccountRepository,
    private readonly accountService: AccountService
  ) {}

  async execute(memberId: string, input: Record<string, unknown>): Promise<AccountOperationResult> {
    const account = await this.accounts.findByMemberId(memberId)
    if (!account) throw new Error('Member account not found')
    return this.accountService.credit(account.id, Number(input.amount), this.reference(input))
  }

  private reference(input: Record<string, unknown>): { referenceType: string; referenceId: string } {
    return { referenceType: String(input.referenceType ?? ''), referenceId: String(input.referenceId ?? '') }
  }
}
