export const createConsumeRecord = ({ serviceName, originalAmount, originalPrice, discountAmount, couponAmount, paidAmount, activityId, activityName, discountRate, vehicle, balanceBefore, balanceAfter, id = Date.now(), consumeTime = new Date().toLocaleString() }) => {
  const normalizedOriginalAmount = Number(Number(originalAmount ?? originalPrice ?? 0).toFixed(2))
  return {
    id,
    serviceName: serviceName || '',
    originalAmount: normalizedOriginalAmount,
    originalPrice: normalizedOriginalAmount,
    discountAmount: Number(Number(discountAmount || 0).toFixed(2)),
    couponAmount: Number(Number(couponAmount || 0).toFixed(2)),
    paidAmount: Number(Number(paidAmount || 0).toFixed(2)),
    activityId: activityId || null,
    activityName: activityName || '',
    discountRate: Number(Number(discountRate ?? 1).toFixed(4)),
    consumeTime,
    vehicle: vehicle || '',
    balanceBefore: Number(Number(balanceBefore || 0).toFixed(2)),
    balanceAfter: Number(Number(balanceAfter || 0).toFixed(2))
  }
}

export const normalizeConsumeRecord = (item = {}) => createConsumeRecord({
  ...item,
  serviceName: item.serviceName || item.service || '',
  originalAmount: typeof item.originalAmount === 'number'
    ? item.originalAmount
    : (typeof item.originalPrice === 'number' ? item.originalPrice : item.original || 0),
  discountAmount: typeof item.discountAmount === 'number' ? item.discountAmount : item.discount || 0,
  couponAmount: typeof item.couponAmount === 'number' ? item.couponAmount : item.coupon || 0,
  paidAmount: typeof item.paidAmount === 'number' ? item.paidAmount : item.amount || 0,
  consumeTime: item.consumeTime || item.time || '',
  balanceBefore: typeof item.balanceBefore === 'number' ? item.balanceBefore : 0,
  balanceAfter: typeof item.balanceAfter === 'number' ? item.balanceAfter : 0,
  id: item.id || Date.now()
})
