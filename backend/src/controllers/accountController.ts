import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CreditAccount } from '../application/account/CreditAccount.js'
import type { DebitAccount } from '../application/account/DebitAccount.js'
import type { GetAccount } from '../application/account/GetAccount.js'
import type { ListTransactions } from '../application/account/ListTransactions.js'
import { readJsonBody, sendApplicationError, sendJson } from './http.js'
import type { ResolveCurrentMemberId } from './memberContext.js'

export const createAccountController = (
  getAccount: GetAccount,
  creditAccount: CreditAccount,
  debitAccount: DebitAccount,
  listTransactions: ListTransactions,
  resolveCurrentMemberId: ResolveCurrentMemberId
) => ({
  getCurrent: async (request: IncomingMessage, response: ServerResponse) => {
    try { sendJson(response, 200, { data: await getAccount.execute(resolveCurrentMemberId(request)) }) }
    catch (error) { sendApplicationError(response, error) }
  },
  get: async (_request: IncomingMessage, response: ServerResponse, memberId: string) => {
    try { sendJson(response, 200, { data: await getAccount.execute(memberId) }) }
    catch (error) { sendApplicationError(response, error) }
  },
  credit: async (request: IncomingMessage, response: ServerResponse, memberId: string) => {
    try { sendJson(response, 200, { data: await creditAccount.execute(memberId, await readJsonBody(request)) }) }
    catch (error) { sendApplicationError(response, error) }
  },
  debit: async (request: IncomingMessage, response: ServerResponse, memberId: string) => {
    try { sendJson(response, 200, { data: await debitAccount.execute(memberId, await readJsonBody(request)) }) }
    catch (error) { sendApplicationError(response, error) }
  },
  listTransactions: async (_request: IncomingMessage, response: ServerResponse, memberId: string) => {
    try { sendJson(response, 200, { data: await listTransactions.execute(memberId) }) }
    catch (error) { sendApplicationError(response, error) }
  }
})

export type AccountController = ReturnType<typeof createAccountController>
