import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const frontend = (path: string) => readFile(resolve(process.cwd(), '..', 'src', path), 'utf8')

test('Member只读迁移使用me API且不写Storage', async () => {
  const service = await frontend('services/memberReadService.js')
  assert.match(service, /\/api\/v1\/members\/me/)
  assert.match(service, /\/api\/v1\/accounts\/me/)
  assert.match(service, /DATABASE_FIRST/)
  assert.match(service, /legacy-storage/)
  assert.doesNotMatch(service, /setStorage|removeStorage|updateBalance|saveMemberInfo/)
})

test('只读页面接入Member读取适配器，资金执行页面保持未切换', async () => {
  const [memberPage, indexPage, rechargePage, consumePage] = await Promise.all([
    frontend('pages/member/member.vue'), frontend('pages/index/index.vue'),
    frontend('pages/recharge/recharge.vue'), frontend('pages/consume/index.vue')
  ])
  assert.match(memberPage, /getMemberReadSnapshot/)
  assert.match(indexPage, /getMemberReadSnapshot/)
  assert.match(rechargePage, /getMemberInfo/)
  assert.match(consumePage, /getMemberInfo/)
})
