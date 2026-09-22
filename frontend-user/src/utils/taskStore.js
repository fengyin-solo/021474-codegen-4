/**
 * 任务中心存储管理
 * 统一管理预约、报名、订单等任务数据，使用 localStorage 持久化
 *
 * 评价规则（任务中心与评价中心共用同一套判定）：
 * - 仅 status === 'completed' 的任务可以评价；待处理、进行中、已取消均不可评价
 * - 每个任务仅允许一条评价，重复提交会被拒绝（幂等）
 * - 评分必须为 1-5 的整数；反馈去除首尾空白后不能为空，最长 500 字
 * - 提交（模拟网络请求）失败时不写入任何数据，可直接重试
 */

const STORAGE_KEY = 'billiard_user_tasks'

// ==================== 评价规则常量（唯一事实来源） ====================

export const REVIEW_RULES = {
  MIN_RATING: 1,
  MAX_RATING: 5,
  MAX_FEEDBACK_LENGTH: 500
}

export const REVIEW_ERRORS = {
  TASK_NOT_FOUND: { code: 'TASK_NOT_FOUND', message: '任务不存在或已被删除' },
  NOT_COMPLETED: { code: 'NOT_COMPLETED', message: '仅已完成的项目可以评价' },
  ALREADY_REVIEWED: { code: 'ALREADY_REVIEWED', message: '该项目已评价，请勿重复提交' },
  RATING_REQUIRED: { code: 'RATING_REQUIRED', message: '请先选择评分' },
  RATING_OUT_OF_RANGE: { code: 'RATING_OUT_OF_RANGE', message: '评分必须为 1-5 的整数' },
  FEEDBACK_EMPTY: { code: 'FEEDBACK_EMPTY', message: '反馈内容不能为空' },
  FEEDBACK_TOO_LONG: { code: 'FEEDBACK_TOO_LONG', message: '反馈内容不能超过 500 字' }
}

export const RATING_LABELS = {
  1: '非常不满意',
  2: '不满意',
  3: '一般',
  4: '满意',
  5: '非常满意'
}

const logger = {
  info: (...args) => console.log('[taskStore]', ...args),
  warn: (...args) => console.warn('[taskStore]', ...args),
  error: (...args) => console.error('[taskStore]', ...args)
}

const taskTypeConfig = {
  booking: {
    name: '球桌预约',
    icon: '🎱',
    actions: {
      pending_payment: [
        { key: 'pay', label: '继续付款', type: 'primary', route: '/tables' },
        { key: 'cancel', label: '取消', type: 'danger' }
      ],
      upcoming: [
        { key: 'view', label: '查看详情', type: 'primary' },
        { key: 'rebook', label: '再次预约', type: 'default', route: '/tables' }
      ],
      ongoing: [
        { key: 'view', label: '查看详情', type: 'primary' }
      ],
      completed: [
        { key: 'view', label: '查看结果', type: 'default' },
        { key: 'rebook', label: '再次预约', type: 'default', route: '/tables' }
      ]
    }
  },
  course: {
    name: '课程报名',
    icon: '📚',
    actions: {
      pending_payment: [
        { key: 'pay', label: '继续付款', type: 'primary', route: '/courses' },
        { key: 'cancel', label: '取消', type: 'danger' }
      ],
      upcoming: [
        { key: 'view', label: '查看详情', type: 'primary', route: '/courses' }
      ],
      ongoing: [
        { key: 'view', label: '继续学习', type: 'primary', route: '/courses' }
      ],
      completed: [
        { key: 'view', label: '查看结果', type: 'default' }
      ]
    }
  },
  competition: {
    name: '赛事报名',
    icon: '🏆',
    actions: {
      pending_payment: [
        { key: 'pay', label: '继续付款', type: 'primary', route: '/competitions' },
        { key: 'cancel', label: '取消', type: 'danger' }
      ],
      upcoming: [
        { key: 'view', label: '查看赛程', type: 'primary', route: '/competitions' }
      ],
      ongoing: [
        { key: 'view', label: '观看直播', type: 'primary', route: '/competitions' }
      ],
      completed: [
        { key: 'view', label: '查看结果', type: 'default', route: '/competitions' }
      ]
    }
  },
  order: {
    name: '商城订单',
    icon: '🛒',
    actions: {
      pending_payment: [
        { key: 'pay', label: '继续付款', type: 'primary', route: '/shop' },
        { key: 'cancel', label: '取消', type: 'danger' }
      ],
      pending_shipment: [
        { key: 'view', label: '查看订单', type: 'primary', route: '/shop' },
        { key: 'remind', label: '提醒发货', type: 'default' }
      ],
      shipped: [
        { key: 'view', label: '查看物流', type: 'primary', route: '/shop' },
        { key: 'confirm', label: '确认收货', type: 'primary' }
      ],
      completed: [
        { key: 'view', label: '查看结果', type: 'default', route: '/shop' },
        { key: 'rebuy', label: '再次购买', type: 'default', route: '/shop' }
      ]
    }
  }
}

