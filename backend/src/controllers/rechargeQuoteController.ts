import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CreateRechargeQuote } from '../application/CreateRechargeQuote.js'

const readJson = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

export const createRechargeQuoteController = (useCase: CreateRechargeQuote) =>
  async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      const body = await readJson(request) as { planId?: unknown }
      if (typeof body.planId !== 'string' || !body.planId.trim()) {
        sendJson(response, 400, { error: { code: 'INVALID_PLAN_ID', message: 'planId is required' } })
        return
      }
      const quote = await useCase.execute(body.planId.trim())
      sendJson(response, 201, { data: quote })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error'
      const status = message === 'Recharge plan not found' ? 404 : 500
      sendJson(response, status, { error: { code: status === 404 ? 'PLAN_NOT_FOUND' : 'INTERNAL_ERROR', message } })
    }
  }
