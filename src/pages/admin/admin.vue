<template>
  <view class="page">
    <text class="title">管理后台</text>

    <view v-if="!loggedIn" class="card">
      <text class="section-title">管理员登录</text>
      <view class="form-row">
        <text>账号</text>
        <input
          class="input"
          placeholder="请输入管理员账号"
          v-model="loginForm.username"
        />
      </view>
      <view class="form-row">
        <text>密码</text>
        <input
          class="input"
          type="password"
          placeholder="请输入密码"
          v-model="loginForm.password"
        />
      </view>
      <button class="action-button" @click="login">登录</button>
      <text class="tip">提示：用户名 admin，密码 admin123</text>
    </view>

    <view v-else>
      <view class="card">
        <text class="section-title">运营数据</text>
        <view class="info-row">
          <text>总订单</text>
          <text class="value">{{ stats.totalOrders }}</text>
        </view>
        <view class="info-row">
          <text>今日收入</text>
          <text class="value">¥ {{ stats.todayRevenue }}</text>
        </view>
        <view class="info-row">
          <text>会员数</text>
          <text class="value">{{ stats.members }}</text>
        </view>
      </view>

      <view class="card">
        <text class="section-title">活动管理</text>
        <button class="small-button" @click="goActivityList">进入活动管理</button>
      </view>

      <view class="card">
        <text class="section-title">活动配置</text>
        <view class="config-item" v-for="activity in activities" :key="activity.id">
          <view class="config-row">
            <text class="config-title">{{ activity.name }}</text>
            <text class="status">{{ activity.enabled ? '已启用' : '已禁用' }}</text>
          </view>
          <text class="config-desc">{{ activity.desc }}</text>
          <button class="small-button" @click="toggleActivity(activity)">
            {{ activity.enabled ? '关闭' : '启用' }}
          </button>
        </view>
      </view>

      <view class="card">
        <text class="section-title">优惠规则</text>
        <view class="rule-item" v-for="rule in discountRules" :key="rule.id">
          <text class="rule-title">{{ rule.title }}</text>
          <text class="rule-desc">{{ rule.detail }}</text>
        </view>
      </view>

      <view class="card">
        <text class="section-title">订单查看</text>
        <view class="order-item" v-for="order in orders" :key="order.id">
          <view class="order-row">
            <text>订单号：{{ order.id }}</text>
            <text class="status">{{ order.status }}</text>
          </view>
          <view class="order-row">
            <text>用户：{{ order.user }}</text>
            <text>金额：¥{{ order.amount }}</text>
          </view>
          <text class="order-desc">服务：{{ order.service }}</text>
        </view>
      </view>

      <button class="logout-button" @click="logout">退出登录</button>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'

const loggedIn = ref(false)
const loginForm = reactive({ username: '', password: '' })

const stats = reactive({
  totalOrders: 128,
  todayRevenue: 3560,
  members: 620
})

const activities = reactive([
  { id: 1, name: '周末洗车活动', desc: '周末充值享受 9 折优惠', enabled: true },
  { id: 2, name: '新用户首单', desc: '新用户首单立减 ¥20', enabled: false },
  { id: 3, name: '会员日特权', desc: '每月 15 号会员洗车买一送一', enabled: true }
])

const discountRules = reactive([
  { id: 1, title: '会员等级折扣', detail: '黄金会员享受 10% 折扣，钻石会员享受 15% 折扣' },
  { id: 2, title: '充值赠送规则', detail: '充值满 100 赠送 15，充值满 200 赠送 40' },
  { id: 3, title: '积分换购', detail: '积分可抵现金，100 积分抵 ¥5' }
])

const orders = reactive([
  { id: 'OD20260714001', user: '张三', service: '精致洗车', amount: 128, status: '已完成' },
  { id: 'OD20260714002', user: '李四', service: '基础洗车', amount: 68, status: '进行中' },
  { id: 'OD20260714003', user: '王五', service: '至尊洗车', amount: 198, status: '待支付' }
])

const login = () => {
  if (loginForm.username === 'admin' && loginForm.password === 'admin123') {
    loggedIn.value = true
    uni.showToast({ title: '登录成功', icon: 'success' })
  } else {
    uni.showToast({ title: '账号或密码错误', icon: 'none' })
  }
}

const logout = () => {
  loggedIn.value = false
  loginForm.username = ''
  loginForm.password = ''
}

const goActivityList = () => {
  uni.navigateTo({
    url: '/pages/admin/activity/index'
  })
}

const toggleActivity = (activity) => {
  activity.enabled = !activity.enabled
}
</script>

<style>
.page {
  padding: 24px;
}
.title {
  font-size: 24px;
  margin-bottom: 20px;
}
.card {
  background: #fff;
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 4px 12px rgba(0,0,0,.08);
  margin-bottom: 18px;
}
.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.input {
  flex: 1;
  height: 42px;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  padding: 0 12px;
  margin-left: 12px;
}
.action-button,
.small-button,
.logout-button {
  background: #1a73e8;
  color: #fff;
  border-radius: 12px;
  padding: 10px 16px;
  margin-top: 12px;
}
.small-button {
  background: #2d8cf0;
  margin-top: 10px;
}
.logout-button {
  width: 100%;
}
.section-title {
  font-weight: bold;
  margin-bottom: 12px;
}
.info-row,
.config-row,
.order-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}
.value {
  font-weight: bold;
}
.status {
  color: #1a73e8;
}
.config-item,
.rule-item,
.order-item {
  background: #f7f7f7;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
}
.config-title,
.rule-title {
  font-weight: bold;
}
.config-desc,
.rule-desc,
.order-desc {
  color: #666;
  margin-top: 6px;
}
.tip {
  color: #888;
  font-size: 14px;
  margin-top: 8px;
}
</style>
