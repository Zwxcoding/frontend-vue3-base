import type { IncomingMessage } from 'node:http'
import https from 'node:https'
import type { MemberRepository } from '../../repositories/MemberRepository.js'
import type { SessionStore } from './SessionStore.js'

export interface LoginResult {
  memberId: string
  sessionToken: string
  expiresAt: string
}

export interface WxSessionResponse {
  openid?: string
  session_key?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

export type HttpsRequestFn = (
  url: string,
  options: { method?: string },
  callback: (res: { on: (event: string, listener: (...args: unknown[]) => void) => void }) => void
) => { on: (event: string, listener: (...args: unknown[]) => void) => void; end: () => void }

const defaultHttpsRequest: HttpsRequestFn = (url, options, callback) => {
  const req = https.request(url, options, (res) => {
    callback(res as unknown as { on: (event: string, listener: (...args: unknown[]) => void) => void })
  })
  return req as unknown as { on: (event: string, listener: (...args: unknown[]) => void) => void; end: () => void }
}

export class LoginWithWxCode {
  private readonly httpsRequest: HttpsRequestFn

  constructor(
    private readonly memberRepository: MemberRepository,
    private readonly sessionStore: SessionStore,
    private readonly appId: string,
    private readonly appSecret: string,
    httpsRequest: HttpsRequestFn = defaultHttpsRequest
  ) {
    this.httpsRequest = httpsRequest
  }

  async execute(code: string): Promise<LoginResult> {
    if (!this.appId || !this.appSecret) {
      throw new Error('Wx identity is not configured')
    }
    if (!code || typeof code !== 'string') {
      throw new Error('Wx login code is required')
    }
    const wxSession = await this.exchangeCodeForOpenId(code)
    if (!wxSession.openid) {
      throw new Error('Wx code2Session did not return openid')
    }
    const member = await this.memberRepository.findByOpenid(wxSession.openid)
    if (!member) {
      const error = new Error('Member not registered')
      ;(error as Error & { code?: string }).code = 'MEMBER_NOT_REGISTERED'
      throw error
    }
    const { token, expiresAt } = this.sessionStore.create(member.id)
    return {
      memberId: member.id,
      sessionToken: token,
      expiresAt: new Date(expiresAt).toISOString()
    }
  }

  private exchangeCodeForOpenId(code: string): Promise<WxSessionResponse> {
    const params = new URLSearchParams({
      appid: this.appId,
      secret: this.appSecret,
      js_code: code,
      grant_type: 'authorization_code'
    })
    const url = `https://api.weixin.qq.com/sns/jscode2session?${params.toString()}`
    return new Promise((resolve, reject) => {
      const req = this.httpsRequest(url, { method: 'GET' }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (...args: unknown[]) => {
          const chunk = args[0] as Buffer | string
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
        })
        res.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as WxSessionResponse
            if (body.errcode && body.errcode !== 0) {
              reject(new Error(`Wx code2Session failed: ${body.errmsg ?? body.errcode}`))
              return
            }
            resolve(body)
          } catch {
            reject(new Error('Wx code2Session response parse error'))
          }
        })
      })
      req.on('error', reject)
      req.end()
    })
  }
}

export const extractSessionToken = (request: IncomingMessage): string | null => {
  const headerToken = request.headers['x-session-token']
  if (typeof headerToken === 'string' && headerToken.length > 0) return headerToken
  return null
}
