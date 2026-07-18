<template>
  <view class="page">
    <text class="title">洗车服务</text>
    <view class="service-card" v-for="item in services" :key="item.name">
      <text class="service-name">{{ item.name }}</text>
      <text class="service-desc">{{ item.desc }}</text>
      <text class="service-price">¥ {{ item.price }}</text>
    </view>
  </view>
</template>

<script setup>
const services = [
  { name: '基础洗车', desc: '外观清洗 + 车身擦拭', price: 68 },
  { name: '精致洗车', desc: '内外全面清洁 + 抛光', price: 128 },
  { name: '至尊洗车', desc: '深度养护 + 漆面保护', price: 198 }
]
</script>

<style>
.page {
  padding: 24px;
}
.title {
  font-size: 24px;
  margin-bottom: 18px;
}
.service-card {
  background: #fff;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 4px 12px rgba(0,0,0,.06);
  margin-bottom: 14px;
}
.service-name {
  font-size: 18px;
  font-weight: bold;
}
.service-desc {
  margin: 8px 0;
  color: #666;
}
.service-price {
  color: #f55;
  font-size: 18px;
}
</style>
