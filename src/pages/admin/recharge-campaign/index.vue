<template>
  <view class="page">
    <text class="page-title">充值营销活动管理</text>
    <view class="form-card">
      <text class="section-title">{{ editingId ? '编辑活动' : '新增活动' }}</text>
      <view class="form-row"><text class="label">活动名称</text><input class="input" v-model="form.name" /></view>
      <view class="form-row"><text class="label">充值门槛</text><input class="input" type="number" v-model="form.thresholdAmount" /></view>
      <view class="form-row"><text class="label">赠送金额</text><input class="input" type="digit" v-model="form.bonusAmount" /></view>
      <view class="form-row"><text class="label">优先级</text><input class="input" type="number" v-model="form.priority" /></view>
      <view class="form-row"><text class="label">开始时间</text><input class="input" v-model="form.startTime" placeholder="2026-08-01" /></view>
      <view class="form-row"><text class="label">结束时间</text><input class="input" v-model="form.endTime" placeholder="2026-08-31" /></view>
      <view class="form-row">
        <text class="label">状态</text>
        <picker :range="statusOptions" range-key="label" :value="statusIndex" @change="changeStatus">
          <view class="input picker-value">{{ statusOptions[statusIndex].label }}</view>
        </picker>
      </view>
      <view class="form-row"><text class="label">操作原因</text><input class="input" v-model="form.operationReason" /></view>
      <view class="button-row">
        <button class="primary-button" v-if="canCreateOrUpdate" @click="saveCampaign">保存活动</button>
        <button class="secondary-button" v-if="editingId" @click="resetForm">取消编辑</button>
      </view>
    </view>

    <view class="form-card">
      <text class="section-title">活动生效预览</text>
      <view class="form-row"><text class="label">充值金额</text><input class="input" type="number" v-model="previewAmount" /></view>
      <button class="primary-button" @click="preview">预览Quote</button>
      <view v-if="previewQuote" class="preview">
        <text>充值金额：¥{{ previewTrace.amount }}</text>
        <text>套餐：{{ previewTrace.planName }}</text>
        <text>基础赠送：¥{{ previewTrace.baseBonus }}</text>
        <text>匹配活动：{{ previewTrace.campaignName || '无' }}</text>
        <text>活动赠送：¥{{ previewTrace.campaignBonus }}</text>
        <text>effectMode：{{ previewTrace.effectMode }}</text>
        <text>最终赠送：¥{{ previewTrace.finalBonus }}</text>
        <text>到账：¥{{ previewTrace.totalAmount }}</text>
      </view>
    </view>

    <view v-if="campaigns.length === 0" class="empty-state">暂无充值营销活动</view>
    <view v-else>
      <view class="campaign-card" v-for="campaign in campaigns" :key="campaign.id">
        <view class="row"><text>名称</text><text>{{ campaign.name }}</text></view>
        <view class="row"><text>活动规则</text><text>满{{ campaign.thresholdAmount }}送{{ campaign.bonusAmount }}</text></view>
        <view class="row"><text>优先级</text><text>{{ campaign.priority }}</text></view>
        <view class="row"><text>状态</text><text>{{ campaign.status }}</text></view>
        <view class="row"><text>审批状态</text><text>{{ campaign.approvalStatus || 'approved' }}</text></view>
        <view class="row"><text>有效期</text><text>{{ campaign.startTime }} ~ {{ campaign.endTime }}</text></view>
        <view class="row"><text>版本</text><text>v{{ campaign.version }}</text></view>
        <view class="row"><text>更新时间</text><text>{{ campaign.updateTime }}</text></view>
        <view class="button-row">
          <button class="small-button" v-if="canUpdate" @click="editCampaign(campaign)">编辑</button>
          <button class="small-button" v-if="canEnable && campaign.status === 'active'" @click="toggleCampaign(campaign, false)">下架</button>
          <button class="small-button" v-if="canEnable && campaign.status !== 'active'" @click="toggleCampaign(campaign, true)">上架</button>
          <button class="small-button" v-if="canUpdate && campaign.approvalStatus === 'draft'" @click="submitApproval(campaign)">提交审批</button>
          <button class="small-button" v-if="canApprove && campaign.approvalStatus === 'pending'" @click="approveCampaign(campaign)">审批通过</button>
          <button class="danger-button" v-if="canDelete" @click="softDeleteCampaign(campaign)">删除</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  approveRechargeCampaign,
  checkRechargeCampaignPublishRisk,
  createRechargeCampaign,
  deleteRechargeCampaign,
  disableRechargeCampaign,
  enableRechargeCampaign,
  getRechargeCampaignsForAdmin,
  previewRechargeCampaignTrace,
  submitRechargeCampaignForApproval,
  updateRechargeCampaign
} from '../../../services/rechargeCampaignAdminService.js'
import {
  DEFAULT_ADMIN_ACTOR,
  hasAdminPermission
} from '../../../services/adminPermissionService.js'

