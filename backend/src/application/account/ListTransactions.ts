import type { AccountTransaction } from '../../domain/account/AccountTransaction.js'
import type { AccountTransactionRepository } from '../../repositories/AccountTransactionRepository.js'

export class ListTransactions {
  constructor(private readonly transactions: AccountTransactionRepository) {}

  execute(memberId: string): Promise<readonly AccountTransaction[]> {
    return this.transactions.findByMemberId(memberId)
  }
}
