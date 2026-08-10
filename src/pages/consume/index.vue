<template>
  <view class="page">
    <view class="header-card" v-if="member.registered">
      <view class="header-top">
        <text class="header-title">当前会员</text>
        <text class="header-badge">{{ member.level }}</text>
      </view>
      <text class="header-info">手机号：{{ member.phone }}</text>
      <text class="header-info">车辆：{{ member.plate }}</text>
      <text class="balance-title">当前余额</text>
      <text class="balance-value">¥ {{ member.balance.toFixed(2) }}</text>
    </view>

    <view class="unregistered" v-else>
      <text class="unregistered-title">未检测到会员信息</text>
      <text class="unregistered-tip">请先完成会员注册，才能进行消费结算。</text>
      <navigator url="/pages/login/login" class="unregistered-button">去注册</navigator>
    </view>

    <view class="section-card" v-if="member.registered">
      <text class="section-title">优惠活动</text>
      <view class="service-list">
        <text class="activity-group-title" v-if="bestActivity">当前生效优惠</text>
        <view class="activity-item activity-item-applied" v-if="bestActivity">
          <view>
            <text class="service-name">{{ bestActivity.name }}</text>
            <text class="service-desc">{{ Number((bestActivity.discountRate * 10).toFixed(1)) }}折优惠</text>
            <text class="activity-tip">系统已自动应用最高优先级优惠</text>
          </view>
          <text class="service-price">{{ bestActivity.discountRate }}</text>
        </view>
        <text class="activity-group-title" v-if="otherActivities.length > 0">其他活动</text>
        <view class="activity-item activity-item-disabled" v-for="activity in otherActivities" :key="activity.id">
          <view>
            <text class="service-name">{{ activity.name }}</text>
            <text class="service-desc">{{ Number((activity.discountRate * 10).toFixed(1)) }}折优惠</text>
            <text class="activity-tip activity-tip-muted">低优先级活动，不可选择</text>
          </view>
          <text class="service-price">{{ activity.discountRate }}</text>
        </view>
        <view v-if="currentActivities.length === 0" class="service-item">
          <text class="service-desc">暂无折扣活动</text>
        </view>
      </view>
    </view>

    <view class="section-card" v-if="member.registered">
      <text class="section-title">洗车项目</text>
      <view class="service-list">
        <view
          v-for="item in services"
          :key="item.id"
          :class="['service-item', selectedService && selectedService.id === item.id ? 'service-item-active' : '']"
          @click="selectService(item)"
        >
          <view>
            <text class="service-name">{{ item.name }}</text>
            <text class="service-desc">{{ item.desc }}</text>
          </view>
          <text class="service-price">¥ {{ item.price }}</text>
        </view>
      </view>
    </view>

    <view class="section-card" v-if="member.registered && selectedService">
      <text class="section-title">费用明细</text>
      <view class="detail-row">
        <text>原价</text>
        <text>¥ {{ originalPrice.toFixed(2) }}</text>
      </view>
      <view class="detail-row">
        <text>会员折扣</text>
        <text>¥ {{ discountAmount.toFixed(2) }}</text>
      </view>
      <view class="detail-row">
        <text>优惠券</text>
        <text>-¥ {{ couponAmount.toFixed(2) }}</text>
      </view>
      <view class="detail-row highlight">
        <text>应付金额</text>
        <text>¥ {{ payableAmount.toFixed(2) }}</text>
      </view>
      <view class="detail-row">
        <text>余额支付</text>
        <text>¥ {{ balancePay.toFixed(2) }}</text>
      </view>
    </view>

    <button
      class="confirm-button"
      :disabled="!selectedService || payableAmount <= 0 || member.balance < payableAmount"
      @click="confirmConsume"
      v-if="member.registered"
    >确认消费</button>

    <view class="warn-text" v-if="member.registered && selectedService && member.balance < payableAmount">
      当前余额不足，请先充值后再消费。
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getMemberInfo } from '../../services/memberService.js'
import { calculateConsume, consume } from '../../services/consumeService.js'
import { getValidDiscountActivities } from '../../services/activityService.js'

const member = reactive({
  registered: false,
  phone: '',
  plate: '',
  level: '黄金会员',
  balance: 0,
  points: 0,
  coupons: 1,
  benefits: []
})

const currentActivities = reactive([])

const loadMember = () => {
  const stored = getMemberInfo()
  Object.assign(member, { registered: false, phone: '', plate: '', level: '黄金会员', balance: 0, points: 0, coupons: 1, benefits: [] }, stored)
  member.balance = Number(Number(member.balance || 0).toFixed(2))
}

const loadActivities = () => {
  currentActivities.splice(0, currentActivities.length, ...getValidDiscountActivities())
}

onMounted(() => {
  loadMember()
  loadActivities()
})
onShow(() => {
  loadMember()
  loadActivities()
})

