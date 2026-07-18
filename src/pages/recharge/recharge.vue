<template>
  <view class="page">
    <text class="title">充值中心</text>
    <view class="card">
      <view class="row">
        <text>当前余额</text>
        <text class="amount">¥ {{ balance.toFixed(2) }}</text>
      </view>
      <view class="section">
        <text class="section-title">推荐套餐</text>
        <view
          class="package"
          v-for="option in options"
          :key="option.amount"
        >
          <text class="package-title">¥{{ option.amount }} 充值</text>
          <text class="package-desc">赠送 ¥{{ option.bonus }}</text>
          <button class="buy-button" @click="selectOption(option)">选择充值</button>
        </view>
      </view>
      <view class="section" v-if="rechargeActivities.length > 0">
        <text class="section-title">充值活动</text>
        <view class="package" v-for="activity in rechargeActivities" :key="activity.id">
          <text class="package-title">{{ activity.name }}</text>
          <text class="package-desc">{{ activity.rechargeAmount ? `充值满 ¥${activity.rechargeAmount} 赠送 ¥${activity.giftAmount}` : '活动进行中' }}</text>
        </view>
      </view>
      <view class="section" v-if="selectedOption">
        <text class="section-title">已选择</text>
        <text class="desc">充值 ¥{{ selectedOption.amount }}，赠送 ¥{{ selectedOption.bonus }}</text>
      </view>
      <view class="section" v-if="selectedOption">
        <button class="action-button" @click="recharge">确认充值</button>
      </view>
      <view class="section">
        <text class="section-title">充值记录</text>
        <view class="record" v-for="item in records" :key="item.id">
          <text>{{ item.time }}</text>
          <text>充值 ¥{{ item.amount }}，赠送 ¥{{ item.bonus }}</text>
        </view>
        <view v-if="records.length === 0" class="empty">暂无充值记录</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'

const balance = ref(0)
const options = [
  { amount: 50, bonus: 5 },
  { amount: 100, bonus: 15 },
  { amount: 200, bonus: 40 }
]
const selectedOption = ref(null)
const records = reactive([])
const rechargeActivities = reactive([])

const getStoredMemberInfo = () => {
  const fromMemberInfo = uni.getStorageSync('memberInfo')
  if (fromMemberInfo && typeof fromMemberInfo === 'object') {
    return fromMemberInfo
  }
  const fromLegacy = uni.getStorageSync('memberData')
  if (fromLegacy && typeof fromLegacy === 'object') {
    return fromLegacy
  }
  return { registered: false, phone: '', plate: '', level: '黄金会员', balance: 0, points: 0, coupons: 0, benefits: [] }
}

const saveStoredMemberInfo = (memberInfo) => {
  const normalized = {
    ...getStoredMemberInfo(),
    ...memberInfo,
    balance: Number(Number(memberInfo.balance || 0).toFixed(2))
  }
  uni.setStorageSync('memberInfo', normalized)
  uni.setStorageSync('memberData', normalized)
  uni.setStorageSync('memberBalance', normalized.balance)
}

const loadMemberBalance = () => {
  const memberInfo = getStoredMemberInfo()
  balance.value = Number(Number(memberInfo.balance || 0).toFixed(2))
}

const loadRechargeActivities = () => {
  const stored = uni.getStorageSync('activities') || []
  const list = Array.isArray(stored) ? stored : []
  rechargeActivities.splice(0, rechargeActivities.length, ...list.filter((activity) => activity.status === 'active' && activity.type === 'recharge'))
}

const loadPageData = () => {
  loadMemberBalance()
  loadRechargeActivities()
}

onMounted(loadPageData)
onShow(loadPageData)

const selectOption = (option) => {
  selectedOption.value = option
}

const recharge = () => {
  if (!selectedOption.value) {
    uni.showToast({ title: '请选择充值套餐', icon: 'none' })
    return
  }
  const { amount, bonus } = selectedOption.value
  const memberInfo = getStoredMemberInfo()
  const currentBalance = Number(memberInfo.balance || 0)
  const newBalance = Number((currentBalance + amount).toFixed(2))
  saveStoredMemberInfo({ ...memberInfo, balance: newBalance })
  balance.value = newBalance
  records.unshift({
    id: Date.now(),
    time: new Date().toLocaleString(),
    amount,
    bonus
  })
  selectedOption.value = null
  uni.showToast({ title: '充值成功', icon: 'success' })
}
</script>

<style>
.page {
  padding: 24px;
}
.title {
  font-size: 24px;
  margin-bottom: 18px;
}
.card {
  background: #fff;
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 4px 12px rgba(0,0,0,.08);
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.amount {
  font-size: 22px;
  color: #e76f51;
}
.section {
  margin-top: 18px;
}
.section-title {
  font-weight: bold;
  margin-bottom: 12px;
}
.package {
  background: #f7f7f7;
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 12px;
}
.package-title {
  font-size: 16px;
  font-weight: bold;
}
.package-desc {
  color: #777;
  margin: 8px 0;
}
.buy-button,
.action-button {
  background: #1a73e8;
  color: #fff;
  border-radius: 12px;
  padding: 10px 14px;
  margin-top: 10px;
}
.record {
  background: #f7f7f7;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 10px;
}
.empty {
  color: #999;
  font-size: 14px;
}
</style>
