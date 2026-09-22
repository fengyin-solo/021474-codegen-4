/**
 * 评价中心规则模块单元测试
 *
 * 测试范围：
 * - 可评价状态判定（仅已完成可评价，未完成/已取消不可评价）
 * - 评分范围校验（1-5，整数，必填）
 * - 反馈内容校验（空反馈拒绝、长度上限）
 * - 重复提交的错误码
 * - 星级展示状态与评分范围同源
 */

import { describe, it, expect } from 'vitest'
import {
  REVIEW_RULES,
  REVIEW_ERRORS,
  isTaskCompleted,
  normalizeRating,
  validateRating,
  validateFeedback,
  validateReviewInput,
  getRatingLabel,
  getStarStates
} from '../utils/reviewRules'

describe('Review Rules', () => {
  describe('isTaskCompleted - 唯一可评价条件', () => {
    it('仅 completed 状态可评价', () => {
      expect(isTaskCompleted({ status: 'completed' })).toBe(true)
    })

    it.each([
      'pending_payment',
      'upcoming',
      'ongoing',
      'pending_shipment',
      'shipped',
      'cancelled'
    ])('状态 %s 不可评价', (status) => {
      expect(isTaskCompleted({ status })).toBe(false)
    })

    it('任务为空时不可评价', () => {
      expect(isTaskCompleted(null)).toBe(false)
      expect(isTaskCompleted(undefined)).toBe(false)
    })
  })

  describe('validateRating - 评分范围', () => {
    it('1-5 的整数评分合法', () => {
      for (const r of [1, 2, 3, 4, 5]) {
        expect(validateRating(r)).toBeNull()
      }
    })

    it('未选择评分时返回 rating_required', () => {
      expect(validateRating(0)).toEqual(REVIEW_ERRORS.RATING_REQUIRED)
      expect(validateRating(null)).toEqual(REVIEW_ERRORS.RATING_REQUIRED)
      expect(validateRating(undefined)).toEqual(REVIEW_ERRORS.RATING_REQUIRED)
      expect(validateRating('')).toEqual(REVIEW_ERRORS.RATING_REQUIRED)
    })

    it('越界评分返回 rating_out_of_range', () => {
      expect(validateRating(-1)).toEqual(REVIEW_ERRORS.RATING_OUT_OF_RANGE)
      expect(validateRating(6)).toEqual(REVIEW_ERRORS.RATING_OUT_OF_RANGE)
      expect(validateRating(100)).toEqual(REVIEW_ERRORS.RATING_OUT_OF_RANGE)
    })

    it('非整数评分拒绝', () => {
      expect(validateRating(3.5)).toEqual(REVIEW_ERRORS.RATING_REQUIRED)
      expect(validateRating('abc')).toEqual(REVIEW_ERRORS.RATING_REQUIRED)
    })

    it('数字字符串形式的合法评分归一化后合法', () => {
      expect(validateRating('5')).toBeNull()
    })
  })

  describe('validateFeedback - 反馈内容', () => {
    it('正常反馈合法', () => {
      expect(validateFeedback('教练很专业，收获很大')).toBeNull()
    })

    it('空字符串拒绝', () => {
      expect(validateFeedback('')).toEqual(REVIEW_ERRORS.FEEDBACK_EMPTY)
    })

    it('纯空白反馈拒绝', () => {
      expect(validateFeedback('   ')).toEqual(REVIEW_ERRORS.FEEDBACK_EMPTY)
      expect(validateFeedback('\n\t  ')).toEqual(REVIEW_ERRORS.FEEDBACK_EMPTY)
    })

    it('非字符串拒绝', () => {
      expect(validateFeedback(null)).toEqual(REVIEW_ERRORS.FEEDBACK_EMPTY)
      expect(validateFeedback(undefined)).toEqual(REVIEW_ERRORS.FEEDBACK_EMPTY)
    })

    it('超过最大长度拒绝', () => {
      const longText = '好'.repeat(REVIEW_RULES.MAX_FEEDBACK_LENGTH + 1)
      expect(validateFeedback(longText)).toEqual(REVIEW_ERRORS.FEEDBACK_TOO_LONG)
    })

    it('恰好最大长度合法（首尾空白不计入）', () => {
      const text = '好'.repeat(REVIEW_RULES.MAX_FEEDBACK_LENGTH)
      expect(validateFeedback(text)).toBeNull()
      expect(validateFeedback(`  ${text}  `)).toBeNull()
    })
  })

  describe('validateReviewInput - 组合校验', () => {
    it('合法输入通过', () => {
      expect(validateReviewInput({ rating: 5, feedback: '非常满意' })).toBeNull()
    })

    it('优先返回评分错误', () => {
      expect(validateReviewInput({ rating: 6, feedback: '' }).code).toBe('rating_out_of_range')
      expect(validateReviewInput({ rating: 0, feedback: '有反馈但没评分' }).code).toBe('rating_required')
    })

    it('评分合法但反馈为空时返回空反馈错误', () => {
      expect(validateReviewInput({ rating: 4, feedback: '   ' })).toEqual(
        REVIEW_ERRORS.FEEDBACK_EMPTY
      )
    })
  })

  describe('星级展示', () => {
    it('normalizeRating 正确归一化', () => {
      expect(normalizeRating('3')).toBe(3)
      expect(normalizeRating(3.0)).toBe(3)
      expect(normalizeRating(3.5)).toBeNull()
    })

    it('getStarStates 展示状态与评分一致', () => {
      expect(getStarStates(0)).toEqual([false, false, false, false, false])
      expect(getStarStates(1)).toEqual([true, false, false, false, false])
      expect(getStarStates(5)).toEqual([true, true, true, true, true])
    })

    it('越界评分展示为空星，避免 UI 点亮异常', () => {
      expect(getStarStates(6)).toEqual([false, false, false, false, false])
    })

    it('getRatingLabel 返回对应文案', () => {
      expect(getRatingLabel(5)).toBe('非常满意')
      expect(getRatingLabel(1)).toBe('非常不满意')
    })
  })
})
