import { createServer } from 'node:http'
import { CreateRechargeQuote } from './application/CreateRechargeQuote.js'
import { AdminRechargePlanService } from './application/AdminRechargePlanService.js'
import { AdminRechargeCampaignService } from './application/AdminRechargeCampaignService.js'
import { CreditAccount } from './application/account/CreditAccount.js'
import { DebitAccount } from './application/account/DebitAccount.js'
import { GetAccount } from './application/account/GetAccount.js'
import { ListTransactions } from './application/account/ListTransactions.js'
import { GetMember } from './application/member/GetMember.js'
import { UpdateMemberProfile } from './application/member/UpdateMemberProfile.js'
import { LoginWithWxCode } from './application/auth/LoginWithWxCode.js'
import { SessionStore } from './application/auth/SessionStore.js'
import { createRouter } from './api/router.js'
import { loadConfig } from './config/env.js'
import { createRechargeQuoteController } from './controllers/rechargeQuoteController.js'
import { createAdminRechargeController } from './controllers/adminRechargeController.js'
import { createAccountController } from './controllers/accountController.js'
import { createMemberController } from './controllers/memberController.js'
import { createMemberIdentityResolver } from './controllers/memberContext.js'
import { createWxAuthController } from './controllers/wxAuthController.js'
import { sendJson } from './controllers/http.js'
import { getDatabasePool } from './database/pool.js'
import { PostgresRechargeCampaignRepository } from './repositories/postgres/PostgresRechargeCampaignRepository.js'
import { PostgresRechargePlanRepository } from './repositories/postgres/PostgresRechargePlanRepository.js'
import { PostgresRechargeQuoteRepository } from './repositories/postgres/PostgresRechargeQuoteRepository.js'
import { AccountService } from './domain/account/AccountService.js'
import { PostgresAccountTransactionManager } from './repositories/postgres/PostgresAccountTransactionManager.js'
import { PostgresAccountTransactionRepository } from './repositories/postgres/PostgresAccountTransactionRepository.js'
import { PostgresMemberAccountRepository } from './repositories/postgres/PostgresMemberAccountRepository.js'
import { PostgresMemberRepository } from './repositories/postgres/PostgresMemberRepository.js'

const config = loadConfig()

const database = getDatabasePool()
const plans = new PostgresRechargePlanRepository(database)
const campaigns = new PostgresRechargeCampaignRepository(database)
const quotes = new PostgresRechargeQuoteRepository(database)
const members = new PostgresMemberRepository(database)
const accounts = new PostgresMemberAccountRepository(database)
const transactions = new PostgresAccountTransactionRepository(database)
const accountDomainService = new AccountService(new PostgresAccountTransactionManager(database))
const sessionStore = new SessionStore()
sessionStore.start()
const resolveCurrentMemberId = createMemberIdentityResolver({
  nodeEnv: config.nodeEnv,
  devMemberToken: config.devMemberToken,
  devMemberId: config.devMemberId,
  sessionStore
})
const loginWithWxCode = new LoginWithWxCode(members, sessionStore, config.wxAppId, config.wxAppSecret)

const createQuote = new CreateRechargeQuote({ plans, campaigns, quotes })
const adminPlans = new AdminRechargePlanService(plans)
const adminCampaigns = new AdminRechargeCampaignService(campaigns, plans)
const router = createRouter({
  createRechargeQuote: createRechargeQuoteController(createQuote),
  listRechargePlans: async (_request, response) => {
    sendJson(response, 200, { data: await plans.findActivePlans() })
  },
  admin: createAdminRechargeController(adminPlans, adminCampaigns),
  members: createMemberController(new GetMember(members), new UpdateMemberProfile(members), resolveCurrentMemberId),
  accounts: createAccountController(
    new GetAccount(accounts),
    new CreditAccount(accounts, accountDomainService),
    new DebitAccount(accounts, accountDomainService),
    new ListTransactions(transactions),
    resolveCurrentMemberId
  ),
  wxAuth: createWxAuthController(loginWithWxCode, sessionStore),
  allowInternalMemberApi: config.nodeEnv !== 'production'
})
const server = createServer(router)

server.listen(config.port, () => {
  console.log(`Backend skeleton listening on http://localhost:${config.port}`)
})
