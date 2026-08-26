import assert from 'node:assert/strict'
import test from 'node:test'
import { LoginWithWxCode, type HttpsRequestFn } from '../src/application/auth/LoginWithWxCode.js'
import { SessionStore } from '../src/application/auth/SessionStore.js'
import { Member } from '../src/domain/member/Member.js'
import type { MemberRepository } from '../src/repositories/MemberRepository.js'

class FakeMemberRepository implements MemberRepository {
  private readonly byOpenid = new Map<string, Member>()

  setByOpenid(openid: string, member: Member): void {
    this.byOpenid.set(openid, member)
  }

  async findById(id: string): Promise<Member | null> {
    for (const member of this.byOpenid.values()) if (member.id === id) return member
    return null
  }
  async findByOpenid(openid: string): Promise<Member | null> {
    return this.byOpenid.get(openid) ?? null
  }
  async save(): Promise<void> { /* not used in these tests */ }
  async updateProfile(): Promise<void> { /* not used in these tests */ }
}

const makeMember = (id: string, openid: string): Member => new Member({
  id, openid, mobile: '13800000000', name: '测试会员', status: 'active',
  createTime: new Date(), updateTime: new Date()
})

const makeHttpsRequest = (responses: Array<{ status?: number; body: unknown; err?: Error }>): HttpsRequestFn => {
  let index = 0
  return (_url, _options, callback) => {
    const handlers: Record<string, ((...args: unknown[]) => void)[]> = {}
    const emit = (event: string, ...args: unknown[]) => {
      for (const h of handlers[event] ?? []) h(...args)
    }
    const response = {
      on: (event: string, listener: (...args: unknown[]) => void) => {
        ;(handlers[event] ??= []).push(listener)
        if (event === 'data' || event === 'end') {
          queueMicrotask(() => {
            const next = responses[index++]
            if (!next) {
              emit('error', new Error('No more stubbed responses'))
              return
            }
            if (next.err) {
              emit('error', next.err)
              return
            }
            const payload = JSON.stringify(next.body)
            emit('data', Buffer.from(payload, 'utf8'))
            emit('end')
          })
        }
      }
    }
    const req = {
      on: (event: string, listener: (...args: unknown[]) => void) => {
        ;(handlers[event] ??= []).push(listener)
      },
      end: () => {}
    }
    queueMicrotask(() => callback(response as unknown as { on: (event: string, listener: (...args: unknown[]) => void) => void }))
    return req as unknown as ReturnType<HttpsRequestFn>
  }
}

test('未配置 appid/secret 时抛错', async () => {
  const repo = new FakeMemberRepository()
  const store = new SessionStore()
  const useCase = new LoginWithWxCode(repo, store, '', '')
  await assert.rejects(() => useCase.execute('any-code'), /not configured/)
})

test('code 缺失时抛错', async () => {
  const repo = new FakeMemberRepository()
  const store = new SessionStore()
  const useCase = new LoginWithWxCode(repo, store, 'appid', 'secret')
  await assert.rejects(() => useCase.execute(''), /required/)
})

test('微信返回 errcode 时抛出友好错误', async () => {
  const repo = new FakeMemberRepository()
  const store = new SessionStore()
  const useCase = new LoginWithWxCode(
    repo, store, 'appid', 'secret',
    makeHttpsRequest([{ body: { errcode: 40029, errmsg: 'invalid code' } }])
  )
  await assert.rejects(() => useCase.execute('bad-code'), /invalid code/)
})

test('openid 在 member 表不存在时返回 MEMBER_NOT_REGISTERED', async () => {
  const repo = new FakeMemberRepository()
  const store = new SessionStore()
  const useCase = new LoginWithWxCode(
    repo, store, 'appid', 'secret',
    makeHttpsRequest([{ body: { openid: 'unknown-openid' } }])
  )
  try {
    await useCase.execute('good-code')
    assert.fail('should throw')
  } catch (e) {
    assert.match((e as Error).message, /not registered/)
    assert.equal((e as Error & { code?: string }).code, 'MEMBER_NOT_REGISTERED')
  }
})

test('openid 命中 member 时返回 session token', async () => {
  const repo = new FakeMemberRepository()
  const member = makeMember('member-real', 'real-openid')
  repo.setByOpenid('real-openid', member)
  const store = new SessionStore()
  const useCase = new LoginWithWxCode(
    repo, store, 'appid', 'secret',
    makeHttpsRequest([{ body: { openid: 'real-openid', session_key: 'k' } }])
  )
  const result = await useCase.execute('good-code')
  assert.equal(result.memberId, 'member-real')
  assert.ok(result.sessionToken)
  assert.ok(result.expiresAt)
  assert.equal(store.resolve(result.sessionToken)?.memberId, 'member-real')
})
