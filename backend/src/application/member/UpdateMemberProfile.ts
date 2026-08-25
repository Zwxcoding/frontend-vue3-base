import type { Member } from '../../domain/member/Member.js'
import type { MemberRepository } from '../../repositories/MemberRepository.js'

export class UpdateMemberProfile {
  constructor(
    private readonly members: MemberRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(id: string, input: { mobile?: unknown; name?: unknown }): Promise<Member> {
    const member = await this.members.findById(id)
    if (!member) throw new Error('Member not found')
    const mobile = input.mobile === undefined ? undefined : String(input.mobile).trim() || null
    const name = input.name === undefined ? undefined : String(input.name).trim() || null
    const updated = member.updateProfile({ mobile, name }, this.now())
    await this.members.updateProfile(updated)
    return updated
  }
}