const statusConfig = {
  pending_payment: { text: '待付款', type: 'warning' },
  upcoming: { text: '待开始', type: 'info' },
  ongoing: { text: '进行中', type: 'primary' },
  pending_shipment: { text: '待发货', type: 'warning' },
  shipped: { text: '已发货', type: 'info' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'success' }
}

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : getDefaultTasks()
  } catch (e) {
    logger.error('加载任务失败', e)
    return getDefaultTasks()
  }
}

function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    return true
  } catch (e) {
    logger.error('保存任务失败', e)
    return false
  }
}

function getDefaultTasks() {
  return [
    {
      id: 'T' + Date.now().toString() + '001',
      type: 'booking',
      title: '3号球桌 - 美式九球',
      subtitle: '2026-02-15 14:00 - 16:00',
      amount: 120,
      status: 'pending_payment',
      createdAt: formatDate(new Date(Date.now() - 86400000)),
      extra: { tableId: 3, date: '2026-02-15', time: '14:00 - 16:00' }
    },
    {
      id: 'T' + Date.now().toString() + '002',
      type: 'course',
      title: '台球入门基础课',
      subtitle: '报名成功，等待开课',
      amount: 599,
      status: 'upcoming',
      createdAt: formatDate(new Date(Date.now() - 259200000)),
      extra: { courseId: 1 }
    },
    {
      id: 'T' + Date.now().toString() + '003',
      type: 'competition',
      title: '周末九球挑战赛',
      subtitle: '比赛进行中',
      amount: 100,
      status: 'ongoing',
      createdAt: formatDate(new Date(Date.now() - 432000000)),
      extra: { competitionId: 2 }
    },
    {
      id: 'T' + Date.now().toString() + '004',
      type: 'order',
      title: 'LP专业斯诺克球杆',
      subtitle: '待发货',
      amount: 2999,
      status: 'pending_shipment',
      createdAt: formatDate(new Date(Date.now() - 172800000)),
      extra: { orderNo: 'SP' + Date.now().toString().slice(-8), productId: 1 }
    },
    {
      id: 'T' + Date.now().toString() + '005',
      type: 'course',
      title: '斯诺克进阶训练',
      subtitle: '课程已完成',
      amount: 1299,
      status: 'completed',
      createdAt: formatDate(new Date(Date.now() - 1296000000)),
      completedAt: formatDate(new Date(Date.now() - 604800000)),
      extra: { courseId: 2 }
    },
    {
      id: 'T' + Date.now().toString() + '006',
      type: 'order',
      title: '星牌比赛专用球',
      subtitle: '交易完成',
      amount: 369,
      status: 'completed',
      createdAt: formatDate(new Date(Date.now() - 2592000000)),
      completedAt: formatDate(new Date(Date.now() - 1814400000)),
      extra: { orderNo: 'SP20260120', productId: 3 },
      review: {
        rating: 5,
        feedback: '球的品质很好，走位精准，物流也很快，下次还会回购！',
        createdAt: formatDate(new Date(Date.now() - 1728000000))
      }
    }
  ]
}

