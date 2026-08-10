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
        <view class="row" v-if="activity.type === 'discount'">
          <text class="label">折扣</text>
          <text class="value">{{ activity.discountRate }}</text>
        </view>
        <view class="row" v-if="activity.type === 'recharge'">
          <text class="label">充值金额</text>
          <text class="value">{{ activity.rechargeAmount }}</text>
        </view>
        <view class="row" v-if="activity.type === 'recharge'">
          <text class="label">赠送金额</text>
          <text class="value">{{ activity.bonusAmount }}</text>
        </view>
        <view class="row">
          <text class="label">开始时间</text>
          <text class="value">{{ activity.startTime }}</text>
        </view>
        <view class="row">
          <text class="label">结束时间</text>
          <text class="value">{{ activity.endTime }}</text>
        </view>
        <view class="row">
          <text class="label">优先级</text>
          <text class="value">{{ activity.priority }}</text>
        </view>
        <view class="row">
          <text class="label">状态</text>
          <text class="value">{{ activity.status }}</text>
        </view>
        <view class="row">
          <button class="primary-button" @click="goEdit(activity)">编辑</button>
          <button class="primary-button" @click="removeActivity(activity)">删除</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { deleteActivity, getActivities } from '../../../services/activityService.js'

const activities = reactive([])

const loadActivities = () => {
  const list = getActivities()
  activities.splice(0, activities.length, ...list)
}

const goCreate = () => {
  uni.navigateTo({ url: '/pages/admin/activity/create' })
}

const goEdit = (activity) => {
  uni.navigateTo({ url: `/pages/admin/activity/create?id=${activity.id}` })
}

const removeActivity = (activity) => {
  uni.showModal({
    title: '删除活动',
    content: `确认删除“${activity.name}”吗？`,
    success: (res) => {
      if (!res.confirm) return
      deleteActivity(activity.id)
      loadActivities()
      uni.showToast({ title: '活动已删除', icon: 'success' })
    }
  })
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
