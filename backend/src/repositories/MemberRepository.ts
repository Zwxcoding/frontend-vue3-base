import type { Member } from '../domain/member/Member.js'

export interface MemberRepository {
  findById(id: string): Promise<Member | null>
  findByOpenid(openid: string): Promise<Member | null>
  save(member: Member): Promise<void>
  updateProfile(member: Member): Promise<void>
}