function formatDate(date) {
  const d = new Date(date)
  const pad = n => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function generateTaskId() {
  return 'T' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0')
}

// ==================== 评价判定规则（任务中心 / 评价中心共用） ====================

/**
 * 判断任务是否可以评价
 * 统一规则：仅「已完成」状态可评价；未完成与已取消记录一律不可评价
 * @param {object|null|undefined} task 原始任务或增强后的任务
 * @returns {boolean}
 */
export function canReviewTask(task) {
  return !!task && task.status === 'completed'
}

/**
 * 判断任务是否已经提交过评价
 * 仅当存在合法评价（评分为 1-5 的整数）时视为已评价
 */
export function hasReviewedTask(task) {
  const rating = task && task.review && task.review.rating
  return Number.isInteger(rating) && rating >= REVIEW_RULES.MIN_RATING && rating <= REVIEW_RULES.MAX_RATING
}

/**
 * 评价提交参数校验
 * @param {object} rawTask 任务（原始/增强均可）
 * @param {{rating: *, feedback: *}} input 用户输入
 * @returns {{valid: boolean, error?: object, rating?: number, feedback?: string}}
 */
export function validateReviewInput(rawTask, input) {
  if (!rawTask) {
    return { valid: false, error: REVIEW_ERRORS.TASK_NOT_FOUND }
  }
  // 重复提交优先判定：已有评价时不再接受提交，即使参数非法也返回重复提交错误
  if (hasReviewedTask(rawTask)) {
    return { valid: false, error: REVIEW_ERRORS.ALREADY_REVIEWED }
  }
  // 未完成或已取消记录不能评价
  if (!canReviewTask(rawTask)) {
    return { valid: false, error: REVIEW_ERRORS.NOT_COMPLETED }
  }

  const rating = input && input.rating
  if (rating === undefined || rating === null || rating === '') {
    return { valid: false, error: REVIEW_ERRORS.RATING_REQUIRED }
  }
  const numericRating = Number(rating)
  if (
    !Number.isInteger(numericRating) ||
    numericRating < REVIEW_RULES.MIN_RATING ||
    numericRating > REVIEW_RULES.MAX_RATING
  ) {
    return { valid: false, error: REVIEW_ERRORS.RATING_OUT_OF_RANGE }
  }

  const feedback = typeof input.feedback === 'string' ? input.feedback.trim() : ''
  if (!feedback) {
    return { valid: false, error: REVIEW_ERRORS.FEEDBACK_EMPTY }
  }
  if (feedback.length > REVIEW_RULES.MAX_FEEDBACK_LENGTH) {
    return { valid: false, error: REVIEW_ERRORS.FEEDBACK_TOO_LONG }
  }

  return { valid: true, rating: numericRating, feedback }
}

/**
 * 构建任务在当前评价状态下的操作按钮
 * 已完成且未评价 → 去评价；已完成且已评价 → 查看评价
 */
function buildReviewActions(task) {
  if (!canReviewTask(task)) return []
  if (hasReviewedTask(task)) {
    // 不带 route：由页面决定跳转方式，任务中心会带上 taskId 跳转评价中心
    return [{ key: 'viewReview', label: '查看评价', type: 'default' }]
  }
  return [{ key: 'review', label: '评价', type: 'primary' }]
}

function enrichTask(task) {
  const typeInfo = taskTypeConfig[task.type]
  const statusInfo = statusConfig[task.status]
  const baseActions = typeInfo?.actions?.[task.status] || []
  const reviewActions = buildReviewActions(task)
  // 基础按钮在前，评价类按钮紧随其后（配置中不再硬编码评价按钮，统一由规则生成）
  const actions = [...baseActions, ...reviewActions]

  return {
    ...task,
    typeName: typeInfo?.name || task.type,
    typeIcon: typeInfo?.icon || '📋',
    statusText: statusInfo?.text || task.status,
    statusType: statusInfo?.type || 'info',
    canReview: canReviewTask(task),
    reviewed: hasReviewedTask(task),
    review: task.review || null,
    actions
  }
}

/**
 * 模拟评价提交请求
 * 默认约 20% 概率失败，用于演示「提交失败重试」；测试可注入 requester 覆盖
 */
function defaultReviewRequester() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.2) {
        reject(new Error('网络异常，请稍后重试'))
      } else {
        resolve(true)
      }
    }, 600)
  })
}

