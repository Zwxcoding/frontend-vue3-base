import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { createActivity as createActivityModel } from '../models/activity.js'
import { getStorage, setStorage } from '../utils/storage.js'

const parseBoundary = (value, endOfDay = false) => {
  if (!value) return NaN
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const normalized = dateOnly ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}` : value
  return new Date(normalized).getTime()
}

export const getActivities = () => {
  const activities = getStorage(STORAGE_KEYS.ACTIVITIES, [])
  return (Array.isArray(activities) ? activities : []).map(createActivityModel)
}

export const getActivityById = (id) => getActivities().find((activity) => String(activity.id) === String(id)) || null

export const createActivity = (data) => {
  const activity = createActivityModel(data)
  setStorage(STORAGE_KEYS.ACTIVITIES, [activity, ...getActivities()])
  return activity
}

export const updateActivity = (id, data) => {
  const activities = getActivities()
  const index = activities.findIndex((activity) => String(activity.id) === String(id))
  if (index < 0) throw new Error('活动不存在')
  const updated = createActivityModel({ ...activities[index], ...data, id: activities[index].id, createTime: activities[index].createTime })
  activities.splice(index, 1, updated)
  setStorage(STORAGE_KEYS.ACTIVITIES, activities)
  return updated
}

export const deleteActivity = (id) => {
  const activities = getActivities()
  const updated = activities.filter((activity) => String(activity.id) !== String(id))
  if (updated.length === activities.length) return false
  setStorage(STORAGE_KEYS.ACTIVITIES, updated)
  return true
}

export const isActivityValid = (activity, now = Date.now()) => {
  if (!activity || activity.status !== 'active') return false
  const startTime = parseBoundary(activity.startTime)
  const endTime = parseBoundary(activity.endTime, true)
  return Number.isFinite(startTime) && Number.isFinite(endTime) && now >= startTime && now <= endTime
}

export const getValidActivities = (type = null, now = Date.now()) => getActivities()
  .filter((activity) => (!type || activity.type === type) && isActivityValid(activity, now))
  .sort((a, b) => b.priority - a.priority || b.id - a.id)

export const getBestActivity = (activitiesOrType = null, predicate = () => true) => {
  const activities = Array.isArray(activitiesOrType)
    ? activitiesOrType.filter((activity) => isActivityValid(activity))
    : getValidActivities(typeof activitiesOrType === 'string' ? activitiesOrType : null)
  return activities.filter(predicate).sort((a, b) => b.priority - a.priority || b.id - a.id)[0] || null
}

export const getRechargeActivities = () => getValidActivities('recharge').map((activity) => ({
  ...activity,
  rechargeAmount: activity.rechargeAmount,
  giftAmount: activity.bonusAmount,
  bonus: activity.bonusAmount
}))

export const getBestRechargeActivity = (amount) => {
  const rechargeAmount = Number(amount)
  if (!Number.isFinite(rechargeAmount) || rechargeAmount <= 0) {
    return {
      activity: null,
      rechargeAmount: 0,
      bonusAmount: 0,
      totalAmount: 0
    }
  }

  const activity = getValidActivities('recharge')
    .filter((item) => rechargeAmount >= Number(item.rule.rechargeAmount))
    .sort((a, b) => b.priority - a.priority || b.id - a.id)[0] || null
  const bonusAmount = activity ? Number(activity.rule.bonusAmount) : 0

  return {
    activity,
    rechargeAmount,
    bonusAmount,
    totalAmount: Number((rechargeAmount + bonusAmount).toFixed(2))
  }
}

export const getDiscountActivities = () => getValidActivities('discount').map((activity) => ({
  ...activity,
  discount: activity.discountRate
}))

export const getValidDiscountActivities = () => getDiscountActivities()

export const getBestDiscountActivity = () => getBestActivity('discount')
