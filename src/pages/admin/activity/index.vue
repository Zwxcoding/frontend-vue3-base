<template>
  <view class="page">
    <view class="page-header">
      <text class="page-title">活动列表</text>
      <button class="primary-button" @click="goCreate">新建活动</button>
    </view>

    <view v-if="activities.length === 0" class="empty-state">
      <text>暂无活动，请先创建。</text>
    </view>

    <view v-else class="activity-list">
      <view class="activity-card" v-for="activity in activities" :key="activity.id">
        <view class="row">
          <text class="label">活动名称</text>
          <text class="value">{{ activity.name }}</text>
        </view>
        <view class="row">
          <text class="label">活动类型</text>
          <text class="value">{{ activity.type }}</text>
        </view>
        <view class="row">
          <text class="label">折扣</text>
          <text class="value">{{ activity.discount }}</text>
        </view>
        <view class="row">
          <text class="label">充值金额</text>
          <text class="value">{{ activity.rechargeAmount }}</text>
        </view>
        <view class="row">
          <text class="label">赠送金额</text>
          <text class="value">{{ activity.giftAmount }}</text>
        </view>
        <view class="row">
          <text class="label">开始时间</text>
          <text class="value">{{ activity.startDate }}</text>
        </view>
        <view class="row">
          <text class="label">结束时间</text>
          <text class="value">{{ activity.endDate }}</text>
        </view>
        <view class="row">
          <text class="label">状态</text>
          <text class="value">{{ activity.status }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'

const activities = reactive([])

const getStoredActivities = () => {
  const stored = uni.getStorageSync('activities') || uni.getStorageSync('activityList') || []
  return Array.isArray(stored) ? stored : []
}

const loadActivities = () => {
  const list = getStoredActivities().map((item) => ({
    ...item,
    status: item.status || 'active',
    type: item.type || (item.activityType === 'discount' ? 'discount' : 'recharge'),
    name: item.name || item.activityName || '活动',
    discount: item.discount != null ? Number(item.discount) : 0,
    rechargeAmount: item.rechargeAmount != null ? Number(item.rechargeAmount) : 0,
    giftAmount: item.giftAmount != null ? Number(item.giftAmount) : 0,
    startDate: item.startDate || item.startTime || '',
    endDate: item.endDate || item.endTime || ''
  }))
  activities.splice(0, activities.length, ...list)
}

const goCreate = () => {
  uni.navigateTo({ url: '/pages/admin/activity/create' })
}

onShow(loadActivities)
</script>

<style>
.page {
  padding: 32rpx;
  background: #f2f6f9;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}
.page-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #0f3d1a;
}
.primary-button {
  background: #1e8f47;
  color: #fff;
  border-radius: 20rpx;
  padding: 18rpx 30rpx;
}
.empty-state {
  min-height: 300rpx;
  align-items: center;
  justify-content: center;
  display: flex;
  color: #667867;
  font-size: 28rpx;
}
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.activity-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 28rpx;
  box-shadow: 0 16rpx 32rpx rgba(0, 0, 0, 0.06);
}
.row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.label {
  color: #4f5f4a;
  font-size: 26rpx;
}
.value {
  color: #0f3d1a;
  font-size: 26rpx;
  width: 50%;
  text-align: right;
}
</style>
