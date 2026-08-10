export const toMoney = (value: number): number => {
  if (!Number.isFinite(value)) throw new Error('Amount must be finite')
  return Number(value.toFixed(2))
}
