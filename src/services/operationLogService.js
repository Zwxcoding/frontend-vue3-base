import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { getStorage, setStorage } from '../utils/storage.js'

const clone = (value) => {
  if (value === undefined || value === null) return value ?? null
  return JSON.parse(JSON.stringify(value))
}

export const getOperationLogs = () => {
  const logs = getStorage(STORAGE_KEYS.RECHARGE_OPERATION_LOGS, [])
  return Array.isArray(logs) ? logs.map(clone) : []
}

export const createOperationLog = (data = {}) => {
  const log = {
    id: data.id || `operation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    operator: data.operator || '',
    operatorRole: data.operatorRole || '',
    operationType: data.operationType || '',
    targetType: data.targetType || '',
    targetId: data.targetId ?? null,
    beforeData: clone(data.beforeData),
    afterData: clone(data.afterData),
    reason: data.reason || '',
    createTime: data.createTime || new Date().toISOString()
  }
  const saved = setStorage(
    STORAGE_KEYS.RECHARGE_OPERATION_LOGS,
    [log, ...getOperationLogs()]
  )
  if (!saved) throw new Error('操作日志保存失败')
  return clone(log)
}

export const getTargetHistory = (targetType, targetId) => getOperationLogs()
  .filter((log) =>
    log.targetType === targetType &&
    String(log.targetId) === String(targetId)
  )
  .sort((a, b) => new Date(a.createTime) - new Date(b.createTime))

export const getLatestOperation = (targetType, targetId) => getTargetHistory(
  targetType,
  targetId
).at(-1) || null

