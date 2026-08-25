<template>
  <view class="page">
    <view class="member-card" v-if="member.registered">
      <view class="member-card-header">
        <text class="member-card-title">我的会员</text>
        <text class="member-card-level">{{ member.level }}</text>
      </view>
      <view class="member-card-balance">
        <text class="balance-label">当前余额</text>
        <text class="balance-value">¥ {{ member.balance.toFixed(2) }}</text>
      </view>
      <view class="member-info-row">
        <text>手机号：{{ member.phone }}</text>
        <text>车牌：{{ member.plate }}</text>
      </view>
      <view class="member-stats-row">
        <view class="stat-item">
          <text class="stat-value">{{ member.points }}</text>
          <text class="stat-label">积分</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ member.coupons }}</text>
          <text class="stat-label">优惠券</text>
        </view>
      </view>
      <view class="rights-row">
        <view class="right-tag" v-for="benefit in member.benefits" :key="benefit">{{ benefit }}</view>
      </view>
    </view>

    <view class="unregistered-card" v-else>
      <text class="title">未注册会员</text>
      <text class="tip">请先完成注册，注册后可查看会员权益、余额和积分。</text>
      <view class="actions-row">
        <navigator url="/pages/login/login" class="action-button">去注册</navigator>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getMemberReadSnapshot } from '../../services/memberReadService.js'

const member = reactive({
  registered: false,
  phone: '',
  plate: '',
  level: '黄金会员',
  balance: 0,
  points: 0,
  coupons: 0,
  benefits: []
})

const loadMember = async () => {
  const { member: stored } = await getMemberReadSnapshot()
  Object.assign(member, { registered: false, phone: '', plate: '', level: '黄金会员', balance: 0, points: 0, coupons: 0, benefits: [] }, stored)
  member.balance = Number(Number(member.balance || 0).toFixed(2))
}

onMounted(loadMember)
onShow(loadMember)
</script>

<style>
.page {
  padding: 24px;
  background: #f4f6fb;
}
.member-card,
.unregistered-card {
  background: #fff;
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 16px 30px rgba(31, 100, 255, 0.08);
}
.member-card {
  background: linear-gradient(135deg, #3ac07c 0%, #1b9b4b 100%);
  color: #fff;
}
.member-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.member-card-title {
  font-size: 22px;
  font-weight: bold;
}
.member-card-level {
  background: rgba(255,255,255,.2);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 14px;
}
.member-card-balance {
  margin-bottom: 20px;
}
.balance-label {
  font-size: 14px;
  opacity: .9;
}
.balance-value {
  font-size: 36px;
  font-weight: bold;
  display: block;
  margin-top: 10px;
}
.member-info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}
.member-stats-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}
.stat-item {
  text-align: center;
}
.stat-value {
  font-size: 20px;
  font-weight: bold;
}
.stat-label {
  font-size: 14px;
  opacity: .9;
}
.rights-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.right-tag {
  background: rgba(255,255,255,.18);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 14px;
}
.title {
  font-size: 22px;
  font-weight: bold;
  margin-bottom: 12px;
}
.tip {
  color: #666;
  line-height: 24px;
  margin-bottom: 20px;
}
.actions-row {
  display: flex;
  justify-content: center;
}
.action-button {
  background: #1a73e8;
  color: #fff;
  border-radius: 20px;
  padding: 12px 24px;
  font-size: 16px;
  text-align: center;
}
</style>
