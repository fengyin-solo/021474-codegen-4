/**
 * 评价中心存储管理
 *
 * 统一管理会员对已完成项目的评价数据，使用 localStorage 持久化。
 * 可评价判定、输入校验、错误码均来自 reviewRules，任务中心与评价中心共用，
 * 保证「重复提交、空反馈、评分越界、未完成/已取消不可评价」等规则一致。
 */

import { taskStore } from './taskStore'
import {
  REVIEW_RULES,
  REVIEW_ERRORS,
  validateReviewInput,
  isTaskCompleted
} from './reviewRules'

const STORAGE_KEY = 'billiard_user_reviews'
const DRAFT_KEY = 'billiard_user_review_drafts'
const FAIL_NEXT_KEY = 'billiard_user_review_fail_next'

const logger = {
  info: (...args) => console.log('[reviewStore]', ...args),
  warn: (...args) => console.warn('[reviewStore]', ...args),
  error: (...args) => console.error('[reviewStore]', ...args)
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function readJSON(key, fallback) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch (e) {
    logger.error('读取本地数据失败', key, e)
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    logger.error('写入本地数据失败', key, e)
    return false
  }
}

function loadReviews() {
  const list = readJSON(STORAGE_KEY, [])
  return Array.isArray(list) ? list : []
}

function loadDrafts() {
  const map = readJSON(DRAFT_KEY, {})
  return map && typeof map === 'object' ? map : {}
}

