# 《Recharge活动规则测试报告》

## 1. 测试环境

- 项目：frontend-vue3-base
- 日期：2026-07-23
- 测试框架：Node.js 内置 `node:test`
- 执行命令：`node --test tests/*.test.js`
- Storage：测试进程内存模拟 uni storage

## 2. 修改文件

- `src/services/activityService.js`
- `src/services/rechargeService.js`
- `src/pages/recharge/recharge.vue`
- `tests/recharge-activity.test.js`
- `tests/Recharge活动规则测试报告.md`

未修改 discount 页面、`calculateConsume()` 或 `consumeService()`。

## 3. 修改前后规则

修改前：

```text
有效充值活动按全局priority排序
→ 页面只允许选择全局第一名
→ 页面再次按金额筛选
→ rechargeService再次按金额筛选
```

修改后：

```text
选择充值金额
→ 过滤有效recharge活动
→ 过滤 amount >= rechargeAmount
→ priority DESC
→ priority相同时id DESC
→ 返回唯一活动与统一充值计算结果
→ 页面展示该结果
→ rechargeService使用同一结果
```

统一结果：

```js
{
  activity,
  rechargeAmount,
  bonusAmount,
  totalAmount
}
```

## 4. 自动化测试结果

| 编号 | 测试内容 | 结果 |
|---|---|---|
| R-01 | 充值200送50，到账250 | 通过 |
| R-02 | 高priority但500门槛不阻塞100门槛活动 | 通过 |
| R-03 | 同时满足门槛时选择高priority活动 | 通过 |
| R-04 | 高priority过期时选择低priority有效活动 | 通过 |
| R-05 | 高priority inactive时选择低priority active活动 | 通过 |
| R-06 | priority相同时选择id较大活动 | 通过 |
| R-07 | 无符合金额条件活动时不使用活动赠送 | 通过 |
| R-08 | 页面计算、Service、余额和充值记录一致 | 通过 |

全量测试：

```text
tests 14
pass 14
fail 0
skipped 0
```

## 5. 编译结果

执行：

```text
npm run dev:mp-weixin
```

结果：

```text
DONE Build complete.
ready in 6922ms.
```

## 6. 未解决风险

1. 默认充值套餐仍有独立赠送金额；没有匹配 Activity 时继续采用原套餐赠送逻辑。
2. 余额与充值记录使用两次同步 storage 写入，暂不具备后端事务能力。
3. 自动化测试覆盖 Service 和页面源码契约，尚未自动驱动微信开发者工具完成真实点击。
4. 项目仍没有 `npm test` 脚本，当前使用 `node --test tests/*.test.js`。
