import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AdminRechargeController } from '../controllers/adminRechargeController.js'
import type { AccountController } from '../controllers/accountController.js'
import type { MemberController } from '../controllers/memberController.js'
import type { WxAuthController } from '../controllers/wxAuthController.js'

export type HttpHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void> | void

export interface ApiHandlers {
  createRechargeQuote: HttpHandler
  listRechargePlans: HttpHandler
  admin: AdminRechargeController
  members: MemberController
  accounts: AccountController
  wxAuth: WxAuthController
  allowInternalMemberApi: boolean
}

export const createRouter = (handlers: ApiHandlers): HttpHandler =>
  async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    if (request.method === 'POST' && pathname === '/api/v1/recharge/quotes') {
      await handlers.createRechargeQuote(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/v1/recharge/plans') {
      await handlers.listRechargePlans(request, response); return
    }
    if (request.method === 'POST' && pathname === '/api/v1/auth/wx-login') {
      await handlers.wxAuth.login(request, response)
      return
    }
    if (request.method === 'POST' && pathname === '/api/v1/auth/logout') {
      await handlers.wxAuth.logout(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/v1/members/me') {
      await handlers.members.getCurrent(request, response)
      return
    }
    if (request.method === 'GET' && pathname === '/api/v1/accounts/me') {
      await handlers.accounts.getCurrent(request, response)
      return
    }
    const memberMatch = pathname.match(/^\/api\/v1\/members\/([^/]+)$/)
    if (memberMatch?.[1]) {
      if (!handlers.allowInternalMemberApi) return sendNotFound(response)
      const id = decodeURIComponent(memberMatch[1])
      if (request.method === 'GET') await handlers.members.get(request, response, id)
      else return sendNotFound(response)
      return
    }
    const accountMatch = pathname.match(/^\/api\/v1\/accounts\/([^/]+)(?:\/(credit|debit))?$/)
    if (accountMatch?.[1]) {
      if (!handlers.allowInternalMemberApi) return sendNotFound(response)
      const memberId = decodeURIComponent(accountMatch[1])
      const action = accountMatch[2]
      if (request.method === 'GET' && !action) await handlers.accounts.get(request, response, memberId)
      else if (request.method === 'POST' && action === 'credit') await handlers.accounts.credit(request, response, memberId)
      else if (request.method === 'POST' && action === 'debit') await handlers.accounts.debit(request, response, memberId)
      else return sendNotFound(response)
      return
    }
    if (pathname === '/api/admin/recharge/plans') {
      if (request.method === 'GET') await handlers.admin.listPlans(request, response)
      else if (request.method === 'POST') await handlers.admin.createPlan(request, response)
      else return sendNotFound(response)
      return
    }
    const planMatch = pathname.match(/^\/api\/admin\/recharge\/plans\/([^/]+)(\/status)?$/)
    if (planMatch?.[1]) {
      if (request.method === 'PUT' && !planMatch[2]) await handlers.admin.updatePlan(request, response, decodeURIComponent(planMatch[1]))
      else if (request.method === 'PATCH' && planMatch[2]) await handlers.admin.changePlanStatus(request, response, decodeURIComponent(planMatch[1]))
      else return sendNotFound(response)
      return
    }
    if (pathname === '/api/admin/recharge/campaigns/preview' && request.method === 'POST') {
      await handlers.admin.previewCampaign(request, response); return
    }
    if (pathname === '/api/admin/recharge/campaigns') {
      if (request.method === 'GET') await handlers.admin.listCampaigns(request, response)
      else if (request.method === 'POST') await handlers.admin.createCampaign(request, response)
      else return sendNotFound(response)
      return
    }
    const campaignMatch = pathname.match(/^\/api\/admin\/recharge\/campaigns\/([^/]+)(\/status)?$/)
    if (campaignMatch?.[1]) {
      if (request.method === 'PUT' && !campaignMatch[2]) await handlers.admin.updateCampaign(request, response, decodeURIComponent(campaignMatch[1]))
      else if (request.method === 'PATCH' && campaignMatch[2]) await handlers.admin.changeCampaignStatus(request, response, decodeURIComponent(campaignMatch[1]))
      else return sendNotFound(response)
      return
    }
    sendNotFound(response)
  }

const sendNotFound = (response: ServerResponse): void => {
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Route not found' } }))
  }