function formatDate(date) {
  const d = new Date(date)
  const pad = n => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 截取任务快照，评价后即使任务数据变化，仍可查看评价结果
 */
function takeSnapshot(task) {
  return {
    id: task.id,
    type: task.type,
    typeName: task.typeName,
    typeIcon: task.typeIcon,
    title: task.title,
    subtitle: task.subtitle,
    amount: task.amount,
    createdAt: task.createdAt
  }
}

/**
 * 根据是否已评价调整任务操作按钮
 * - 未完成 / 已取消：不附加任何评价入口（沿用原按钮）
 * - 已完成未评价：主按钮「去评价」
 * - 已完成已评价：主按钮「查看评价」
 */
function decorateTask(task, reviewedIdSet) {
  const actions = (task.actions || []).filter(
    action => action.key !== 'review' && action.key !== 'view_review'
  )

  if (isTaskCompleted(task)) {
    const reviewed = reviewedIdSet.has(task.id)
    const reviewAction = reviewed
      ? { key: 'view_review', label: '查看评价', type: 'primary', route: '/reviews', tab: 'reviewed' }
      : { key: 'review', label: '去评价', type: 'primary', route: '/reviews', tab: 'pending' }

    const viewIndex = actions.findIndex(action => action.key === 'view')
    actions.splice(viewIndex === -1 ? 0 : viewIndex + 1, 0, reviewAction)
  }

  return { ...task, actions, reviewed: reviewedIdSet.has(task.id) && task.status === 'completed' }
}

export const reviewStore = {
  /**
   * 获取全部评价（按评价时间倒序）
   * @returns {Array}
   */
  getAll() {
    return loadReviews()
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },

  /**
   * 获取某个任务的评价结果，未评价返回 null
   * @param {string} taskId
   * @returns {Object|null}
   */
  getByTaskId(taskId) {
    return loadReviews().find(review => review.taskId === taskId) || null
  },

  /**
   * 已评价任务ID集合
   * @returns {Set<string>}
   */
  getReviewedIdSet() {
    return new Set(loadReviews().map(review => review.taskId))
  },

  /**
   * 待评价任务：仅已完成且未评价
   * @returns {Array}
   */
  getPendingTasks() {
    const reviewedIds = this.getReviewedIdSet()
    return taskStore
      .getAll()
      .filter(task => isTaskCompleted(task) && !reviewedIds.has(task.id))
      .map(task => decorateTask(task, reviewedIds))
  },

  /**
   * 已评价列表：已完成且存在评价记录；任务被取消等不再是已完成状态时不展示
   * @returns {Array}
   */
  getReviewedTasks() {
    const reviewMap = new Map(loadReviews().map(review => [review.taskId, review]))
    const reviewedIds = this.getReviewedIdSet()
    return taskStore
      .getAll()
      .filter(task => isTaskCompleted(task) && reviewMap.has(task.id))
      .map(task => ({
        ...decorateTask(task, reviewedIds),
        review: reviewMap.get(task.id)
      }))
      .sort((a, b) => new Date(b.review.createdAt) - new Date(a.review.createdAt))
  },

  getPendingCount() {
    return this.getPendingTasks().length
  },

  getReviewedCount() {
    return this.getAll().length
  },

  /**
   * 按统一规则装饰任务列表（任务中心使用）
   * @param {Array} [tasks] - 默认取全部任务
   * @returns {Array}
   */
  decorateTasks(tasks) {
    const reviewedIds = this.getReviewedIdSet()
    const list = tasks || taskStore.getAll()
    return list.map(task => decorateTask(task, reviewedIds))
  },

  /**
   * 读取未提交的评价草稿（提交失败/返回任务中心后内容不丢失）
   */
  getDraft(taskId) {
    return loadDrafts()[taskId] || null
  },

  saveDraft(taskId, draft) {
    const drafts = loadDrafts()
    drafts[taskId] = {
      rating: draft.rating ?? null,
      feedback: draft.feedback ?? '',
      savedAt: formatDate(new Date())
    }
    writeJSON(DRAFT_KEY, drafts)
  },

  clearDraft(taskId) {
    const drafts = loadDrafts()
    if (Object.prototype.hasOwnProperty.call(drafts, taskId)) {
      delete drafts[taskId]
      writeJSON(DRAFT_KEY, drafts)
    }
  },

  /**
   * 提交评价
   *
   * 判定顺序（与页面展示规则一致）：
   * 1. 任务存在；2. 任务已完成（未完成/已取消拒绝）；3. 未重复评价；
   * 4. 评分合法（1-5 整数）；5. 反馈非空且不超长；6. 模拟网络提交
   *
   * @param {string} taskId
   * @param {{rating: *, feedback: *}} input
   * @returns {Promise<{success: boolean, review?: Object, error?: Object}>}
   */
  async submitReview(taskId, input = {}) {
    const task = taskStore.getById(taskId)
    if (!task) {
      logger.warn('评价失败：任务不存在', taskId)
      return { success: false, error: REVIEW_ERRORS.TASK_NOT_FOUND }
    }

    if (!isTaskCompleted(task)) {
      logger.warn('评价失败：任务未完成或已取消', { taskId, status: task.status })
      return { success: false, error: REVIEW_ERRORS.TASK_NOT_COMPLETED }
    }

    if (this.getByTaskId(taskId)) {
      logger.warn('评价失败：重复提交', taskId)
      return { success: false, error: REVIEW_ERRORS.ALREADY_REVIEWED }
    }

    const validationError = validateReviewInput(input)
    if (validationError) {
      logger.warn('评价失败：输入不合法', { taskId, error: validationError.code })
      return { success: false, error: validationError }
    }

    await delay(500)

    if (this._consumeFailureFlag()) {
      logger.warn('评价提交失败：模拟网络异常', taskId)
      return { success: false, error: REVIEW_ERRORS.SUBMIT_FAILED }
    }

    const rating = Number(input.rating)
    const review = {
      taskId,
      rating,
      feedback: String(input.feedback).trim(),
      createdAt: formatDate(new Date()),
      task: takeSnapshot(task)
    }

    const reviews = loadReviews()
    // 并发/重复请求兜底，保证不产生重复评价
    if (reviews.some(item => item.taskId === taskId)) {
      logger.warn('评价失败：并发重复提交', taskId)
      return { success: false, error: REVIEW_ERRORS.ALREADY_REVIEWED }
    }
    reviews.push(review)

    if (!writeJSON(STORAGE_KEY, reviews)) {
      return { success: false, error: REVIEW_ERRORS.SUBMIT_FAILED }
    }

    this.clearDraft(taskId)
    logger.info('评价提交成功', { taskId, rating })
    return { success: true, review }
  },

  /**
   * 设置下一次提交模拟网络失败（用于失败重试场景与测试）
   */
  simulateNextSubmitFailure() {
    try {
      localStorage.setItem(FAIL_NEXT_KEY, '1')
    } catch (e) {
      logger.error('设置失败标记异常', e)
    }
  },

  _consumeFailureFlag() {
    try {
      const flag = localStorage.getItem(FAIL_NEXT_KEY)
      if (flag === '1') {
        localStorage.removeItem(FAIL_NEXT_KEY)
        return true
      }
    } catch (e) {
      logger.error('读取失败标记异常', e)
    }
    return false
  },

  clearAll() {
    writeJSON(STORAGE_KEY, [])
    writeJSON(DRAFT_KEY, {})
    logger.info('所有评价已清除')
  }
}

export { REVIEW_RULES }
export default reviewStore
