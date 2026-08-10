import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const frontend = (path: string) => readFile(resolve(process.cwd(), '..', 'src', path), 'utf8')

test('Admin Service以HTTP API为主路径且页面不直接访问Storage', async () => {
  const [planService, campaignService, planPage, campaignPage] = await Promise.all([
    frontend('services/rechargePlanAdminService.js'),
    frontend('services/rechargeCampaignAdminService.js'),
    frontend('pages/admin/recharge-plan/index.vue'),
    frontend('pages/admin/recharge-campaign/index.vue')
  ])
  assert.match(planService, /requestBackend\(\{ url: '\/api\/admin\/recharge\/plans'/)
  assert.match(campaignService, /requestBackend\(\{ url: '\/api\/admin\/recharge\/campaigns'/)
  assert.doesNotMatch(planPage, /Storage|setStorage|getStorage/)
  assert.doesNotMatch(campaignPage, /Storage|setStorage|getStorage/)
})

test('用户RechargePlan和Quote优先读取后端并保留Storage只读Fallback', async () => {
  const service = await frontend('services/rechargeApiService.js')
  assert.match(service, /\/api\/v1\/recharge\/plans/)
  assert.match(service, /\/api\/v1\/recharge\/quotes/)
  assert.match(service, /catch\(\(\) => getRechargePlans\(\)\)/)
  assert.match(service, /catch\(\(\) => calculateRechargeQuote/)
  assert.doesNotMatch(service, /setStorage|removeStorage/)
})
