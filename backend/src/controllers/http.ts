import type { IncomingMessage, ServerResponse } from 'node:http'

export const readJsonBody = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}

export const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

export const sendApplicationError = (response: ServerResponse, error: unknown): void => {
  const message = error instanceof Error ? error.message : 'Unexpected error'
  const unauthorized = /unauthorized|identity is disabled|identity is not configured/i.test(message)
  const notFound = /not found/i.test(message)
  const invalid = /invalid|required|must|exists/i.test(message)
  const status = unauthorized ? 401 : notFound ? 404 : invalid ? 400 : 500
  const code = unauthorized ? 'UNAUTHORIZED' : notFound ? 'NOT_FOUND' : invalid ? 'INVALID_INPUT' : 'INTERNAL_ERROR'
  sendJson(response, status, { error: { code, message } })
}
