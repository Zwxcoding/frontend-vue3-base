const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const projectRoot = path.resolve(__dirname, '..')

const loadServices = () => {
  const source = `
    export {
      getStoredSessionToken,
      getStoredSessionMemberId,
      isSessionExpired,
      loginWithWx,
      ensureLogin,
      logoutWx,
      buildSessionIdentityHeader
    } from './src/services/wxLoginService.js'
  `
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: projectRoot, sourcefile: 'wx-login-test-entry.js' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const loadedModule = new Module('wx-login-test-bundle')
  loadedModule.filename = path.join(projectRoot, 'tests', 'wx-login-test-bundle.cjs')
  loadedModule.paths = Module._nodeModulePaths(projectRoot)
  loadedModule._compile(result.outputFiles[0].text, loadedModule.filename)
  return loadedModule.exports
}

const storage = new Map()
const wxLoginCalls = []
let uniRequestHandler = null
global.uni = {
  getStorageSync: (key) => storage.has(key) ? storage.get(key) : '',
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: (key) => storage.delete(key),
  login: (options) => {
    wxLoginCalls.push('login')
    options.success?.({ code: 'mock-code' })
  },
  request: (options) => {
    wxLoginCalls.push('request')
    if (!uniRequestHandler) {
      options.fail?.({ errMsg: 'no handler' })
      return
    }
    uniRequestHandler(options)
  }
}

const services = loadServices()

const installHandler = (handler) => { uniRequestHandler = handler }

const okResponse = (data, statusCode = 200) => ({
  statusCode,
  data: { data }
})

test.beforeEach(() => {
  storage.clear()
  wxLoginCalls.length = 0
  uniRequestHandler = null
})

test('WL-01 storage 已有有效 session 时 loginWithWx 不调用 wx.login', async () => {
  storage.set('wxSessionToken', 'existing-token')
  storage.set('wxSessionMemberId', 'existing-member')
  storage.set('wxSessionExpiresAt', new Date(Date.now() + 60_000).toISOString())

  const result = await services.loginWithWx()

  assert.equal(result.sessionToken, 'existing-token')
  assert.equal(result.memberId, 'existing-member')
  assert.equal(wxLoginCalls.length, 0)
})

test('WL-02 storage 没有 session 时 loginWithWx 调 wx.login 并 POST wx-login', async () => {
  let captured = null
  installHandler((options) => {
    captured = { url: options.url, method: options.method, data: options.data, header: options.header }
    options.success(okResponse({ memberId: 'm-1', sessionToken: 't-1', expiresAt: new Date(Date.now() + 60_000).toISOString() }))
  })

  const result = await services.loginWithWx()

  assert.equal(result.sessionToken, 't-1')
  assert.equal(result.memberId, 'm-1')
  assert.match(captured.url, /\/api\/v1\/auth\/wx-login$/)
  assert.equal(captured.method, 'POST')
  assert.deepEqual(captured.data, { code: 'mock-code' })
  assert.equal(storage.get('wxSessionToken'), 't-1')
  assert.equal(storage.get('wxSessionMemberId'), 'm-1')
})

test('WL-03 force=true 时即使有 session 也重新登录', async () => {
  storage.set('wxSessionToken', 'old-token')
  storage.set('wxSessionMemberId', 'old-member')
  installHandler((options) => {
    options.success(okResponse({ memberId: 'm-2', sessionToken: 't-2', expiresAt: new Date(Date.now() + 60_000).toISOString() }))
  })

  const result = await services.loginWithWx({ force: true })

  assert.equal(result.sessionToken, 't-2')
  assert.equal(wxLoginCalls.length, 2)
})

test('WL-04 后端返回 MEMBER_NOT_REGISTERED 时 ensureLogin 静默返回 null', async () => {
  installHandler((options) => {
    options.success({ statusCode: 401, data: { error: { code: 'MEMBER_NOT_REGISTERED' } } })
  })
  const result = await services.ensureLogin()
  assert.equal(result, null)
})

test('WL-05 后端返回 500 时 ensureLogin 抛出', async () => {
  installHandler((options) => {
    options.success({ statusCode: 500, data: { error: { code: 'INTERNAL_ERROR' } } })
  })
  await assert.rejects(() => services.ensureLogin(), /500|INTERNAL|请求失败/)
})

test('WL-06 isSessionExpired 在过期时返回 true', () => {
  storage.set('wxSessionExpiresAt', new Date(Date.now() - 1000).toISOString())
  assert.equal(services.isSessionExpired(), true)
})

test('WL-07 buildSessionIdentityHeader 在无 token 时返回空对象', () => {
  assert.deepEqual(services.buildSessionIdentityHeader(), {})
})

test('WL-08 buildSessionIdentityHeader 在有 token 时带 x-session-token', () => {
  storage.set('wxSessionToken', 'session-abc')
  assert.deepEqual(services.buildSessionIdentityHeader(), { 'x-session-token': 'session-abc' })
})

test('WL-09 logoutWx 清除本地 session 并调 logout', async () => {
  storage.set('wxSessionToken', 'doomed-token')
  storage.set('wxSessionMemberId', 'doomed-member')
  let captured = null
  installHandler((options) => {
    captured = { url: options.url, header: options.header }
    options.success(okResponse({ ok: true }))
  })

  await services.logoutWx()

  assert.match(captured.url, /\/api\/v1\/auth\/logout$/)
  assert.equal(captured.header['x-session-token'], 'doomed-token')
  assert.equal(storage.has('wxSessionToken'), false)
  assert.equal(storage.has('wxSessionMemberId'), false)
})

test('WL-10 logoutWx 后端失败时本地 session 仍被清空', async () => {
  storage.set('wxSessionToken', 'doomed')
  installHandler((options) => {
    options.fail({ errMsg: 'network down' })
  })

  await services.logoutWx()
  assert.equal(storage.has('wxSessionToken'), false)
})
