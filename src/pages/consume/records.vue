<template>
  <view class="page">
    <view class="records-card">
      <text class="section-title">消费记录</text>
      <view v-if="state.records.length === 0" class="empty-state">
        <text>暂无消费记录</text>
      </view>
      <view v-else class="record-list">
        <view class="record-item" v-for="record in state.records" :key="record.id">
          <view class="record-top">
            <text class="record-time">{{ record.consumeTime || '-' }}</text>
            <text class="record-amount">¥ {{ record.paidAmount != null ? record.paidAmount.toFixed(2) : '0.00' }}</text>
          </view>
          <view class="record-row">
            <text class="record-label">项目：</text>
            <text class="record-value">{{ record.serviceName || '-' }}</text>
          </view>
          <view class="record-row">
            <text class="record-label">车辆：</text>
            <text class="record-value">{{ record.vehicle || '-' }}</text>
          </view>
          <view class="record-row">
            <text class="record-label">余额：</text>
            <text class="record-value">¥ {{ record.balanceAfter != null ? record.balanceAfter.toFixed(2) : '0.00' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'

const state = reactive({
  records: []
})

const loadRecords = () => {
  const stored = uni.getStorageSync('consumeRecords') || []
  const recordsArray = Array.isArray(stored) ? stored : []
  console.log('records.onShow 读取 consumeRecords', recordsArray)
  state.records = recordsArray
    .map((item) => ({
      id: item.id || Date.now(),
      serviceName: item.serviceName || item.service || '',
      originalPrice: typeof item.originalPrice === 'number' ? item.originalPrice : item.original || 0,
      discountAmount: typeof item.discountAmount === 'number' ? item.discountAmount : item.discount || 0,
      couponAmount: typeof item.couponAmount === 'number' ? item.couponAmount : item.coupon || 0,
      paidAmount: typeof item.paidAmount === 'number' ? item.paidAmount : item.amount || 0,
      consumeTime: item.consumeTime || item.time || '',
      vehicle: item.vehicle || '',
      balanceAfter: typeof item.balanceAfter === 'number' ? item.balanceAfter : 0
    }))
    .sort((a, b) => b.id - a.id)
}

onShow(loadRecords)
</script>

<style>
.page {
  padding: 32rpx;
  background: #f0f6f1;
}
.records-card {
  background: #fff;
  border-radius: 32rpx;
  padding: 32rpx;
  box-shadow: 0 20rpx 40rpx rgba(6, 135, 92, 0.08);
}
.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #0f3d1a;
  margin-bottom: 24rpx;
}
.empty-state {
  min-height: 200rpx;
  align-items: center;
  justify-content: center;
  display: flex;
}
.empty-state text {
  color: #667867;
  font-size: 28rpx;
}
.record-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.record-item {
  background: #f7fbf7;
  border-radius: 24rpx;
  padding: 24rpx;
}
.record-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.record-time {
  color: #667867;
  font-size: 24rpx;
}
.record-amount {
  color: #1e8f47;
  font-size: 28rpx;
  font-weight: bold;
}
.record-row {
  display: flex;
  margin-bottom: 10rpx;
}
.record-label {
  color: #4f5f4a;
  width: 120rpx;
  font-size: 24rpx;
}
.record-value {
  color: #0f3d1a;
  font-size: 24rpx;
}
</style>
