import { createServer } from 'node:http'
import { CreateRechargeQuote } from './application/CreateRechargeQuote.js'
import { AdminRechargePlanService } from './application/AdminRechargePlanService.js'
import { AdminRechargeCampaignService } from './application/AdminRechargeCampaignService.js'
import { createRouter } from './api/router.js'
import { loadConfig } from './config/env.js'
import { createRechargeQuoteController } from './controllers/rechargeQuoteController.js'
import { createAdminRechargeController } from './controllers/adminRechargeController.js'
import { sendJson } from './controllers/http.js'
import { getDatabasePool } from './database/pool.js'
import { PostgresRechargeCampaignRepository } from './repositories/postgres/PostgresRechargeCampaignRepository.js'
import { PostgresRechargePlanRepository } from './repositories/postgres/PostgresRechargePlanRepository.js'
import { PostgresRechargeQuoteRepository } from './repositories/postgres/PostgresRechargeQuoteRepository.js'

const config = loadConfig()

const database = getDatabasePool()
const plans = new PostgresRechargePlanRepository(database)
const campaigns = new PostgresRechargeCampaignRepository(database)
const quotes = new PostgresRechargeQuoteRepository(database)

const createQuote = new CreateRechargeQuote({ plans, campaigns, quotes })
const adminPlans = new AdminRechargePlanService(plans)
const adminCampaigns = new AdminRechargeCampaignService(campaigns, plans)
const router = createRouter({
  createRechargeQuote: createRechargeQuoteController(createQuote),
  listRechargePlans: async (_request, response) => {
    sendJson(response, 200, { data: await plans.findActivePlans() })
  },
  admin: createAdminRechargeController(adminPlans, adminCampaigns)
})
const server = createServer(router)

server.listen(config.port, () => {
  console.log(`Backend skeleton listening on http://localhost:${config.port}`)
})
