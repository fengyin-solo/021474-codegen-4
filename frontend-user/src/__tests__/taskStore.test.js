/**
 * 任务中心 / 评价中心 - 评价规则单元测试
 *
 * 覆盖：
 * - 可评价判定（仅已完成；未完成 / 已取消不可评价）
 * - 评分范围越界、空反馈、反馈过长
 * - 重复提交拒绝（幂等）
 * - 提交失败不写入、可重试；成功后写入并可查看结果
 * - 任务操作按钮与评价状态一致（评价 / 查看评价）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  taskStore,
  canReviewTask,
  hasReviewedTask,
  validateReviewInput,
  REVIEW_ERRORS,
  REVIEW_RULES
} from '../utils/taskStore'

// ==================== Mock 设置 ====================

const localStorageMock = {
  store: {},
  getItem: vi.fn(key => (key in localStorageMock.store ? localStorageMock.store[key] : null)),
  setItem: vi.fn((key, value) => {
    localStorageMock.store[key] = String(value)
  }),
  removeItem: vi.fn(key => {
    delete localStorageMock.store[key]
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {}
  })
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock, configurable: true })

function resetLocalStorageMock() {
  localStorageMock.setItem.mockReset().mockImplementation((key, value) => {
    localStorageMock.store[key] = String(value)
  })
  localStorageMock.getItem.mockReset().mockImplementation(key =>
    key in localStorageMock.store ? localStorageMock.store[key] : null
  )
  localStorageMock.clear.mockReset().mockImplementation(() => {
    localStorageMock.store = {}
  })
  localStorageMock.clear()
}

// 固定时钟，保证 createdAt 可预测
const NOW = new Date('2026-09-20T10:00:00')
vi.useFakeTimers()
vi.setSystemTime(NOW)

// ==================== 测试辅助 ====================

function seedTasks(tasks) {
  localStorageMock.clear()
  localStorageMock.store['billiard_user_tasks'] = JSON.stringify(tasks)
}

function makeTask(overrides = {}) {
  return {
    id: 'T-TEST-' + Math.random().toString(36).slice(2, 8),
    type: 'order',
    title: '测试商品',
    subtitle: '测试描述',
    amount: 100,
    status: 'completed',
    createdAt: '2026-09-01 10:00',
    ...overrides
  }
}

const alwaysResolve = () => Promise.resolve(true)
const alwaysReject = () => Promise.reject(new Error('网络开小差了'))

// ==================== 测试用例 ====================

describe('Review eligibility rules', () => {
  beforeEach(() => {
    resetLocalStorageMock()
    vi.clearAllMocks()
  })

  it('canReviewTask 仅对 completed 状态返回 true', () => {
    expect(canReviewTask(makeTask({ status: 'completed' }))).toBe(true)
    ;['pending_payment', 'upcoming', 'ongoing', 'pending_shipment', 'shipped', 'cancelled'].forEach(status => {
      expect(canReviewTask(makeTask({ status }))).toBe(false)
    })
  })

  it('未完成或已取消记录不能评价', () => {
    expect(canReviewTask(makeTask({ status: 'cancelled' }))).toBe(false)
    expect(canReviewTask(makeTask({ status: 'ongoing' }))).toBe(false)
    expect(canReviewTask(null)).toBe(false)
    expect(canReviewTask(undefined)).toBe(false)
  })

  it('hasReviewedTask 仅在存在带评分的 review 时为 true', () => {
    expect(hasReviewedTask(makeTask())).toBe(false)
    expect(hasReviewedTask(makeTask({ review: { rating: 5 } }))).toBe(true)
    expect(hasReviewedTask(makeTask({ review: { rating: 0 } }))).toBe(false)
    expect(hasReviewedTask(null)).toBe(false)
  })

  it('getPendingReviews / getReviewedTasks 按同一规则过滤', () => {
    seedTasks([
      makeTask({ id: 'T1', status: 'completed' }),
      makeTask({ id: 'T2', status: 'completed', review: { rating: 4, feedback: '不错', createdAt: '2026-09-10 10:00' } }),
      makeTask({ id: 'T3', status: 'cancelled' }),
      makeTask({ id: 'T4', status: 'ongoing' }),
      makeTask({ id: 'T5', status: 'completed', review: { rating: 3, feedback: '一般', createdAt: '2026-09-12 10:00' } })
    ])

    const pending = taskStore.getPendingReviews()
    const reviewed = taskStore.getReviewedTasks()

    expect(pending.map(t => t.id)).toEqual(['T1'])
    // 最新评价在前
    expect(reviewed.map(t => t.id)).toEqual(['T5', 'T2'])
    expect(taskStore.getPendingReviewCount()).toBe(1)
  })
})

describe('validateReviewInput 输入校验', () => {
  beforeEach(() => {
    resetLocalStorageMock()
  })

  it('任务不存在时返回 TASK_NOT_FOUND', () => {
    const result = validateReviewInput(null, { rating: 5, feedback: '很好' })
    expect(result.valid).toBe(false)
    expect(result.error.code).toBe('TASK_NOT_FOUND')
  })

  it('未完成 / 已取消任务返回 NOT_COMPLETED', () => {
    const cancelled = validateReviewInput(makeTask({ status: 'cancelled' }), { rating: 5, feedback: '很好' })
    const ongoing = validateReviewInput(makeTask({ status: 'ongoing' }), { rating: 5, feedback: '很好' })
    expect(cancelled.error.code).toBe('NOT_COMPLETED')
    expect(ongoing.error.code).toBe('NOT_COMPLETED')
  })

  it('已评价任务重复提交返回 ALREADY_REVIEWED（即使参数非法也优先拦截重复）', () => {
    const task = makeTask({ review: { rating: 1, feedback: '旧评价' } })
    const result = validateReviewInput(task, { rating: null, feedback: '' })
    expect(result.valid).toBe(false)
    expect(result.error.code).toBe('ALREADY_REVIEWED')
  })

  it('未选择评分返回 RATING_REQUIRED', () => {
    expect(validateReviewInput(makeTask(), { rating: null, feedback: '内容' }).error.code).toBe('RATING_REQUIRED')
    expect(validateReviewInput(makeTask(), { rating: undefined, feedback: '内容' }).error.code).toBe('RATING_REQUIRED')
    expect(validateReviewInput(makeTask(), { rating: '', feedback: '内容' }).error.code).toBe('RATING_REQUIRED')
  })

  it.each([0, 6, -1, 2.5, 10, 'abc'])('评分越界 %s 返回 RATING_OUT_OF_RANGE', rating => {
    const result = validateReviewInput(makeTask(), { rating, feedback: '内容' })
    expect(result.error.code).toBe('RATING_OUT_OF_RANGE')
  })

  it.each([1, 2, 3, 4, 5])('合法评分 %s 通过校验', rating => {
    const result = validateReviewInput(makeTask(), { rating, feedback: '  不错的体验  ' })
    expect(result.valid).toBe(true)
    expect(result.rating).toBe(rating)
    // 反馈去除首尾空白
    expect(result.feedback).toBe('不错的体验')
  })

  it('空反馈（含纯空白）返回 FEEDBACK_EMPTY', () => {
    expect(validateReviewInput(makeTask(), { rating: 5, feedback: '' }).error.code).toBe('FEEDBACK_EMPTY')
    expect(validateReviewInput(makeTask(), { rating: 5, feedback: '   ' }).error.code).toBe('FEEDBACK_EMPTY')
    expect(validateReviewInput(makeTask(), { rating: 5, feedback: '\n\t ' }).error.code).toBe('FEEDBACK_EMPTY')
  })

  it('反馈超长返回 FEEDBACK_TOO_LONG', () => {
    const longFeedback = '很'.repeat(REVIEW_RULES.MAX_FEEDBACK_LENGTH + 1)
    const result = validateReviewInput(makeTask(), { rating: 5, feedback: longFeedback })
    expect(result.error.code).toBe('FEEDBACK_TOO_LONG')
  })

  it('反馈恰好达到最大长度允许通过', () => {
    const maxFeedback = '好'.repeat(REVIEW_RULES.MAX_FEEDBACK_LENGTH)
    const result = validateReviewInput(makeTask(), { rating: 5, feedback: maxFeedback })
    expect(result.valid).toBe(true)
  })
})

describe('submitReview 提交与重试', () => {
  beforeEach(() => {
    resetLocalStorageMock()
    vi.clearAllMocks()
  })

  it('提交成功后写入评价，且可通过 getReview 查看结果', async () => {
    const task = makeTask({ id: 'T-OK' })
    seedTasks([task])

    const result = await taskStore.submitReview('T-OK', { rating: 5, feedback: '非常满意' }, alwaysResolve)

    expect(result.success).toBe(true)
    expect(result.review.rating).toBe(5)
    expect(result.review.feedback).toBe('非常满意')
    expect(result.review.createdAt).toBeDefined()

    expect(taskStore.getReview('T-OK')).toMatchObject({ rating: 5, feedback: '非常满意' })

    const stored = taskStore.getById('T-OK')
    expect(stored.reviewed).toBe(true)
    expect(stored.canReview).toBe(true)
  })

  it('重复提交被拒绝，保留首次评价不变', async () => {
    seedTasks([makeTask({ id: 'T-DUP', review: { rating: 3, feedback: '第一次评价', createdAt: '2026-09-10 10:00' } })])

    const result = await taskStore.submitReview('T-DUP', { rating: 1, feedback: '第二次评价' }, alwaysResolve)

    expect(result.success).toBe(false)
    expect(result.retryable).toBe(false)
    expect(result.error.code).toBe('ALREADY_REVIEWED')

    const review = taskStore.getReview('T-DUP')
    expect(review.feedback).toBe('第一次评价')
    expect(review.rating).toBe(3)
  })

  it('对未完成 / 已取消任务提交被拒绝', async () => {
    seedTasks([
      makeTask({ id: 'T-CANCEL', status: 'cancelled' }),
      makeTask({ id: 'T-ONGOING', status: 'ongoing' })
    ])

    const r1 = await taskStore.submitReview('T-CANCEL', { rating: 5, feedback: '评价' }, alwaysResolve)
    const r2 = await taskStore.submitReview('T-ONGOING', { rating: 5, feedback: '评价' }, alwaysResolve)

    expect(r1.success).toBe(false)
    expect(r1.error.code).toBe('NOT_COMPLETED')
    expect(r2.success).toBe(false)
    expect(r2.error.code).toBe('NOT_COMPLETED')
    expect(taskStore.getReview('T-CANCEL')).toBeNull()
    expect(taskStore.getReview('T-ONGOING')).toBeNull()
  })

  it('提交不存在的任务返回 TASK_NOT_FOUND', async () => {
    seedTasks([])
    const result = await taskStore.submitReview('NOPE', { rating: 5, feedback: '评价' }, alwaysResolve)
    expect(result.success).toBe(false)
    expect(result.error.code).toBe('TASK_NOT_FOUND')
  })

  it('参数非法时不发起请求（空反馈 / 评分越界）', async () => {
    seedTasks([makeTask({ id: 'T-INVALID' })])
    const requester = vi.fn(alwaysResolve)

    const r1 = await taskStore.submitReview('T-INVALID', { rating: 5, feedback: '' }, requester)
    const r2 = await taskStore.submitReview('T-INVALID', { rating: 9, feedback: '内容' }, requester)

    expect(r1.success).toBe(false)
    expect(r1.error.code).toBe('FEEDBACK_EMPTY')
    expect(r2.success).toBe(false)
    expect(r2.error.code).toBe('RATING_OUT_OF_RANGE')
    expect(requester).not.toHaveBeenCalled()
    expect(taskStore.getReview('T-INVALID')).toBeNull()
  })

  it('请求失败时不写入数据，返回 retryable=true，可直接重试成功', async () => {
    seedTasks([makeTask({ id: 'T-RETRY' })])

    // 第一次：模拟提交失败
    const failResult = await taskStore.submitReview(
      'T-RETRY',
      { rating: 4, feedback: '还可以，下次继续' },
      alwaysReject
    )
    expect(failResult.success).toBe(false)
    expect(failResult.retryable).toBe(true)
    expect(failResult.error.code).toBe('SUBMIT_FAILED')
    // 失败后没有任何写入，任务仍处于待评价状态
    expect(taskStore.getReview('T-RETRY')).toBeNull()
    expect(taskStore.getPendingReviews().map(t => t.id)).toContain('T-RETRY')

    // 第二次：相同参数重试成功
    const okResult = await taskStore.submitReview(
      'T-RETRY',
      { rating: 4, feedback: '还可以，下次继续' },
      alwaysResolve
    )
    expect(okResult.success).toBe(true)
    expect(taskStore.getReview('T-RETRY')).toMatchObject({ rating: 4, feedback: '还可以，下次继续' })
  })

  it('本地持久化失败时返回可重试错误且不产生内存外的部分写入', async () => {
    seedTasks([makeTask({ id: 'T-SAVE' })])
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const result = await taskStore.submitReview('T-SAVE', { rating: 5, feedback: '存不下' }, alwaysResolve)
    expect(result.success).toBe(false)
    expect(result.retryable).toBe(true)
    expect(result.error.code).toBe('SUBMIT_FAILED')

    // 存储中仍是旧数据（无 review）
    const raw = JSON.parse(localStorageMock.store['billiard_user_tasks'])
    expect(raw[0].review).toBeUndefined()
  })
})

describe('任务操作按钮与评价状态一致', () => {
  beforeEach(() => {
    resetLocalStorageMock()
  })

  it('已完成未评价：显示「评价」，不显示「查看评价」', () => {
    seedTasks([makeTask({ id: 'T1' })])
    const task = taskStore.getById('T1')
    const keys = task.actions.map(a => a.key)
    expect(keys).toContain('review')
    expect(keys).not.toContain('viewReview')
    const reviewAction = task.actions.find(a => a.key === 'review')
    expect(reviewAction.label).toBe('评价')
    expect(reviewAction.type).toBe('primary')
  })

  it('已完成已评价：按钮切换为「查看评价」，不能再次评价', () => {
    seedTasks([makeTask({ id: 'T2', review: { rating: 5, feedback: '好评', createdAt: '2026-09-10 10:00' } })])
    const task = taskStore.getById('T2')
    const keys = task.actions.map(a => a.key)
    expect(keys).toContain('viewReview')
    expect(keys).not.toContain('review')
  })

  it('未完成 / 已取消任务：不出现任何评价按钮', () => {
    seedTasks([
      makeTask({ id: 'T3', status: 'ongoing' }),
      makeTask({ id: 'T4', status: 'cancelled' })
    ])
    ;['T3', 'T4'].forEach(id => {
      const task = taskStore.getById(id)
      const keys = task.actions.map(a => a.key)
      expect(keys).not.toContain('review')
      expect(keys).not.toContain('viewReview')
      expect(task.canReview).toBe(false)
      expect(task.reviewed).toBe(false)
    })
  })

  it('各类已完成业务（预约/课程/赛事/订单）未评价时均出现评价入口', () => {
    seedTasks(['booking', 'course', 'competition', 'order'].map((type, i) =>
      makeTask({ id: 'TYPE' + i, type })
    ))
    ;['TYPE0', 'TYPE1', 'TYPE2', 'TYPE3'].forEach(id => {
      const task = taskStore.getById(id)
      expect(task.actions.map(a => a.key)).toContain('review')
    })
  })
})

describe('评价规则常量', () => {
  it('评分范围固定为 1-5，反馈上限 500 字', () => {
    expect(REVIEW_RULES.MIN_RATING).toBe(1)
    expect(REVIEW_RULES.MAX_RATING).toBe(5)
    expect(REVIEW_RULES.MAX_FEEDBACK_LENGTH).toBe(500)
  })

  it('所有错误类型均带 code 与 message', () => {
    Object.values(REVIEW_ERRORS).forEach(err => {
      expect(typeof err.code).toBe('string')
      expect(typeof err.message).toBe('string')
      expect(err.message.length).toBeGreaterThan(0)
    })
  })
})
