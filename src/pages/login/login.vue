<template>
  <view class="page">
    <view class="card">
      <text class="title">会员注册</text>
      <view class="input-group">
        <text class="label">手机号</text>
        <input
          class="input"
          type="number"
          placeholder="请输入手机号"
          v-model="phone"
        />
      </view>
      <view class="input-group">
        <text class="label">车牌号</text>
        <input
          class="input"
          placeholder="请输入车牌号"
          v-model="plate"
        />
      </view>
      <button class="register-button" @click="register">注册</button>
      <button class="wechat-button" @click="wechatAuth">微信一键授权注册</button>
      <text class="tip">提示：注册后可查看会员权益、余额和积分信息。</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { saveMemberInfo } from '../../services/memberService.js'

const phone = ref('')
const plate = ref('')

const saveMember = (data) => {
  saveMemberInfo(data)
  uni.showToast({ title: '注册成功', icon: 'success' })
  uni.navigateBack()
}

const register = () => {
  const trimmedPhone = phone.value.trim()
  const trimmedPlate = plate.value.trim()
  if (trimmedPhone.length !== 11) {
    uni.showToast({ title: '请输入 11 位手机号', icon: 'none' })
    return
  }
  if (!trimmedPlate) {
    uni.showToast({ title: '请输入车牌号', icon: 'none' })
    return
  }
  saveMember({
    registered: true,
    phone: trimmedPhone,
    plate: trimmedPlate,
    level: '黄金会员',
    balance: 568.0,
    points: 1260,
    coupons: 3,
    benefits: ['8.5折', '专属折扣', '免费洗车']
  })
}

const wechatAuth = () => {
  saveMember({
    registered: true,
    phone: '13800000000',
    plate: '粤B12345',
    level: '黄金会员',
    balance: 568.0,
    points: 1260,
    coupons: 3,
    benefits: ['8.5折', '专属折扣', '免费洗车']
  })
}
</script>

<style>
.page {
  padding: 24px;
  background: #f4f6fb;
}
.card {
  background: #fff;
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 16px 30px rgba(31, 100, 255, 0.08);
}
.title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 18px;
}
.input-group {
  margin-bottom: 16px;
}
.label {
  display: block;
  margin-bottom: 10px;
  color: #333;
}
.input {
  width: 100%;
  height: 46px;
  border: 1px solid #e5e5e5;
  border-radius: 14px;
  padding: 0 14px;
  font-size: 16px;
}
.register-button,
.wechat-button {
  width: 100%;
  height: 46px;
  border-radius: 24px;
  font-size: 16px;
  margin-top: 14px;
}
.register-button {
  background: #1a73e8;
  color: #fff;
}
.wechat-button {
  background: #f5f5f5;
  color: #333;
}
.tip {
  margin-top: 16px;
  color: #888;
  font-size: 14px;
  line-height: 20px;
}
</style>
