export const createRechargeRecord = ({ amount, bonus, balanceBefore, balanceAfter, id = Date.now(), time = new Date().toLocaleString() }) => {
  const rechargeAmount = Number(Number(amount || 0).toFixed(2))
  const bonusAmount = Number(Number(bonus || 0).toFixed(2))
  return {
    id,
    time,
    amount: rechargeAmount,
    bonus: bonusAmount,
    creditedAmount: Number((rechargeAmount + bonusAmount).toFixed(2)),
    balanceBefore: Number(Number(balanceBefore || 0).toFixed(2)),
    balanceAfter: Number(Number(balanceAfter || 0).toFixed(2))
  }
}
