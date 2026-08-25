import type { IncomingMessage, ServerResponse } from 'node:http'
import type { GetMember } from '../application/member/GetMember.js'
import type { UpdateMemberProfile } from '../application/member/UpdateMemberProfile.js'
import { readJsonBody, sendApplicationError, sendJson } from './http.js'
import type { ResolveCurrentMemberId } from './memberContext.js'

export const createMemberController = (
  getMember: GetMember,
  updateMemberProfile: UpdateMemberProfile,
  resolveCurrentMemberId: ResolveCurrentMemberId
) => ({
  getCurrent: async (request: IncomingMessage, response: ServerResponse) => {
    try { sendJson(response, 200, { data: await getMember.execute(resolveCurrentMemberId(request)) }) }
    catch (error) { sendApplicationError(response, error) }
  },
  get: async (_request: IncomingMessage, response: ServerResponse, id: string) => {
    try { sendJson(response, 200, { data: await getMember.execute(id) }) }
    catch (error) { sendApplicationError(response, error) }
  },
  updateProfile: async (request: IncomingMessage, response: ServerResponse, id: string) => {
    try { sendJson(response, 200, { data: await updateMemberProfile.execute(id, await readJsonBody(request)) }) }
    catch (error) { sendApplicationError(response, error) }
  }
})

export type MemberController = ReturnType<typeof createMemberController>