const services = [
  { id: 1, name: '普通洗车', desc: '外观清洗 + 车身擦拭', price: 68 },
  { id: 2, name: '精洗', desc: '深度清洁 + 轻蜡处理', price: 128 },
  { id: 3, name: '打蜡', desc: '车身打蜡护理', price: 198 },
  { id: 4, name: '内饰清洁', desc: '座椅 + 仪表台清洁', price: 88 },
  { id: 5, name: '美容套餐', desc: '外观护理 + 内饰精养', price: 268 }
]

const selectedService = ref(null)
const couponAmount = ref(0)

const selectService = (service) => {
  selectedService.value = service
}

const originalPrice = computed(() => selectedService.value ? selectedService.value.price : 0)
const consumptionCalculation = computed(() => selectedService.value
  ? calculateConsume({
      price: originalPrice.value,
      currentActivities,
      memberInfo: member
    })
  : { activity: null, originalPrice: 0, discountRate: 1, discountAmount: 0, paidAmount: 0 })
const bestActivity = computed(() => currentActivities[0] || null)
const otherActivities = computed(() => currentActivities.slice(1))
const discountAmount = computed(() => consumptionCalculation.value.discountAmount)
const payableAmount = computed(() => consumptionCalculation.value.paidAmount)
const balancePay = computed(() => payableAmount.value)

const confirmConsume = () => {
  const calculation = consumptionCalculation.value
  uni.showModal({
    title: '确认消费',
    content: `本次消费金额 ¥${calculation.paidAmount.toFixed(2)}，是否确认支付？`,
    success: (res) => {
      if (res.confirm) {
        try {
          const result = consume({
            serviceName: selectedService.value.name,
            calculation,
            vehicle: member.plate
          })
          member.balance = result.member.balance
          uni.navigateTo({
            url: `/pages/consume/success?amount=${result.calculation.paidAmount}&balance=${result.member.balance}`
          })
        } catch (error) {
          uni.showToast({ title: error.message || '消费失败', icon: 'none' })
        }
      }
    }
  })
}
</script>

<style>
.page {
  padding: 32rpx;
  background: #f0f6f1;
}
.header-card,
.section-card,
.unregistered {
  background: #fff;
  border-radius: 32rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 20rpx 40rpx rgba(6, 135, 92, 0.08);
}
.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}
.header-title {
  color: #0f3d1a;
  font-size: 32rpx;
  font-weight: bold;
}
.header-badge {
  background: rgba(28, 170, 80, 0.12);
  color: #1e8f47;
  border-radius: 999rpx;
  padding: 12rpx 24rpx;
  font-size: 22rpx;
}
.header-info {
  color: #4f5f4a;
  font-size: 24rpx;
  margin-bottom: 12rpx;
}
.balance-title {
  color: #4f5f4a;
  font-size: 24rpx;
  margin-top: 20rpx;
}
.balance-value {
  color: #1e8f47;
  font-size: 44rpx;
  font-weight: bold;
  margin-top: 12rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #0f3d1a;
  margin-bottom: 24rpx;
}
.service-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.service-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-radius: 24rpx;
  background: #f7fbf7;
  border: 1rpx solid transparent;
}
.service-item-active {
  border-color: #1e8f47;
  background: #e5f6e8;
}
.activity-group-title {
  color: #0f3d1a;
  font-size: 24rpx;
  font-weight: bold;
  margin-top: 8rpx;
}
.activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-radius: 24rpx;
  background: #f7fbf7;
  border: 1rpx solid transparent;
}
.activity-item-applied {
  border-color: #1e8f47;
  background: #e5f6e8;
}
.activity-item-disabled {
  background: #f4f5f4;
  border-color: #e4e8e4;
  opacity: 0.6;
  pointer-events: none;
}
.activity-tip {
  color: #1e8f47;
  display: block;
  font-size: 22rpx;
  margin-top: 8rpx;
}
.activity-tip-muted {
  color: #8a968b;
}
.service-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #0f3d1a;
}
.service-desc {
  font-size: 22rpx;
  color: #667867;
  margin-top: 8rpx;
}
.service-price {
  font-size: 30rpx;
  color: #1e8f47;
  font-weight: bold;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18rpx;
  color: #4f5f4a;
  font-size: 24rpx;
}
.highlight {
  font-weight: bold;
  color: #1e8f47;
}
.confirm-button,
.unregistered-button {
  width: 100%;
  height: 80rpx;
  border-radius: 40rpx;
  line-height: 80rpx;
  text-align: center;
  color: #ffffff;
  background: #1e8f47;
  font-size: 28rpx;
  margin-top: 24rpx;
}
.confirm-button:disabled {
  opacity: 0.4;
}
.warn-text {
  color: #e2553b;
  font-size: 22rpx;
  text-align: center;
}
.unregistered-title {
  color: #0f3d1a;
  font-size: 28rpx;
  font-weight: bold;
  margin-bottom: 18rpx;
}
.unregistered-tip {
  color: #667867;
  font-size: 24rpx;
  margin-bottom: 24rpx;
}
</style>