const actor = DEFAULT_ADMIN_ACTOR
const campaigns = reactive([])
const editingId = ref(null)
const previewAmount = ref('100')
const previewQuote = ref(null)
const previewTrace = ref({})
const statusOptions = [{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }]
const form = reactive({
  name: '', thresholdAmount: '', bonusAmount: '', priority: '0',
  startTime: '', endTime: '', status: 'active', operationReason: ''
})
const statusIndex = computed(() => Math.max(statusOptions.findIndex((item) => item.value === form.status), 0))
const canCreateOrUpdate = computed(() => hasAdminPermission(actor, editingId.value ? 'UPDATE' : 'CREATE'))
const canUpdate = hasAdminPermission(actor, 'UPDATE')
const canEnable = hasAdminPermission(actor, 'ENABLE')
const canDelete = hasAdminPermission(actor, 'DELETE')
const canApprove = hasAdminPermission(actor, 'APPROVE')
const loadCampaigns = async () => {
  const result = await Promise.resolve(getRechargeCampaignsForAdmin())
  campaigns.splice(0, campaigns.length, ...result)
}
const resetForm = () => {
  editingId.value = null
  Object.assign(form, {
    name: '', thresholdAmount: '', bonusAmount: '', priority: '0',
    startTime: '', endTime: '', status: 'active', operationReason: ''
  })
}
const changeStatus = (event) => { form.status = statusOptions[Number(event.detail.value)].value }
const saveCampaign = async () => {
  try {
    const data = {
      name: form.name,
      thresholdAmount: Number(form.thresholdAmount),
      bonusAmount: Number(form.bonusAmount),
      effectMode: 'override',
      priority: Number(form.priority),
      startTime: form.startTime,
      endTime: form.endTime,
      status: form.status,
      operator: 'admin',
      operationReason: form.operationReason
    }
    const result = editingId.value
      ? await updateRechargeCampaign(editingId.value, data, actor)
      : await createRechargeCampaign(data, actor)
    resetForm()
    await loadCampaigns()
    uni.showToast({
      title: result.warning ? '已保存，存在规则冲突' : '活动已保存',
      icon: 'none'
    })
  } catch (error) {
    uni.showToast({ title: error.message || '保存失败', icon: 'none' })
  }
}
const editCampaign = (campaign) => {
  editingId.value = campaign.id
  Object.assign(form, {
    name: campaign.name,
    thresholdAmount: String(campaign.thresholdAmount),
    bonusAmount: String(campaign.bonusAmount),
    priority: String(campaign.priority),
    startTime: campaign.startTime,
    endTime: campaign.endTime,
    status: campaign.status,
    operationReason: ''
  })
}
const toggleCampaign = async (campaign, enabled) => {
  try {
    if (enabled) await enableRechargeCampaign(campaign.id, { operator: 'admin', operationReason: '后台上架' }, actor)
    else await disableRechargeCampaign(campaign.id, { operator: 'admin', operationReason: '后台下架' }, actor)
    await loadCampaigns()
  } catch (error) {
    uni.showToast({ title: error.message || '操作失败', icon: 'none' })
  }
}
const softDeleteCampaign = (campaign) => {
  uni.showModal({
    title: '删除活动',
    content: '活动不会被物理删除，将转换为停用状态。',
    success: async (result) => {
      if (!result.confirm) return
      try {
        await deleteRechargeCampaign(campaign.id, {
          operator: 'admin',
          operationReason: '后台软删除'
        }, actor)
        await loadCampaigns()
      } catch (error) {
        uni.showToast({ title: error.message || '删除失败', icon: 'none' })
      }
    }
  })
}
const submitApproval = async (campaign) => {
  try {
    await submitRechargeCampaignForApproval(campaign.id, actor, '提交运营审批')
    await loadCampaigns()
  } catch (error) {
    uni.showToast({ title: error.message || '提交失败', icon: 'none' })
  }
}
const approveCampaign = (campaign) => {
  const risk = checkRechargeCampaignPublishRisk(campaign)
  if (!risk.pass) {
    uni.showToast({ title: risk.errors[0], icon: 'none' })
    return
  }
  const finish = async () => {
    await approveRechargeCampaign(campaign.id, actor, '审批通过')
    await loadCampaigns()
  }
  if (risk.warnings.length > 0) {
    uni.showModal({
      title: '发布风险提示',
      content: risk.warnings.join('；'),
      success: (result) => { if (result.confirm) finish() }
    })
  } else {
    finish()
  }
}
const preview = async () => {
  try {
    const result = await previewRechargeCampaignTrace(Number(previewAmount.value))
    previewQuote.value = result.quote
    previewTrace.value = result.trace
  } catch (error) {
    uni.showToast({ title: error.message || '预览失败', icon: 'none' })
  }
}
onShow(loadCampaigns)
</script>

<style>
.page { padding: 32rpx; background: #f2f6f9; }
.page-title { font-size: 34rpx; font-weight: bold; color: #0f3d1a; }
.form-card, .campaign-card { background: #fff; border-radius: 28rpx; padding: 28rpx; margin-top: 24rpx; }
.section-title { display: block; font-weight: bold; margin-bottom: 24rpx; }
.form-row { margin-bottom: 20rpx; }
.label { display: block; color: #4f5f4a; }
.input { height: 84rpx; border: 1rpx solid #e5e5e5; border-radius: 18rpx; padding: 0 20rpx; margin-top: 10rpx; }
.picker-value { line-height: 84rpx; }
.row { display: flex; justify-content: space-between; margin-bottom: 14rpx; }
.button-row { display: flex; gap: 12rpx; margin-top: 18rpx; }
.primary-button, .small-button { background: #1e8f47; color: #fff; }
.secondary-button { background: #839187; color: #fff; }
.danger-button { background: #c84b4b; color: #fff; }
.primary-button, .secondary-button, .small-button, .danger-button { border-radius: 18rpx; font-size: 26rpx; }
.preview { display: flex; flex-direction: column; gap: 10rpx; margin-top: 20rpx; color: #0f3d1a; }
.empty-state { text-align: center; color: #667867; padding: 60rpx 0; }
</style>
