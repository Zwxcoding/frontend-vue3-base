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
          <text class="package-desc">赠送 ¥{{ option.bonusAmount }}</text>
          <button class="buy-button" @click="selectOption(option)">选择充值</button>
        </view>
      </view>
      <view class="section" v-if="selectedPackage">
        <text class="section-title">充值活动</text>
        <text class="activity-group-title" v-if="rechargeCalculation.campaign">当前使用活动</text>
        <view class="activity-package activity-package-applied" v-if="rechargeCalculation.campaign">
          <text class="package-title">{{ rechargeCalculation.campaign.name }}</text>
          <text class="package-desc">充值满 ¥{{ rechargeCalculation.campaign.thresholdAmount }} 赠送 ¥{{ rechargeCalculation.campaign.bonusAmount }}</text>
          <text class="activity-tip">已按金额门槛和优先级自动匹配</text>
        </view>
        <view class="activity-package activity-package-disabled" v-if="!rechargeCalculation.campaign">
          <text class="package-title">当前金额无匹配活动</text>
          <text class="activity-tip activity-tip-muted">继续使用默认充值套餐</text>
        </view>
      </view>
      <view class="section" v-if="selectedPackage">
        <text class="section-title">已选择</text>
        <view class="row">
          <text>充值金额</text>
          <text>¥ {{ rechargeAmount }}</text>
        </view>
        <view class="row">
          <text>赠送金额</text>
          <text>¥ {{ bonusAmount }}</text>
        </view>
        <view class="row">
          <text>最终到账金额</text>
          <text>¥ {{ totalAmount }}</text>
        </view>
      </view>
      <view class="section" v-if="selectedPackage">
        <button class="action-button" @click="recharge">确认充值</button>
      </view>
      <view class="section">
        <text class="section-title">充值记录</text>
        <view class="record" v-for="item in records" :key="item.id">
          <text>{{ item.createTime || item.time }}</text>
          <text>本金 ¥{{ item.amount }}，赠送 ¥{{ item.bonus }}，到账 ¥{{ item.totalAmount }}</text>
          <text v-if="item.activityName">活动：{{ item.activityName }}</text>
        </view>
        <view v-if="records.length === 0" class="empty">暂无充值记录</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getMemberInfo } from '../../services/memberService.js'
import { getRechargeRecords, recharge as rechargeMember } from '../../services/rechargeService.js'
import { createRechargeQuoteFromBackend, getRechargePlansFromBackend } from '../../services/rechargeApiService.js'

const balance = ref(0)
const options = reactive([])
const selectedPackage = ref(null)
const records = reactive([])
const rechargeCalculation = ref({ activity: null, rechargeAmount: 0, bonusAmount: 0, totalAmount: 0 })
const rechargeAmount = computed(() => rechargeCalculation.value.rechargeAmount)
const bonusAmount = computed(() => rechargeCalculation.value.bonusAmount)
const totalAmount = computed(() => rechargeCalculation.value.totalAmount)

const loadMemberBalance = () => {
  const memberInfo = getMemberInfo()
  balance.value = Number(Number(memberInfo.balance || 0).toFixed(2))
}

const loadRechargeRecords = () => {
  records.splice(0, records.length, ...getRechargeRecords())
}

const loadPageData = async () => {
  loadMemberBalance()
  loadRechargeRecords()
  const plans = await Promise.resolve(getRechargePlansFromBackend())
  options.splice(0, options.length, ...plans)
}

onMounted(loadPageData)
onShow(loadPageData)

const selectOption = async (option) => {
  selectedPackage.value = option
  try {
    rechargeCalculation.value = await Promise.resolve(createRechargeQuoteFromBackend(option))
  } catch (error) {
    selectedPackage.value = null
    uni.showToast({ title: error.message || '报价失败', icon: 'none' })
  }
}

const completeRecharge = () => {
  if (!selectedPackage.value) {
    uni.showToast({ title: '请选择充值套餐', icon: 'none' })
    return
  }
  try {
    const result = rechargeMember({
      quote: rechargeCalculation.value
    })
    balance.value = result.member.balance
    records.unshift(result.record)
    selectedPackage.value = null
    rechargeCalculation.value = { activity: null, rechargeAmount: 0, bonusAmount: 0, totalAmount: 0 }
    uni.showToast({ title: '充值成功', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error.message || '充值失败', icon: 'none' })
  }
}

const recharge = () => completeRecharge()
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
.activity-group-title {
  display: block;
  font-size: 14px;
  font-weight: bold;
  margin: 10px 0;
}
.activity-package {
  background: #f7f7f7;
  border: 1px solid transparent;
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 12px;
}
.activity-package-applied {
  background: #eef7ff;
  border-color: #1a73e8;
}
.activity-package-disabled {
  background: #f4f4f4;
  border-color: #e5e5e5;
  opacity: 0.55;
  pointer-events: none;
}
.activity-tip {
  color: #1a73e8;
  display: block;
  font-size: 13px;
  margin-top: 8px;
}
.activity-tip-muted {
  color: #888;
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
