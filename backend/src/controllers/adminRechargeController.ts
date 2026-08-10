import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AdminRechargeCampaignService } from '../application/AdminRechargeCampaignService.js'
import type { AdminRechargePlanService } from '../application/AdminRechargePlanService.js'
import { readJsonBody, sendApplicationError, sendJson } from './http.js'

export const createAdminRechargeController = (
  planService: AdminRechargePlanService,
  campaignService: AdminRechargeCampaignService
) => ({
  listPlans: async (_request: IncomingMessage, response: ServerResponse) => {
    try { sendJson(response, 200, { data: await planService.list() }) }
    catch (error) { sendApplicationError(response, error) }
  },
  createPlan: async (request: IncomingMessage, response: ServerResponse) => {
    try { sendJson(response, 201, { data: await planService.create(await readJsonBody(request)) }) }
    catch (error) { sendApplicationError(response, error) }
  },
  updatePlan: async (request: IncomingMessage, response: ServerResponse, id: string) => {
    try { sendJson(response, 200, { data: await planService.update(id, await readJsonBody(request)) }) }
    catch (error) { sendApplicationError(response, error) }
  },
  changePlanStatus: async (request: IncomingMessage, response: ServerResponse, id: string) => {
    try {
      const body = await readJsonBody(request)
      sendJson(response, 200, { data: await planService.changeStatus(id, body.status) })
    } catch (error) { sendApplicationError(response, error) }
  },
  listCampaigns: async (_request: IncomingMessage, response: ServerResponse) => {
    try { sendJson(response, 200, { data: await campaignService.list() }) }
    catch (error) { sendApplicationError(response, error) }
  },
  createCampaign: async (request: IncomingMessage, response: ServerResponse) => {
    try { sendJson(response, 201, { data: await campaignService.create(await readJsonBody(request)) }) }
    catch (error) { sendApplicationError(response, error) }
  },
  updateCampaign: async (request: IncomingMessage, response: ServerResponse, id: string) => {
    try { sendJson(response, 200, { data: await campaignService.update(id, await readJsonBody(request)) }) }
    catch (error) { sendApplicationError(response, error) }
  },
  changeCampaignStatus: async (request: IncomingMessage, response: ServerResponse, id: string) => {
    try {
      const body = await readJsonBody(request)
      sendJson(response, 200, { data: await campaignService.changeStatus(id, body.status, body) })
    } catch (error) { sendApplicationError(response, error) }
  },
  previewCampaign: async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const body = await readJsonBody(request)
      sendJson(response, 200, { data: await campaignService.preview(body.amount) })
    } catch (error) { sendApplicationError(response, error) }
  }
})

export type AdminRechargeController = ReturnType<typeof createAdminRechargeController>
