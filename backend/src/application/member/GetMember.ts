import type { Member } from '../../domain/member/Member.js'
import type { MemberRepository } from '../../repositories/MemberRepository.js'

export class GetMember {
  constructor(private readonly members: MemberRepository) {}

  async execute(id: string): Promise<Member> {
    const member = await this.members.findById(id)
    if (!member) throw new Error('Member not found')
    return member
  }
}
