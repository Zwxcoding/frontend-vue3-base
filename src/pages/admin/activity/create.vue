<template>
  <view class="page">
    <text class="page-title">新建活动</text>

    <view class="form-card">
      <view class="form-row">
        <text class="label">活动名称</text>
        <input class="input" placeholder="请输入活动名称" v-model="form.name" />
      </view>
      <view class="form-row">
        <text class="label">活动类型</text>
        <input class="input" placeholder="recharge / discount" v-model="form.type" />
      </view>
      <view class="form-row">
        <text class="label">折扣（0-1）</text>
        <input class="input" placeholder="例如 0.8" v-model="form.discount" />
      </view>
      <view class="form-row">
        <text class="label">充值金额</text>
        <input class="input" placeholder="例如 100" v-model="form.rechargeAmount" />
      </view>
      <view class="form-row">
        <text class="label">赠送金额</text>
        <input class="input" placeholder="例如 20" v-model="form.giftAmount" />
      </view>
      <view class="form-row">
        <text class="label">开始时间</text>
        <input class="input" placeholder="2026-07-18" v-model="form.startDate" />
      </view>
      <view class="form-row">
        <text class="label">结束时间</text>
        <input class="input" placeholder="2026-07-20" v-model="form.endDate" />
      </view>
      <button class="primary-button" @click="saveActivity">保存活动</button>
    </view>
  </view>
</template>

<script setup>
import { reactive } from 'vue'

const form = reactive({
  name: '',
  type: 'recharge',
  discount: '',
  rechargeAmount: '',
  giftAmount: '',
  startDate: '',
  endDate: ''
})

const getStoredActivities = () => {
  const stored = uni.getStorageSync('activities') || uni.getStorageSync('activityList') || []
  return Array.isArray(stored) ? stored : []
}

const saveActivity = () => {
  if (!form.name || !form.type || !form.startDate || !form.endDate) {
    uni.showToast({ title: '请填写完整活动信息', icon: 'none' })
    return
  }

  const normalizedType = form.type === 'discount' ? 'discount' : 'recharge'
  if (normalizedType === 'discount' && !form.discount) {
    uni.showToast({ title: '请输入折扣', icon: 'none' })
    return
  }
  if (normalizedType === 'recharge' && (!form.rechargeAmount || !form.giftAmount)) {
    uni.showToast({ title: '请输入充值金额和赠送金额', icon: 'none' })
    return
  }

  const activity = {
    id: Date.now(),
    name: form.name.trim(),
    type: normalizedType,
    status: 'active',
    discount: normalizedType === 'discount' ? Number(form.discount) : 0,
    rechargeAmount: normalizedType === 'recharge' ? Number(form.rechargeAmount) : 0,
    giftAmount: normalizedType === 'recharge' ? Number(form.giftAmount) : 0,
    startDate: form.startDate.trim(),
    endDate: form.endDate.trim(),
    createdAt: new Date().toISOString()
  }
  const existing = getStoredActivities()
  const updated = [activity, ...existing]
  uni.setStorageSync('activities', updated)
  uni.setStorageSync('activityList', updated)
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
