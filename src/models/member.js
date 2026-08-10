export const DEFAULT_MEMBER = Object.freeze({
  registered: false,
  phone: '',
  plate: '',
  level: '黄金会员',
  balance: 0,
  points: 0,
  coupons: 0,
  benefits: []
})

export const createMember = (data = {}) => ({
  ...DEFAULT_MEMBER,
  ...(data && typeof data === 'object' ? data : {}),
  registered: Boolean(data?.registered),
  balance: Number(Number(data?.balance || 0).toFixed(2)),
  points: Number(data?.points || 0),
  coupons: Number(data?.coupons || 0),
  benefits: Array.isArray(data?.benefits) ? data.benefits : []
})
