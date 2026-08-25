export type MemberStatus = 'active' | 'inactive'

export interface MemberProperties {
  id: string
  openid: string | null
  mobile: string | null
  name: string | null
  status: MemberStatus
  createTime: Date
  updateTime: Date
}

export class Member {
  readonly id: string
  readonly openid: string | null
  readonly mobile: string | null
  readonly name: string | null
  readonly status: MemberStatus
  readonly createTime: Date
  readonly updateTime: Date

  constructor(properties: MemberProperties) {
    if (!properties.id) throw new Error('Member id is required')
    if (!['active', 'inactive'].includes(properties.status)) throw new Error('Member status is invalid')
    this.id = properties.id
    this.openid = properties.openid?.trim() || null
    this.mobile = properties.mobile?.trim() || null
    this.name = properties.name?.trim() || null
    this.status = properties.status
    this.createTime = new Date(properties.createTime)
    this.updateTime = new Date(properties.updateTime)
  }

  updateProfile(profile: { mobile?: string | null; name?: string | null }, now = new Date()): Member {
    return new Member({
      ...this,
      mobile: profile.mobile === undefined ? this.mobile : profile.mobile,
      name: profile.name === undefined ? this.name : profile.name,
      updateTime: now
    })
  }
}
