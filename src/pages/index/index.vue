<template>
  <view class="page">
    <view class="member-card">
      <view class="member-header">
        <text class="member-title">靓车会员</text>
        <text class="member-badge">黄金会员</text>
      </view>
      <view class="balance-row">
        <text class="balance-label">当前余额</text>
        <text class="balance-value">¥ {{ balance.toFixed(2) }}</text>
      </view>
      <view class="member-footer">
        <text class="member-footer-text">今日优惠：首充 300 送 50，精洗套餐 7 折</text>
      </view>
    </view>

    <view class="shortcut-card">
      <text class="section-title">快捷入口</text>
      <view class="menu-row">
        <navigator url="/pages/member/member" class="menu-item">我的会员</navigator>
        <navigator url="/pages/recharge/recharge" class="menu-item">充值中心</navigator>
      </view>
      <view class="menu-row">
        <navigator url="/pages/consume/index" class="menu-item">消费结算</navigator>
        <navigator url="/pages/service/service" class="menu-item">洗车服务</navigator>
      </view>
      <view class="menu-row">
        <navigator url="/pages/admin/admin" class="menu-item">管理后台</navigator>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getMemberReadSnapshot } from '../../services/memberReadService.js'

const balance = ref(0)

const loadBalance = async () => {
  const { member: memberInfo } = await getMemberReadSnapshot()
  balance.value = Number(Number(memberInfo.balance || 0).toFixed(2))
}

onMounted(loadBalance)
onShow(loadBalance)
</script>

<style>
.page {
  padding: 24px;
  background: #f4f6fb;
}
.member-card {
  border-radius: 24px;
  background: linear-gradient(135deg, #3dcf84 0%, #1aab5b 100%);
  padding: 24px;
  margin-bottom: 18px;
  color: #fff;
}
.member-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.member-title {
  font-size: 24px;
  font-weight: bold;
}
.member-badge {
  font-size: 14px;
  background: rgba(255,255,255,.18);
  padding: 6px 12px;
  border-radius: 999px;
}
.balance-row {
  margin-bottom: 18px;
}
.balance-label {
  font-size: 14px;
  opacity: .85;
}
.balance-value {
  font-size: 36px;
  font-weight: bold;
  display: block;
  margin-top: 8px;
}
.member-footer {
  background: rgba(255,255,255,.18);
  border-radius: 16px;
  padding: 14px;
}
.member-footer-text {
  font-size: 14px;
  line-height: 20px;
}
.shortcut-card {
  background: #fff;
  border-radius: 24px;
  padding: 18px;
  box-shadow: 0 14px 30px rgba(31, 100, 255, 0.06);
}
.section-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 16px;
}
.menu-row {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.menu-item {
  flex: 1 1 48%;
  min-height: 92px;
  background: #f4f6fb;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #222;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}
.menu-item:nth-child(odd) {
  background: #eff7fc;
}
</style>
