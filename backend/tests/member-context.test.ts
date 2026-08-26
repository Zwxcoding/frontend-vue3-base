import assert from 'node:assert/strict'
import test from 'node:test'
import type { IncomingMessage } from 'node:http'
import { createMemberIdentityResolver } from '../src/controllers/memberContext.js'
import { SessionStore } from '../src/application/auth/SessionStore.js'

const requestWithHeaders = (headers: Record<string, string> = {}): IncomingMessage => ({
  headers
}) as IncomingMessage

const makeStore = () => new SessionStore({ ttlMs: 60_000, cleanupIntervalMs: 60_000 })

test('非生产环境 session token 优先于 dev token', () => {
  const store = makeStore()
  const { token } = store.create('member-from-session')
  const resolve = createMemberIdentityResolver({
    nodeEnv: 'development',
    devMemberToken: 'local-token',
    devMemberId: 'dev-member-id',
    sessionStore: store
  })
  const req = requestWithHeaders({
    'x-session-token': token,
    'x-dev-member-token': 'local-token'
  })
  assert.equal(resolve(req), 'member-from-session')
})

test('session token 解析后 lastAccessAt 更新', async () => {
  const store = makeStore()
  const { token } = store.create('member-x')
  const resolve = createMemberIdentityResolver({
    nodeEnv: 'development', devMemberToken: '', devMemberId: '', sessionStore: store
  })
  assert.equal(resolve(requestWithHeaders({ 'x-session-token': token })), 'member-x')
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(resolve(requestWithHeaders({ 'x-session-token': token })), 'member-x')
})

test('session token 无效时不 fallback 到 dev token，直接 401', () => {
  const store = makeStore()
  const resolve = createMemberIdentityResolver({
    nodeEnv: 'development', devMemberToken: 'local-token', devMemberId: 'dev-member-id', sessionStore: store
  })
  assert.throws(
    () => resolve(requestWithHeaders({ 'x-session-token': 'invalid', 'x-dev-member-token': 'local-token' })),
    /Unauthorized member session/
  )
})

test('session token 无效且非生产也未带 dev token 时抛错', () => {
  const store = makeStore()
  const resolve = createMemberIdentityResolver({
    nodeEnv: 'development', devMemberToken: 'local-token', devMemberId: 'dev-member-id', sessionStore: store
  })
  assert.throws(() => resolve(requestWithHeaders()), /Unauthorized/)
})

test('生产环境 dev token 完全不生效', () => {
  const store = makeStore()
  const resolve = createMemberIdentityResolver({
    nodeEnv: 'production', devMemberToken: 'local-token', devMemberId: 'dev-member-id', sessionStore: store
  })
  assert.throws(
    () => resolve(requestWithHeaders({ 'x-dev-member-token': 'local-token' })),
    /Unauthorized/
  )
})

test('生产环境有效 session token 解析成功', () => {
  const store = makeStore()
  const { token } = store.create('prod-member')
  const resolve = createMemberIdentityResolver({
    nodeEnv: 'production', devMemberToken: '', devMemberId: '', sessionStore: store
  })
  assert.equal(resolve(requestWithHeaders({ 'x-session-token': token })), 'prod-member')
})

test('session token 缺失在生产抛错', () => {
  const store = makeStore()
  const resolve = createMemberIdentityResolver({
    nodeEnv: 'production', devMemberToken: '', devMemberId: '', sessionStore: store
  })
  assert.throws(() => resolve(requestWithHeaders()), /Unauthorized/)
})

test('SessionStore TTL 过期自动清理', async () => {
  const store = new SessionStore({ ttlMs: 10, cleanupIntervalMs: 60_000 })
  const { token } = store.create('member-y')
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(store.resolve(token), null)
  assert.equal(store.size(), 0)
})

test('SessionStore revoke 后不可用', () => {
  const store = makeStore()
  const { token } = store.create('member-z')
  store.revoke(token)
  assert.equal(store.resolve(token), null)
})
