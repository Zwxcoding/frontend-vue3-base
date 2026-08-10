<template>
  <view class="page">
    <text class="page-title">{{ editingId ? '编辑活动' : '新建活动' }}</text>

    <view class="form-card">
      <view class="form-row">
        <text class="label">活动名称</text>
        <input class="input" placeholder="请输入活动名称" v-model="form.name" />
      </view>
      <view class="form-row">
        <text class="label">活动类型</text>
        <picker :range="activityTypes" range-key="label" :value="activityTypeIndex" @change="changeActivityType">
          <view class="input">{{ activityTypes[activityTypeIndex].label }}</view>
        </picker>
      </view>
      <view class="form-row" v-if="form.type === 'discount'">
        <text class="label">折扣比例</text>
        <input class="input" type="digit" placeholder="例如 8 或 0.8" v-model="form.discountRate" />
      </view>
      <view class="form-row" v-if="form.type === 'recharge'">
        <text class="label">充值金额</text>
        <input class="input" placeholder="例如 100" v-model="form.rechargeAmount" />
      </view>
      <view class="form-row" v-if="form.type === 'recharge'">
        <text class="label">赠送金额</text>
        <input class="input" placeholder="例如 20" v-model="form.bonusAmount" />
      </view>
      <view class="form-row">
        <text class="label">开始时间</text>
        <input class="input" placeholder="2026-07-18" v-model="form.startDate" />
      </view>
      <view class="form-row">
        <text class="label">结束时间</text>
        <input class="input" placeholder="2026-07-20" v-model="form.endDate" />
      </view>
      <view class="form-row">
        <text class="label">优先级</text>
        <input class="input" type="number" placeholder="例如 10" v-model="form.priority" />
      </view>
      <view class="form-row">
        <text class="label">状态</text>
        <input class="input" placeholder="active / inactive" v-model="form.status" />
      </view>
      <button class="primary-button" @click="saveActivity">保存活动</button>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createActivity, getActivityById, updateActivity } from '../../../services/activityService.js'

const editingId = ref(null)
const activityTypes = [
  { label: '充值赠送', value: 'recharge' },
  { label: '消费折扣', value: 'discount' }
]

const form = reactive({
  name: '',
  type: 'recharge',
  discountRate: '',
  rechargeAmount: '',
  bonusAmount: '',
  startDate: '',
  endDate: '',
  priority: '0',
  status: 'active'
})

const activityTypeIndex = computed(() => Math.max(activityTypes.findIndex((item) => item.value === form.type), 0))

const changeActivityType = (event) => {
  form.type = activityTypes[Number(event.detail.value)].value
}

onLoad((options) => {
  if (!options.id) return
  const activity = getActivityById(options.id)
  if (!activity) return
  editingId.value = activity.id
  Object.assign(form, {
    name: activity.name,
    type: activity.type,
    discountRate: activity.rule.discountRate || '',
    rechargeAmount: activity.rule.rechargeAmount || '',
    bonusAmount: activity.rule.bonusAmount || '',
    startDate: activity.startTime,
    endDate: activity.endTime,
    priority: String(activity.priority),
    status: activity.status
  })
})

const saveActivity = () => {
  if (!form.name || !form.type || !form.startDate || !form.endDate) {
    uni.showToast({ title: '请填写完整活动信息', icon: 'none' })
    return
  }

  const normalizedType = form.type
  if (normalizedType === 'discount' && !form.discountRate) {
    uni.showToast({ title: '请输入折扣', icon: 'none' })
    return
  }
  if (normalizedType === 'recharge' && (!form.rechargeAmount || !form.bonusAmount)) {
    uni.showToast({ title: '请输入充值金额和赠送金额', icon: 'none' })
    return
  }

  const inputDiscountRate = Number(form.discountRate)
  const discountRate = inputDiscountRate > 1 ? inputDiscountRate / 10 : inputDiscountRate
  if (normalizedType === 'discount' && (!Number.isFinite(discountRate) || discountRate <= 0 || discountRate > 1)) {
    uni.showToast({ title: '请输入正确的折扣比例', icon: 'none' })
    return
  }

  const activityData = {
    name: form.name.trim(),
    type: normalizedType,
    status: form.status === 'inactive' ? 'inactive' : 'active',
    startTime: form.startDate.trim(),
    endTime: form.endDate.trim(),
    priority: Number(form.priority || 0),
    ...(normalizedType === 'discount'
      ? { discountRate }
      : { rechargeAmount: Number(form.rechargeAmount), bonusAmount: Number(form.bonusAmount) })
  }
  if (editingId.value) {
    updateActivity(editingId.value, activityData)
  } else {
    createActivity(activityData)
  }
  uni.showToast({ title: '活动已保存', icon: 'success' })
  uni.navigateBack()
}
</script>

<style>
.page {
  padding: 32rpx;
  background: #f2f6f9;
}
.page-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #0f3d1a;
  margin-bottom: 24rpx;
}
.form-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 32rpx;
  box-shadow: 0 16rpx 32rpx rgba(0, 0, 0, 0.06);
}
.form-row {
  margin-bottom: 24rpx;
}
.label {
  display: block;
  color: #4f5f4a;
  font-size: 26rpx;
  margin-bottom: 12rpx;
}
.input {
  width: 100%;
  height: 88rpx;
  border: 1rpx solid #e5e5e5;
  border-radius: 20rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
  color: #0f3d1a;
}
.primary-button {
  background: #1e8f47;
  color: #fff;
  border-radius: 24rpx;
  padding: 22rpx 0;
  text-align: center;
  width: 100%;
}
</style>
