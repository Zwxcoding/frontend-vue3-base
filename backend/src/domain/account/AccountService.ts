import { randomUUID } from 'node:crypto'
import type { AccountTransactionRepository } from '../../repositories/AccountTransactionRepository.js'
import type { MemberAccountRepository } from '../../repositories/MemberAccountRepository.js'
import { AccountTransaction, type AccountTransactionType } from './AccountTransaction.js'
import type { MemberAccount } from './MemberAccount.js'

export interface AccountUnitOfWork {
  accounts: MemberAccountRepository
  transactions: AccountTransactionRepository
}

export interface AccountTransactionManager {
  execute<T>(work: (unitOfWork: AccountUnitOfWork) => Promise<T>): Promise<T>
}

export interface AccountReference {
  referenceType: string
  referenceId: string
}

export interface AccountOperationResult {
  account: MemberAccount
  transaction: AccountTransaction
  duplicate: boolean
}

export class AccountService {
  constructor(
    private readonly transactionManager: AccountTransactionManager,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => randomUUID()
  ) {}

  credit(accountId: string, amount: number, reference: AccountReference): Promise<AccountOperationResult> {
    return this.changeBalance(accountId, amount, 'RECHARGE', reference)
  }

  debit(accountId: string, amount: number, reference: AccountReference): Promise<AccountOperationResult> {
    return this.changeBalance(accountId, amount, 'CONSUME', reference)
  }

  refund(accountId: string, amount: number, reference: AccountReference): Promise<AccountOperationResult> {
    return this.changeBalance(accountId, amount, 'REFUND', reference)
  }

  private async changeBalance(
    accountId: string,
    amount: number,
    transactionType: AccountTransactionType,
    reference: AccountReference
  ): Promise<AccountOperationResult> {
    if (!reference.referenceType?.trim() || !reference.referenceId?.trim()) {
      throw new Error('Account reference is required')
    }
    return this.transactionManager.execute(async ({ accounts, transactions }) => {
      const current = await accounts.findByIdForUpdate(accountId)
      if (!current) throw new Error('Member account not found')
      const existing = await transactions.findByReference(
        reference.referenceType.trim(), reference.referenceId.trim(), transactionType
      )
      if (existing) return { account: current, transaction: existing, duplicate: true }

      const timestamp = this.now()
      const updated = transactionType === 'CONSUME'
        ? current.debit(amount, timestamp)
        : transactionType === 'REFUND'
          ? current.refund(amount, timestamp)
          : current.credit(amount, timestamp)
      const transaction = new AccountTransaction({
        id: this.createId(), memberId: current.memberId, accountId: current.id,
        transactionType, amount, beforeBalance: current.balance, afterBalance: updated.balance,
        referenceType: reference.referenceType, referenceId: reference.referenceId, createTime: timestamp
      })
      await transactions.save(transaction)
      if (!await accounts.updateBalanceWithVersion(updated, current.version)) {
        throw new Error('Account concurrent update conflict')
      }
      return { account: updated, transaction, duplicate: false }
    })
  }
}
