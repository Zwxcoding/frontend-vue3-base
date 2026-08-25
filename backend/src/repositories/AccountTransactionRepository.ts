import type { AccountTransaction, AccountTransactionType } from '../domain/account/AccountTransaction.js'

export interface AccountTransactionRepository {
  save(transaction: AccountTransaction): Promise<void>
  findByReference(referenceType: string, referenceId: string, transactionType: AccountTransactionType): Promise<AccountTransaction | null>
  findByMemberId(memberId: string): Promise<readonly AccountTransaction[]>
}
