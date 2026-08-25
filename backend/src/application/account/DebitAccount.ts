import type { AccountOperationResult, AccountService } from '../../domain/account/AccountService.js'
import type { MemberAccountRepository } from '../../repositories/MemberAccountRepository.js'

export class DebitAccount {
  constructor(
    private readonly accounts: MemberAccountRepository,
    private readonly accountService: AccountService
  ) {}

  async execute(memberId: string, input: Record<string, unknown>): Promise<AccountOperationResult> {
    const account = await this.accounts.findByMemberId(memberId)
    if (!account) throw new Error('Member account not found')
    return this.accountService.debit(account.id, Number(input.amount), {
      referenceType: String(input.referenceType ?? ''), referenceId: String(input.referenceId ?? '')
    })
  }
}
