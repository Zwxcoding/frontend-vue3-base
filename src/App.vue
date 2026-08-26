<template>
  <view class="container">
    <text>uni-app Vue3 base</text>
  </view>
</template>

<script setup>
import { onLaunch } from '@dcloudio/uni-app'
import { ensureLogin } from './services/wxLoginService.js'

onLaunch(() => {
  ensureLogin().catch((error) => {
    console.warn('[app] ensureLogin failed at launch', error)
  })
})
</script>

<style>
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}
</style>
