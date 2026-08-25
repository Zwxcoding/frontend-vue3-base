import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, beforeEach, test } from 'node:test'
import { Pool } from 'pg'
import { CreditAccount } from '../src/application/account/CreditAccount.js'
import { DebitAccount } from '../src/application/account/DebitAccount.js'
import { GetAccount } from '../src/application/account/GetAccount.js'
import { runMigrations } from '../src/database/migrate.js'
import { AccountService } from '../src/domain/account/AccountService.js'
import { MemberAccount } from '../src/domain/account/MemberAccount.js'
import { Member } from '../src/domain/member/Member.js'
import { PostgresAccountTransactionManager } from '../src/repositories/postgres/PostgresAccountTransactionManager.js'
import { PostgresAccountTransactionRepository } from '../src/repositories/postgres/PostgresAccountTransactionRepository.js'
import { PostgresMemberAccountRepository } from '../src/repositories/postgres/PostgresMemberAccountRepository.js'
import { PostgresMemberRepository } from '../src/repositories/postgres/PostgresMemberRepository.js'

const databaseUrl = process.env.TEST_DATABASE_URL

if (!databaseUrl) {
  test('Account PostgreSQL tests require TEST_DATABASE_URL', { skip: true }, () => {})
} else {
  const database = new Pool({ connectionString: databaseUrl })
  const members = new PostgresMemberRepository(database)
  const accounts = new PostgresMemberAccountRepository(database)
  const transactions = new PostgresAccountTransactionRepository(database)
  const accountService = new AccountService(new PostgresAccountTransactionManager(database))
  const creditAccount = new CreditAccount(accounts, accountService)
  const debitAccount = new DebitAccount(accounts, accountService)
  const getAccount = new GetAccount(accounts)

  before(async () => { await runMigrations(database) })
  beforeEach(async () => {
    await database.query('TRUNCATE account_transaction, member_account, member CASCADE')
  })
  after(async () => { await database.end() })

  const createMemberAndAccount = async (balance = 0): Promise<{ member: Member; account: MemberAccount }> => {
    const now = new Date('2026-08-10T00:00:00.000Z')
    const member = new Member({
      id: randomUUID(), openid: `openid-${randomUUID()}`, mobile: '13800000000',
      name: '测试会员', status: 'active', createTime: now, updateTime: now
    })
    const account = new MemberAccount({
      id: randomUUID(), memberId: member.id, balance, version: 1,
      status: 'active', createTime: now, updateTime: now
    })
    await members.save(member)
    await accounts.create(account)
    return { member, account }
  }

  test('A01 创建会员账户', async () => {
    const { member, account } = await createMemberAndAccount()
    assert.deepEqual(await accounts.findByMemberId(member.id), account)
  })

  test('A02 查询余额', async () => {
    const { member } = await createMemberAndAccount(88.5)
    assert.equal((await getAccount.execute(member.id)).getBalance(), 88.5)
  })

  test('A03 充值增加余额', async () => {
    const { member } = await createMemberAndAccount(20)
    const result = await creditAccount.execute(member.id, {
      amount: 100, referenceType: 'TEST', referenceId: 'test-001'
    })
    assert.equal(result.account.balance, 120)
    assert.equal((await getAccount.execute(member.id)).balance, 120)
  })

  test('A04 充值生成流水', async () => {
    const { member } = await createMemberAndAccount(20)
    await creditAccount.execute(member.id, { amount: 100, referenceType: 'TEST', referenceId: 'test-002' })
    const records = await transactions.findByMemberId(member.id)
    assert.equal(records.length, 1)
    assert.equal(records[0]?.transactionType, 'RECHARGE')
    assert.equal(records[0]?.beforeBalance, 20)
    assert.equal(records[0]?.afterBalance, 120)
  })

  test('A05 消费扣减余额', async () => {
    const { member } = await createMemberAndAccount(100)
    const result = await debitAccount.execute(member.id, {
      amount: 20, referenceType: 'TEST', referenceId: 'consume-001'
    })
    assert.equal(result.account.balance, 80)
    assert.equal(result.transaction.transactionType, 'CONSUME')
  })

  test('A06 余额不足失败且不写流水', async () => {
    const { member } = await createMemberAndAccount(10)
    await assert.rejects(
      () => debitAccount.execute(member.id, { amount: 20, referenceType: 'TEST', referenceId: 'consume-002' }),
      /Insufficient account balance/
    )
    assert.equal((await getAccount.execute(member.id)).balance, 10)
    assert.equal((await transactions.findByMemberId(member.id)).length, 0)
  })

  test('A07 重复referenceId不能重复入账', async () => {
    const { member } = await createMemberAndAccount()
    const input = { amount: 100, referenceType: 'TEST', referenceId: 'same-reference' }
    const first = await creditAccount.execute(member.id, input)
    const second = await creditAccount.execute(member.id, input)
    assert.equal(first.duplicate, false)
    assert.equal(second.duplicate, true)
    assert.equal((await getAccount.execute(member.id)).balance, 100)
    assert.equal((await transactions.findByMemberId(member.id)).length, 1)
  })

  test('A08 交易流水Repository不可修改和删除', async () => {
    const { member } = await createMemberAndAccount()
    await creditAccount.execute(member.id, { amount: 10, referenceType: 'TEST', referenceId: 'immutable' })
    assert.equal('update' in transactions, false)
    assert.equal('delete' in transactions, false)
    assert.equal(Object.isFrozen((await transactions.findByMemberId(member.id))[0]), true)
  })

  test('A09 并发扣款不会产生负余额', async () => {
    const { member } = await createMemberAndAccount(100)
    const outcomes = await Promise.allSettled([
      debitAccount.execute(member.id, { amount: 80, referenceType: 'TEST', referenceId: 'concurrent-1' }),
      debitAccount.execute(member.id, { amount: 80, referenceType: 'TEST', referenceId: 'concurrent-2' })
    ])
    assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter((item) => item.status === 'rejected').length, 1)
    assert.equal((await getAccount.execute(member.id)).balance, 20)
    assert.equal((await transactions.findByMemberId(member.id)).length, 1)
  })

  test('A10 账户和流水事务一致', async () => {
    const { member } = await createMemberAndAccount(50)
    await assert.rejects(
      () => creditAccount.execute(member.id, { amount: -1, referenceType: 'TEST', referenceId: 'rollback' }),
      /greater than 0/
    )
    assert.equal((await getAccount.execute(member.id)).balance, 50)
    assert.equal((await transactions.findByMemberId(member.id)).length, 0)
  })
}
