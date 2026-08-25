import assert from 'node:assert/strict'
import test from 'node:test'
import type { IncomingMessage } from 'node:http'
import { createDevelopmentMemberContext } from '../src/controllers/memberContext.js'

const requestWithToken = (token?: string): IncomingMessage => ({
  headers: token ? { 'x-dev-member-token': token } : {}
}) as IncomingMessage

test('非生产环境通过受控开发Token解析当前memberId', () => {
  const resolve = createDevelopmentMemberContext({
    nodeEnv: 'development', devMemberToken: 'local-token', devMemberId: 'member-001'
  })
  assert.equal(resolve(requestWithToken('local-token')), 'member-001')
})

test('无效开发Token不能获得会员身份', () => {
  const resolve = createDevelopmentMemberContext({
    nodeEnv: 'development', devMemberToken: 'local-token', devMemberId: 'member-001'
  })
  assert.throws(() => resolve(requestWithToken('wrong-token')), /Unauthorized/)
})

test('生产环境禁用开发会员身份', () => {
  const resolve = createDevelopmentMemberContext({
    nodeEnv: 'production', devMemberToken: 'local-token', devMemberId: 'member-001'
  })
  assert.throws(() => resolve(requestWithToken('local-token')), /disabled/)
})