export const taskStore = {
  getAll() {
    const tasks = loadTasks()
    return tasks.map(enrichTask).sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    )
  },

  getByStatus(status) {
    const tasks = this.getAll()
    if (status === 'pending') {
      return tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
    }
    if (status === 'completed') {
      return tasks.filter(t => t.status === 'completed')
    }
    return tasks
  },

  getById(taskId) {
    const tasks = loadTasks()
    const task = tasks.find(t => t.id === taskId)
    return task ? enrichTask(task) : null
  },

  add(taskData) {
    const tasks = loadTasks()
    const newTask = {
      id: generateTaskId(),
      createdAt: formatDate(new Date()),
      ...taskData
    }
    tasks.unshift(newTask)
    saveTasks(tasks)
    logger.info('任务已添加', newTask)
    return enrichTask(newTask)
  },

  update(taskId, updates) {
    const tasks = loadTasks()
    const index = tasks.findIndex(t => t.id === taskId)
    if (index === -1) {
      logger.warn('任务不存在', taskId)
      return null
    }
    tasks[index] = { ...tasks[index], ...updates }
    saveTasks(tasks)
    logger.info('任务已更新', taskId, updates)
    return enrichTask(tasks[index])
  },

  updateStatus(taskId, newStatus) {
    const statusInfo = statusConfig[newStatus]
    if (!statusInfo) {
      logger.error('无效的状态', newStatus)
      return null
    }
    return this.update(taskId, { status: newStatus })
  },

  remove(taskId) {
    const tasks = loadTasks()
    const filtered = tasks.filter(t => t.id !== taskId)
    if (filtered.length === tasks.length) {
      logger.warn('任务不存在，无法删除', taskId)
      return false
    }
    saveTasks(filtered)
    logger.info('任务已删除', taskId)
    return true
  },

  addBookingTask(table, bookingInfo) {
    return this.add({
      type: 'booking',
      title: `${table.name} - ${table.type}`,
      subtitle: `${bookingInfo.date} ${bookingInfo.time}`,
      amount: table.price * bookingInfo.duration,
      status: 'pending_payment',
      extra: {
        tableId: table.id,
        date: bookingInfo.date,
        time: bookingInfo.time,
        duration: bookingInfo.duration,
        orderNo: bookingInfo.orderNo
      }
    })
  },

  addCourseTask(course, enrollInfo) {
    return this.add({
      type: 'course',
      title: course.name,
      subtitle: '报名成功，等待开课',
      amount: course.price,
      status: 'upcoming',
      extra: {
        courseId: course.id,
        orderNo: enrollInfo.orderNo,
        coach: course.coach,
        lessons: course.lessons
      }
    })
  },

  addCompetitionTask(competition, regInfo) {
    return this.add({
      type: 'competition',
      title: competition.name,
      subtitle: competition.status === 'upcoming' ? '等待比赛开始' : '比赛进行中',
      amount: competition.fee,
      status: competition.status === 'upcoming' ? 'upcoming' : 'ongoing',
      extra: {
        competitionId: competition.id,
        regNo: regInfo.regNo,
        playerNo: regInfo.playerNo,
        date: competition.date
      }
    })
  },

  addOrderTask(order) {
    return this.add({
      type: 'order',
      title: order.items.map(i => i.name).join('、'),
      subtitle: '已下单，待发货',
      amount: order.amount,
      status: 'pending_shipment',
      extra: {
        orderNo: order.orderNo,
        items: order.items,
        createTime: order.createTime
      }
    })
  },

  markAsPaid(taskId) {
    const task = this.getById(taskId)
    if (!task) return null

    let newStatus = 'upcoming'
    let newSubtitle = '支付成功'

    if (task.type === 'order') {
      newStatus = 'pending_shipment'
      newSubtitle = '支付成功，待发货'
    } else if (task.type === 'course') {
      newSubtitle = '支付成功，等待开课'
    } else if (task.type === 'booking') {
      newSubtitle = '支付成功，等待使用'
    }

    return this.update(taskId, { status: newStatus, subtitle: newSubtitle })
  },

  // ==================== 评价中心 ====================

  /**
   * 获取待评价任务（已完成且未评价）
   */
  getPendingReviews() {
    return this.getAll().filter(task => canReviewTask(task) && !hasReviewedTask(task))
  },

  /**
   * 获取已评价任务（最新评价在前）
   */
  getReviewedTasks() {
    return this.getAll()
      .filter(task => hasReviewedTask(task))
      .sort((a, b) => new Date(b.review.createdAt) - new Date(a.review.createdAt))
  },

  getPendingReviewCount() {
    return this.getPendingReviews().length
  },

  /**
   * 查询某条任务的评价结果；不存在时返回 null
   */
  getReview(taskId) {
    const task = this.getById(taskId)
    return task && task.review ? task.review : null
  },

  /**
   * 提交评价
   * 规则：任务存在 → 未重复提交 → 已完成 → 参数合法 → 发起请求 → 成功后才写入
   * 任何一步失败均不会产生部分写入，调用方可使用相同参数直接重试
   *
   * @param {string} taskId 任务ID
   * @param {{rating: number, feedback: string}} input 评分与反馈
   * @param {Function} [requester] 可选，注入提交请求（测试用）
   * @returns {Promise<{success: true, review: object, task: object} | {success: false, error: object, retryable: boolean}>}
   */
  async submitReview(taskId, input, requester) {
    const tasks = loadTasks()
    const rawTask = tasks.find(t => t.id === taskId)
    const result = validateReviewInput(rawTask, input)

    if (!result.valid) {
      logger.warn('评价提交被拒绝', result.error)
      // 规则类失败（重复提交、状态不符、参数非法）重试无意义
      return { success: false, error: result.error, retryable: false }
    }

    const request = typeof requester === 'function' ? requester : defaultReviewRequester
    try {
      await request(rawTask, { rating: result.rating, feedback: result.feedback })
    } catch (e) {
      logger.error('评价提交失败，可重试', e)
      return {
        success: false,
        error: { code: 'SUBMIT_FAILED', message: e.message || '提交失败，请稍后重试' },
        retryable: true
      }
    }

    // 请求成功后执行写入；写入前再次检查，防止并发重复提交
    const index = tasks.findIndex(t => t.id === taskId)
    if (index === -1) {
      return { success: false, error: REVIEW_ERRORS.TASK_NOT_FOUND, retryable: false }
    }
    if (hasReviewedTask(tasks[index])) {
      return { success: false, error: REVIEW_ERRORS.ALREADY_REVIEWED, retryable: false }
    }
    if (!canReviewTask(tasks[index])) {
      return { success: false, error: REVIEW_ERRORS.NOT_COMPLETED, retryable: false }
    }

    const review = {
      rating: result.rating,
      feedback: result.feedback,
      createdAt: formatDate(new Date())
    }
    tasks[index] = { ...tasks[index], review }

    if (!saveTasks(tasks)) {
      // 本地持久化失败（如存储已满），数据未写入，可重试
      return {
        success: false,
        error: { code: 'SUBMIT_FAILED', message: '本地保存失败，请稍后重试' },
        retryable: true
      }
    }

    logger.info('评价提交成功', { taskId, rating: review.rating })
    return { success: true, review, task: enrichTask(tasks[index]) }
  },

  getPendingCount() {
    return this.getByStatus('pending').length
  },

  getCompletedCount() {
    return this.getByStatus('completed').length
  },

  clearAll() {
    saveTasks([])
    logger.info('所有任务已清除')
  }
}

export default taskStore
