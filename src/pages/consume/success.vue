<template>
  <view class="page">
    <view class="success-card">
      <text class="success-icon">✓</text>
      <text class="success-title">消费成功</text>
      <text class="success-subtitle">本次消费金额 ¥{{ amount }}</text>
      <text class="success-balance">剩余余额 ¥{{ balance }}</text>
    </view>
    <navigator url="/pages/index/index" class="button">返回首页</navigator>
    <navigator url="/pages/consume/records" class="button button-outline">查看消费记录</navigator>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const amount = ref('0.00')
const balance = ref('0.00')

onLoad((options) => {
  amount.value = options.amount || '0.00'
  balance.value = options.balance || '0.00'
})
</script>

<style>
.page {
  padding: 32rpx;
  background: #f0f6f1;
}
.success-card {
  background: #fff;
  border-radius: 32rpx;
  padding: 40rpx;
  text-align: center;
  box-shadow: 0 20rpx 40rpx rgba(6, 135, 92, 0.08);
  margin-bottom: 32rpx;
}
.success-icon {
  display: inline-block;
  width: 90rpx;
  height: 90rpx;
  line-height: 90rpx;
  border-radius: 45rpx;
  background: #d8f7df;
  color: #1e8f47;
  font-size: 48rpx;
  margin-bottom: 24rpx;
}
.success-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #0f3d1a;
  margin-bottom: 20rpx;
}
.success-subtitle,
.success-balance {
  font-size: 28rpx;
  color: #4f5f4a;
  margin-bottom: 12rpx;
}
.button {
  width: 100%;
  display: block;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  color: #fff;
  background: #1e8f47;
  text-align: center;
  font-size: 28rpx;
  margin-bottom: 18rpx;
}
.button-outline {
  background: #fff;
  color: #1e8f47;
  border: 2rpx solid #1e8f47;
}
</style>
