import type { RechargeQuote } from '../domain/recharge/RechargeQuote.js'

export interface RechargeQuoteRepository {
  save(quote: RechargeQuote): Promise<void>
  findById(id: string): Promise<RechargeQuote | null>
}
