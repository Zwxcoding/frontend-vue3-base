<template>
  <view class="page">
    <text class="page-title">充值套餐管理</text>
    <view class="form-card">
      <text class="section-title">{{ editingId ? '编辑套餐' : '新增套餐' }}</text>
      <view class="form-row"><text class="label">套餐名称</text><input class="input" v-model="form.name" placeholder="例如：500元充值套餐" /></view>
      <view class="form-row"><text class="label">充值金额</text><input class="input" type="number" v-model="form.amount" placeholder="请输入整数金额" /></view>
      <view class="form-row"><text class="label">基础赠送</text><input class="input" type="digit" v-model="form.baseBonus" placeholder="请输入赠送金额" /></view>
      <view class="form-row"><text class="label">排序</text><input class="input" type="number" v-model="form.sort" placeholder="数字越小越靠前" /></view>
      <view class="form-row">
        <text class="label">状态</text>
        <picker :range="statusOptions" range-key="label" :value="statusIndex" @change="changeStatus">
          <view class="input picker-value">{{ statusOptions[statusIndex].label }}</view>
        </picker>
      </view>
      <view class="button-row">
        <button class="primary-button" v-if="canCreateOrUpdate" @click="savePlan">保存套餐</button>
        <button class="secondary-button" v-if="editingId" @click="resetForm">取消编辑</button>
      </view>
    </view>

    <view v-if="plans.length === 0" class="empty-state">暂无充值套餐</view>
    <view v-else>
      <view class="plan-card" v-for="plan in plans" :key="plan.id">
        <view class="row"><text class="label">名称</text><text class="value">{{ plan.name }}</text></view>
        <view class="row"><text class="label">充值金额</text><text class="value">¥{{ plan.amount }}</text></view>
        <view class="row"><text class="label">基础赠送</text><text class="value">¥{{ plan.baseBonus }}</text></view>
        <view class="row"><text class="label">状态</text><text class="value">{{ plan.status === 'active' ? '启用' : '停用' }}</text></view>
        <view class="row"><text class="label">排序</text><text class="value">{{ plan.sort }}</text></view>
        <view class="row"><text class="label">版本</text><text class="value">v{{ plan.version }}</text></view>
        <view class="row"><text class="label">更新时间</text><text class="value">{{ plan.updateTime }}</text></view>
        <view class="button-row">
          <button class="small-button" v-if="canUpdate" @click="editPlan(plan)">编辑</button>
          <button class="small-button" v-if="canEnable && plan.status === 'active'" @click="togglePlan(plan, false)">下架</button>
          <button class="small-button" v-if="canEnable && plan.status !== 'active'" @click="togglePlan(plan, true)">上架</button>
          <button class="danger-button" v-if="canDelete" @click="softDeletePlan(plan)">删除</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  createRechargePlan,
  deleteRechargePlan,
  disableRechargePlan,
  enableRechargePlan,
  getRechargePlansForAdmin,
  updateRechargePlan
} from '../../../services/rechargePlanAdminService.js'
import { DEFAULT_ADMIN_ACTOR, hasAdminPermission } from '../../../services/adminPermissionService.js'

const actor = DEFAULT_ADMIN_ACTOR
const plans = reactive([])
const editingId = ref(null)
const originalAmount = ref(null)
const statusOptions = [{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }]
const form = reactive({ name: '', amount: '', baseBonus: '', status: 'active', sort: '0' })
const statusIndex = computed(() => Math.max(statusOptions.findIndex((item) => item.value === form.status), 0))
const canCreateOrUpdate = computed(() => hasAdminPermission(actor, editingId.value ? 'UPDATE' : 'CREATE'))
const canUpdate = hasAdminPermission(actor, 'UPDATE')
const canEnable = hasAdminPermission(actor, 'ENABLE')
const canDelete = hasAdminPermission(actor, 'DELETE')

const loadPlans = async () => {
  const result = await Promise.resolve(getRechargePlansForAdmin())
  plans.splice(0, plans.length, ...result)
}
const resetForm = () => {
  editingId.value = null
  originalAmount.value = null
  Object.assign(form, { name: '', amount: '', baseBonus: '', status: 'active', sort: '0' })
}
const changeStatus = (event) => { form.status = statusOptions[Number(event.detail.value)].value }
const persistPlan = async () => {
  const data = {
    name: form.name,
    amount: Number(form.amount),
    baseBonus: Number(form.baseBonus),
    status: form.status,
    sort: Number(form.sort)
  }
  if (editingId.value) await updateRechargePlan(editingId.value, data, actor)
  else await createRechargePlan(data, actor)
  resetForm()
  await loadPlans()
  uni.showToast({ title: '套餐已保存', icon: 'success' })
}
const tryPersist = async () => {
  try { await persistPlan() } catch (error) {
    uni.showToast({ title: error.message || '保存失败', icon: 'none' })
  }
}
const savePlan = () => {
  if (editingId.value && Number(form.amount) !== Number(originalAmount.value)) {
    uni.showModal({
      title: '修改充值金额',
      content: '修改金额会影响用户选择该套餐，是否继续？',
      success: (result) => { if (result.confirm) tryPersist() }
    })
    return
  }
  tryPersist()
}
const editPlan = (plan) => {
  editingId.value = plan.id
  originalAmount.value = plan.amount
  Object.assign(form, {
    name: plan.name,
    amount: String(plan.amount),
    baseBonus: String(plan.baseBonus),
    status: plan.status,
    sort: String(plan.sort)
  })
}
const togglePlan = async (plan, enabled) => {
  try {
    if (enabled) await enableRechargePlan(plan.id, actor, '后台上架')
    else await disableRechargePlan(plan.id, actor, '后台下架')
    await loadPlans()
  } catch (error) {
    uni.showToast({ title: error.message || '操作失败', icon: 'none' })
  }
}
const softDeletePlan = (plan) => {
  uni.showModal({
    title: '删除套餐',
    content: '套餐不会被物理删除，将转换为停用状态。',
    success: async (result) => {
      if (!result.confirm) return
      try {
        await deleteRechargePlan(plan.id, actor, '后台软删除')
        await loadPlans()
      } catch (error) {
        uni.showToast({ title: error.message || '删除失败', icon: 'none' })
      }
    }
  })
}
onShow(loadPlans)
</script>

<style>
.page { padding: 32rpx; background: #f2f6f9; }
.page-title { font-size: 34rpx; font-weight: bold; color: #0f3d1a; }
.form-card, .plan-card { background: #fff; border-radius: 28rpx; padding: 28rpx; margin-top: 24rpx; }
.section-title { display: block; font-weight: bold; margin-bottom: 24rpx; }
.form-row { margin-bottom: 20rpx; }
.label { color: #4f5f4a; font-size: 26rpx; }
.input { height: 84rpx; border: 1rpx solid #e5e5e5; border-radius: 18rpx; padding: 0 20rpx; margin-top: 10rpx; }
.picker-value { line-height: 84rpx; }
.row { display: flex; justify-content: space-between; margin-bottom: 14rpx; }
.value { color: #0f3d1a; width: 60%; text-align: right; word-break: break-all; }
.button-row { display: flex; gap: 12rpx; margin-top: 18rpx; }
.primary-button, .small-button { background: #1e8f47; color: #fff; }
.secondary-button { background: #839187; color: #fff; }
.danger-button { background: #c84b4b; color: #fff; }
.primary-button, .secondary-button, .small-button, .danger-button { border-radius: 18rpx; font-size: 26rpx; }
.empty-state { text-align: center; color: #667867; padding: 60rpx 0; }
</style>
