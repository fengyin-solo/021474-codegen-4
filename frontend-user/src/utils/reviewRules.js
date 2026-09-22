/**
 * 评价中心统一判定规则
 *
 * 评价提交的校验条件、列表/按钮的展示状态、星级文案均以此模块为唯一来源，
 * 任务中心（Tasks）与评价中心（Reviews）共用同一套规则，避免判定不一致。
 */

export const REVIEW_RULES = {
  /** 评分下限（含） */
  MIN_RATING: 1,
  /** 评分上限（含） */
  MAX_RATING: 5,
  /** 反馈内容最大长度 */
  MAX_FEEDBACK_LENGTH: 500
}

/**
 * 校验失败 / 提交失败的统一错误码与文案
 * 提交接口与页面提示共用，保证判定条件与展示状态一致
 */
export const REVIEW_ERRORS = Object.freeze({
  TASK_NOT_FOUND: Object.freeze({ code: 'task_not_found', message: '任务不存在或已被删除' }),
  TASK_NOT_COMPLETED: Object.freeze({ code: 'task_not_completed', message: '仅已完成的项目可以评价' }),
  ALREADY_REVIEWED: Object.freeze({ code: 'already_reviewed', message: '该项目已评价，请勿重复提交' }),
  RATING_REQUIRED: Object.freeze({ code: 'rating_required', message: '请先选择星级评分' }),
  RATING_OUT_OF_RANGE: Object.freeze({ code: 'rating_out_of_range', message: `评分必须在 ${REVIEW_RULES.MIN_RATING}-${REVIEW_RULES.MAX_RATING} 星之间` }),
  FEEDBACK_EMPTY: Object.freeze({ code: 'feedback_empty', message: '反馈内容不能为空' }),
  FEEDBACK_TOO_LONG: Object.freeze({
    code: 'feedback_too_long',
    message: `反馈内容不能超过 ${REVIEW_RULES.MAX_FEEDBACK_LENGTH} 字`
  }),
  SUBMIT_FAILED: Object.freeze({ code: 'submit_failed', message: '提交失败，请检查网络后重试' })
})

/** 星级对应文案，列表与详情共用 */
export const RATING_LABELS = Object.freeze({
  1: '非常不满意',
  2: '不满意',
  3: '一般',
  4: '满意',
  5: '非常满意'
})

/**
 * 唯一可评价条件：任务存在且状态为已完成
 * 未完成、已取消等任何其他状态均不可评价
 * @param {Object|null|undefined} task
 * @returns {boolean}
 */
export function isTaskCompleted(task) {
  return !!task && task.status === 'completed'
}

/**
 * 将评分归一化为整数；无法解析时返回 null
 * @param {*} value
 * @returns {number|null}
 */
export function normalizeRating(value) {
  if (value === '' || value === null || value === undefined) return null
  const num = Number(value)
  if (!Number.isInteger(num)) return null
  return num
}

/**
 * 校验评分
 * @param {*} rating
 * @returns {Object|null} 错误对象（REVIEW_ERRORS 之一），合法时返回 null
 */
export function validateRating(rating) {
  const normalized = normalizeRating(rating)
  // 0 表示未选择星级（选择器初始值），按「未评分」处理
  if (normalized === null || normalized === 0) return REVIEW_ERRORS.RATING_REQUIRED
  if (normalized < REVIEW_RULES.MIN_RATING || normalized > REVIEW_RULES.MAX_RATING) {
    return REVIEW_ERRORS.RATING_OUT_OF_RANGE
  }
  return null
}

/**
 * 校验反馈内容：去除首尾空白后不能为空，且不能超过最大长度
 * @param {string} feedback
 * @returns {Object|null}
 */
export function validateFeedback(feedback) {
  const text = typeof feedback === 'string' ? feedback.trim() : ''
  if (!text) return REVIEW_ERRORS.FEEDBACK_EMPTY
  if (text.length > REVIEW_RULES.MAX_FEEDBACK_LENGTH) return REVIEW_ERRORS.FEEDBACK_TOO_LONG
  return null
}

/**
 * 评价输入的完整校验（评分 + 反馈），返回第一个命中的错误
 * @param {{rating: *, feedback: *}} input
 * @returns {Object|null}
 */
export function validateReviewInput(input = {}) {
  return validateRating(input.rating) || validateFeedback(input.feedback)
}

/**
 * 获取星级文案
 * @param {number} rating
 * @returns {string}
 */
export function getRatingLabel(rating) {
  return RATING_LABELS[normalizeRating(rating)] || ''
}

/**
 * 返回长度为 5 的数组，表示每颗星是否点亮（展示状态与评分范围同源）
 * @param {number} rating
 * @returns {boolean[]}
 */
export function getStarStates(rating) {
  const normalized = normalizeRating(rating)
  // 仅合法评分（1-5）点亮星星，未评分/越界均不点亮
  const value = normalized !== null && normalized >= REVIEW_RULES.MIN_RATING && normalized <= REVIEW_RULES.MAX_RATING
    ? normalized
    : 0
  return Array.from({ length: REVIEW_RULES.MAX_RATING }, (_, i) => i < value)
}
