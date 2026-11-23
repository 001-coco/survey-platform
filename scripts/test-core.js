/**
 * 手写基础设施的用例：npm run test:core
 * 不依赖测试框架，只用 node:assert —— 这也是「不堆工程」的一部分。
 */
import assert from 'node:assert/strict'
import {
  deepClone,
  debounce,
  throttle,
  myAll,
  myAllSettled,
  myRace,
  myAny,
  runPool,
  retry,
  EventBus,
  createPrivateCounter
} from '../src/core/index.js'

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failed++
    console.log(`  ✗ ${name}\n      ${error.message}`)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const delayed = (ms, value, fail) =>
  new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error(fail)) : resolve(value)), ms))

console.log('\n[deepClone]')
await test('循环引用', () => {
  const source = { name: 'a' }
  source.self = source
  const cloned = deepClone(source)
  assert.equal(cloned.self, cloned)
  assert.notEqual(cloned, source)
})
await test('Date / RegExp / Map / Set / 原型', () => {
  class Point { constructor(x) { this.x = x } double() { return this.x * 2 } }
  const source = {
    date: new Date('2026-01-01'),
    reg: /lab/gi,
    map: new Map([['k', { v: 1 }]]),
    set: new Set([1, 2]),
    point: new Point(3)
  }
  const c = deepClone(source)
  assert.ok(c.date instanceof Date)
  assert.ok(c.reg instanceof RegExp)
  assert.deepEqual(c.map.get('k'), { v: 1 })
  assert.equal(c.set.size, 2)
  assert.ok(c.point instanceof Point)
  assert.equal(c.point.double(), 6)
})

console.log('\n[debounce / throttle]')
await test('防抖只执行最后一次', async () => {
  let calls = 0
  const fn = debounce(() => calls++, 20)
  fn(); fn(); fn()
  assert.equal(calls, 0)
  await sleep(40)
  assert.equal(calls, 1)
})
await test('cancel / flush', async () => {
  let calls = 0
  const fn = debounce(() => calls++, 30)
  fn(); fn.cancel()
  await sleep(45)
  assert.equal(calls, 0)
  fn(); fn.flush()
  assert.equal(calls, 1)
})
await test('节流窗口内只执行一次', async () => {
  let calls = 0
  const fn = throttle(() => calls++, 25)
  fn(); fn(); fn()
  assert.equal(calls, 1)
  await sleep(40)
})

console.log('\n[Promise statics]')
await test('myAll 保序', async () => {
  assert.deepEqual(await myAll([delayed(30, 'a'), delayed(5, 'b'), delayed(15, 'c')]), ['a', 'b', 'c'])
})
await test('myAll 快速失败', async () => {
  await assert.rejects(myAll([delayed(200, 'slow'), delayed(5, null, 'boom')]), /boom/)
})
await test('myAllSettled 永不 reject', async () => {
  const r = await myAllSettled([delayed(5, 1), delayed(10, null, 'bad')])
  assert.equal(r[0].status, 'fulfilled')
  assert.equal(r[1].status, 'rejected')
})
await test('myRace 取第一个落定', async () => {
  assert.equal(await myRace([delayed(50, 'slow'), delayed(5, 'fast')]), 'fast')
})
await test('myAny 全失败抛 AggregateError', async () => {
  await assert.rejects(myAny([delayed(5, null, 'a'), delayed(10, null, 'b')]), (e) => e.name === 'AggregateError')
})

console.log('\n[asyncPool / retry]')
await test('并发池峰值受限且结果按序', async () => {
  let active = 0, peak = 0
  const tasks = Array.from({ length: 20 }, (_, i) => async () => {
    active++; peak = Math.max(peak, active)
    await sleep(5)
    active--
    return i
  })
  const { results, stats } = await runPool(tasks, 4)
  assert.ok(peak <= 4, `峰值 ${peak}`)
  assert.equal(results[19].value, 19)
  assert.equal(stats.limit, 4)
})
await test('重试退避并记录次数', async () => {
  let calls = 0
  const value = await retry(
    async () => {
      calls++
      if (calls < 3) throw new Error('temporary')
      return 'ok'
    },
    { retries: 3, baseDelay: 5, jitter: false }
  )
  assert.equal(value, 'ok')
  assert.equal(calls, 3)
})

console.log('\n[EventBus / private counter]')
await test('发布订阅与取消', () => {
  const bus = new EventBus()
  let got = null
  const off = bus.on('x', (v) => (got = v))
  bus.emit('x', 42)
  assert.equal(got, 42)
  off()
  bus.emit('x', 1)
  assert.equal(got, 42)
})
await test('计数器状态在闭包里，外部拿不到', () => {
  const counter = createPrivateCounter(5)
  counter.inc(2)
  assert.equal(counter.value(), 7)
  assert.equal('count' in counter, false)
})

console.log(`\n${failed === 0 ? '全部通过' : '存在失败'}：${passed} 通过 / ${failed} 失败\n`)
if (failed > 0) process.exit(1)
