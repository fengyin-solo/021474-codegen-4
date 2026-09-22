/**
 * 评价中心存储模块单元测试
 *
 * 测试范围：
 * - 待评价/已评价列表与计数（仅已完成任务参与）
 * - 提交评价：成功、未完成/已取消拒绝、重复提交拒绝
 * - 空反馈、评分越界拒绝
 * - 提交失败与重试（失败后数据不变，重试成功）
 * - 草稿保存与清理
 * - decorateTasks 按钮装饰规则与判定条件一致
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reviewStore } from '../utils/reviewStore'
import { REVIEW_ERRORS } from '../utils/reviewRules'

// ==================== Mock 设置 ====================

const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn(key => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn(key => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    _store: store
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock, configurable: true })

// ==================== 测试夹具 ====================

function seedTasks(tasks) {
  localStorage.setItem('billiard_user_tasks', JSON.stringify(tasks))
}

const base = (overrides = {}) => ({
  id: 'T1',
  type: 'order',
  title: 'LP专业斯诺克球杆',
  subtitle: '已完成',
  amount: 2999,
  status: 'completed',
  createdAt: '2026-09-01 10:00',
  ...overrides
})

describe('Review Store', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('可评价列表', () => {
    it('已完成且未评价的任务进入待评价列表', () => {
      seedTasks([base({ id: 'DONE' }), base({ id: 'PAY', status: 'pending_payment' })])
      const pending = reviewStore.getPendingTasks()
      expect(pending.map(t => t.id)).toEqual(['DONE'])
    })

    it('已取消的任务不能评价，不出现在待评价列表', () => {
      seedTasks([base({ id: 'CANCELLED', status: 'cancelled' })])
      expect(reviewStore.getPendingTasks()).toHaveLength(0)
      expect(reviewStore.getReviewedTasks()).toHaveLength(0)
    })

    it('未完成的任何状态都不能评价', () => {
      seedTasks([
        base({ id: 'S1', status: 'ongoing' }),
        base({ id: 'S2', status: 'shipped' }),
        base({ id: 'S3', status: 'upcoming' })
      ])
      expect(reviewStore.getPendingTasks()).toHaveLength(0)
    })

    it('计数与列表一致', () => {
      seedTasks([
        base({ id: 'A', createdAt: '2026-09-01 10:00' }),
        base({ id: 'B', createdAt: '2026-09-02 10:00' })
      ])
      expect(reviewStore.getPendingCount()).toBe(2)
      expect(reviewStore.getReviewedCount()).toBe(0)
    })
  })

  describe('submitReview - 成功与状态判定', () => {
    beforeEach(() => {
      seedTasks([base({ id: 'OK' })])
    })

    it('合法评价提交成功并持久化', async () => {
      const result = await reviewStore.submitReview('OK', { rating: 5, feedback: '非常满意' })
      expect(result.success).toBe(true)
      expect(result.review.rating).toBe(5)
      expect(result.review.feedback).toBe('非常满意')
      expect(result.review.taskId).toBe('OK')
      expect(result.review.task).toMatchObject({ id: 'OK', title: expect.any(String) })

      const saved = reviewStore.getByTaskId('OK')
      expect(saved).not.toBeNull()
      expect(reviewStore.getPendingCount()).toBe(0)
      expect(reviewStore.getReviewedCount()).toBe(1)
    })

    it('反馈首尾空白会被裁剪', async () => {
      const result = await reviewStore.submitReview('OK', { rating: 4, feedback: '  不错  ' })
      expect(result.success).toBe(true)
      expect(result.review.feedback).toBe('不错')
    })

    it('未完成任务提交返回 task_not_completed', async () => {
      seedTasks([base({ id: 'ONGOING', status: 'ongoing' })])
      const result = await reviewStore.submitReview('ONGOING', { rating: 5, feedback: '好评' })
      expect(result).toEqual({ success: false, error: REVIEW_ERRORS.TASK_NOT_COMPLETED })
      expect(reviewStore.getReviewedCount()).toBe(0)
    })

    it('已取消任务提交返回 task_not_completed', async () => {
      seedTasks([base({ id: 'CANCELLED', status: 'cancelled' })])
      const result = await reviewStore.submitReview('CANCELLED', { rating: 5, feedback: '好评' })
      expect(result.success).toBe(false)
      expect(result.error.code).toBe('task_not_completed')
    })

    it('任务不存在返回 task_not_found', async () => {
      const result = await reviewStore.submitReview('MISSING', { rating: 5, feedback: '好评' })
      expect(result).toEqual({ success: false, error: REVIEW_ERRORS.TASK_NOT_FOUND })
    })
  })

  describe('submitReview - 重复提交', () => {
    beforeEach(() => {
      seedTasks([base({ id: 'DUP' })])
    })

    it('同一任务不能重复评价', async () => {
      const first = await reviewStore.submitReview('DUP', { rating: 5, feedback: '第一次评价' })
      expect(first.success).toBe(true)

      const second = await reviewStore.submitReview('DUP', { rating: 1, feedback: '重复评价' })
      expect(second.success).toBe(false)
      expect(second.error).toEqual(REVIEW_ERRORS.ALREADY_REVIEWED)

      // 数据保持第一次评价，不产生重复记录
      expect(reviewStore.getReviewedCount()).toBe(1)
      expect(reviewStore.getByTaskId('DUP').feedback).toBe('第一次评价')
    })
  })

  describe('submitReview - 输入校验', () => {
    beforeEach(() => {
      seedTasks([base({ id: 'VAL' })])
    })

    it('空反馈拒绝且不保存评价', async () => {
      const result = await reviewStore.submitReview('VAL', { rating: 4, feedback: '   ' })
      expect(result.success).toBe(false)
      expect(result.error).toEqual(REVIEW_ERRORS.FEEDBACK_EMPTY)
      expect(reviewStore.getByTaskId('VAL')).toBeNull()
    })

    it.each([6, -1, 10])('评分越界 %s 拒绝', async (rating) => {
      const result = await reviewStore.submitReview('VAL', { rating, feedback: '反馈' })
      expect(result.success).toBe(false)
      expect(result.error).toEqual(REVIEW_ERRORS.RATING_OUT_OF_RANGE)
    })

    it('未选评分拒绝', async () => {
      const result = await reviewStore.submitReview('VAL', { rating: 0, feedback: '反馈' })
      expect(result.error).toEqual(REVIEW_ERRORS.RATING_REQUIRED)
    })

    it('反馈超长拒绝', async () => {
      const result = await reviewStore.submitReview('VAL', {
        rating: 3,
        feedback: '长'.repeat(501)
      })
      expect(result.success).toBe(false)
      expect(result.error).toEqual(REVIEW_ERRORS.FEEDBACK_TOO_LONG)
    })
  })

  describe('submitReview - 失败重试', () => {
    beforeEach(() => {
      seedTasks([base({ id: 'RETRY' })])
    })

    it('模拟提交失败时返回 submit_failed 且不产生评价', async () => {
      reviewStore.simulateNextSubmitFailure()
      const result = await reviewStore.submitReview('RETRY', { rating: 5, feedback: '好评' })
      expect(result.success).toBe(false)
      expect(result.error).toEqual(REVIEW_ERRORS.SUBMIT_FAILED)
      expect(reviewStore.getByTaskId('RETRY')).toBeNull()
      expect(reviewStore.getPendingTasks().map(t => t.id)).toContain('RETRY')
    })

    it('失败后使用相同输入重试可以成功', async () => {
      reviewStore.simulateNextSubmitFailure()
      const input = { rating: 4, feedback: '失败后重试' }

      const failed = await reviewStore.submitReview('RETRY', input)
      expect(failed.success).toBe(false)

      const retried = await reviewStore.submitReview('RETRY', input)
      expect(retried.success).toBe(true)
      expect(reviewStore.getByTaskId('RETRY').feedback).toBe('失败后重试')
    })

    it('失败标记只生效一次', async () => {
      reviewStore.simulateNextSubmitFailure()
      expect((await reviewStore.submitReview('RETRY', { rating: 5, feedback: 'a' })).success).toBe(false)
      expect((await reviewStore.submitReview('RETRY', { rating: 5, feedback: 'b' })).success).toBe(true)
      // 第三次不会再次失败
      reviewStore.saveDraft('OTHER', {})
    })
  })

  describe('草稿', () => {
    it('保存并读取草稿', () => {
      reviewStore.saveDraft('D1', { rating: 3, feedback: '写到一半' })
      expect(reviewStore.getDraft('D1')).toMatchObject({ rating: 3, feedback: '写到一半' })
    })

    it('提交成功后草稿被清理', async () => {
      seedTasks([base({ id: 'DRAFT' })])
      reviewStore.saveDraft('DRAFT', { rating: 5, feedback: '草稿内容' })
      await reviewStore.submitReview('DRAFT', { rating: 5, feedback: '草稿内容' })
      expect(reviewStore.getDraft('DRAFT')).toBeNull()
    })

    it('提交失败后草稿保留，供重试使用', async () => {
      seedTasks([base({ id: 'DRAFT2' })])
      reviewStore.saveDraft('DRAFT2', { rating: 2, feedback: '网络差时的草稿' })
      reviewStore.simulateNextSubmitFailure()
      await reviewStore.submitReview('DRAFT2', { rating: 2, feedback: '网络差时的草稿' })
      expect(reviewStore.getDraft('DRAFT2')).not.toBeNull()
      expect(reviewStore.getDraft('DRAFT2').feedback).toBe('网络差时的草稿')
    })
  })

  describe('已评价列表', () => {
    it('已评价任务带评价信息并按评价时间倒序', async () => {
      seedTasks([
        base({ id: 'FIRST', createdAt: '2026-09-01 09:00' }),
        base({ id: 'SECOND', createdAt: '2026-09-02 09:00' })
      ])
      await reviewStore.submitReview('FIRST', { rating: 5, feedback: '好评1' })
      await new Promise(r => setTimeout(r, 1100))
      await reviewStore.submitReview('SECOND', { rating: 3, feedback: '中评' })

      const reviewed = reviewStore.getReviewedTasks()
      expect(reviewed).toHaveLength(2)
      expect(reviewed[0].id).toBe('SECOND')
      expect(reviewed[0].review.rating).toBe(3)
      expect(reviewed[1].review.feedback).toBe('好评1')
    })

    it('评价后任务变为已取消，不再出现在已评价列表', async () => {
      seedTasks([base({ id: 'CHANGE' })])
      await reviewStore.submitReview('CHANGE', { rating: 5, feedback: '好评' })
      expect(reviewStore.getReviewedTasks()).toHaveLength(1)

      seedTasks([base({ id: 'CHANGE', status: 'cancelled' })])
      expect(reviewStore.getReviewedTasks()).toHaveLength(0)
      // 原始评价记录仍可通过任务ID查询
      expect(reviewStore.getByTaskId('CHANGE')).not.toBeNull()
    })
  })

  describe('decorateTasks - 展示状态与判定一致', () => {
    it('已完成未评价：出现「去评价」主按钮', () => {
      seedTasks([base({ id: 'NEW' })])
      const [task] = reviewStore.decorateTasks()
      const keys = task.actions.map(a => a.key)
      expect(keys).toContain('review')
      expect(keys).not.toContain('view_review')
      const reviewAction = task.actions.find(a => a.key === 'review')
      expect(reviewAction.type).toBe('primary')
      expect(reviewAction.route).toBe('/reviews')
      expect(reviewAction.tab).toBe('pending')
      expect(task.reviewed).toBe(false)
    })

    it('已完成已评价：出现「查看评价」而非「去评价」', async () => {
      seedTasks([base({ id: 'DONE' })])
      await reviewStore.submitReview('DONE', { rating: 5, feedback: '好评' })
      const [task] = reviewStore.decorateTasks()
      const keys = task.actions.map(a => a.key)
      expect(keys).toContain('view_review')
      expect(keys).not.toContain('review')
      expect(task.actions.find(a => a.key === 'view_review').tab).toBe('reviewed')
      expect(task.reviewed).toBe(true)
    })

    it('未完成/已取消：不附加任何评价入口', () => {
      seedTasks([
        base({ id: 'P', status: 'pending_payment' }),
        base({ id: 'C', status: 'cancelled' })
      ])
      const tasks = reviewStore.decorateTasks()
      for (const task of tasks) {
        expect(task.actions.map(a => a.key).some(k => k === 'review' || k === 'view_review')).toBe(false)
        expect(task.reviewed).toBe(false)
      }
    })

    it('装饰不修改任务原有的非评价按钮', () => {
      seedTasks([
        {
          ...base({ id: 'O' }),
          type: 'order'
        }
      ])
      const [task] = reviewStore.decorateTasks()
      expect(task.actions.map(a => a.key)).toEqual(expect.arrayContaining(['view', 'rebuy', 'review']))
    })
  })

  describe('clearAll', () => {
    it('清空全部评价与草稿', async () => {
      seedTasks([base({ id: 'X' })])
      await reviewStore.submitReview('X', { rating: 5, feedback: '好评' })
      reviewStore.saveDraft('Y', { rating: 1, feedback: '' })
      reviewStore.clearAll()
      expect(reviewStore.getAll()).toHaveLength(0)
      expect(reviewStore.getDraft('Y')).toBeNull()
    })
  })
})
