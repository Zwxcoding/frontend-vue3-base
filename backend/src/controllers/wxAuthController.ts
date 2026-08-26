import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody, sendApplicationError, sendJson } from './http.js'
import { LoginWithWxCode, extractSessionToken } from '../application/auth/LoginWithWxCode.js'
import type { SessionStore } from '../application/auth/SessionStore.js'

export interface WxAuthController {
  login: HttpHandler
  logout: HttpHandler
}

export type HttpHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void> | void

export const createWxAuthController = (
  loginWithWxCode: LoginWithWxCode,
  sessionStore: SessionStore
): WxAuthController => ({
  login: async (request, response) => {
    try {
      const body = await readJsonBody(request)
      const code = typeof body.code === 'string' ? body.code : ''
      const data = await loginWithWxCode.execute(code)
      sendJson(response, 200, { data })
    } catch (error) {
      sendApplicationError(response, error)
    }
  },
  logout: async (request, response) => {
    try {
      const token = extractSessionToken(request)
      if (token) sessionStore.revoke(token)
      sendJson(response, 200, { data: { ok: true } })
    } catch (error) {
      sendApplicationError(response, error)
    }
  }
})
