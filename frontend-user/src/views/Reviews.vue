<template>
  <div class="reviews-page">
    <div class="container">
      <!-- 返回任务中心 -->
      <button class="back-bar" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <span>返回任务中心</span>
      </button>

      <div class="page-header">
        <div class="header-content">
          <h1>评价中心</h1>
          <p class="subtitle">为已完成的项目打分并留下您的反馈</p>
        </div>
        <div class="stats-summary">
          <div class="stat-item pending">
            <span class="stat-icon">📝</span>
            <div class="stat-text">
              <span class="stat-value">{{ pendingReviewTasks.length }}</span>
              <span class="stat-label">待评价</span>
            </div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item done">
            <span class="stat-icon">⭐</span>
            <div class="stat-text">
              <span class="stat-value">{{ reviewedTasks.length }}</span>
              <span class="stat-label">已评价</span>
            </div>
          </div>
        </div>
      </div>

      <div class="filter-section">
        <div class="tab-group">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'pending' }"
            @click="switchTab('pending')"
          >
            <span class="tab-label">待评价</span>
            <span v-if="pendingReviewTasks.length > 0" class="tab-badge">{{ pendingReviewTasks.length }}</span>
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'reviewed' }"
            @click="switchTab('reviewed')"
          >
            <span class="tab-label">我的评价</span>
            <span v-if="reviewedTasks.length > 0" class="tab-badge">{{ reviewedTasks.length }}</span>
          </button>
        </div>
      </div>

      <!-- 待评价列表 -->
      <div v-if="activeTab === 'pending'">
        <div v-if="pendingReviewTasks.length > 0" class="reviews-list">
          <div
            v-for="task in pendingReviewTasks"
            :key="task.id"
            class="review-card"
          >
            <div class="review-card-header">
              <div class="task-type">
                <span class="type-icon">{{ task.typeIcon }}</span>
                <span class="type-name">{{ task.typeName }}</span>
              </div>
              <div class="task-status success">{{ task.statusText }}</div>
            </div>
            <div class="review-card-body">
              <h3 class="task-title">{{ task.title }}</h3>
              <p class="task-subtitle">{{ task.subtitle }}</p>
              <div class="task-meta">
                <span v-if="task.amount > 0" class="task-amount">¥{{ task.amount.toLocaleString() }}</span>
                <span v-if="task.completedAt" class="task-date">完成时间：{{ task.completedAt }}</span>
              </div>
            </div>
            <div class="review-card-actions">
              <button class="action-btn default" @click="openViewTaskDetail(task)">查看详情</button>
              <button class="action-btn primary" @click="openReviewModal(task)">
                <span class="btn-star">⭐</span> 立即评价
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-icon">🎉</div>
          <h3>暂无待评价项目</h3>
          <p>已完成且未评价的项目会显示在这里</p>
          <button class="empty-action" @click="goBack">返回任务中心</button>
        </div>
      </div>

      <!-- 我的评价列表 -->
      <div v-else>
        <div v-if="reviewedTasks.length > 0" class="reviews-list">
          <div
            v-for="task in reviewedTasks"
            :key="task.id"
            class="review-card reviewed"
          >
            <div class="review-card-header">
              <div class="task-type">
                <span class="type-icon">{{ task.typeIcon }}</span>
                <span class="type-name">{{ task.typeName }}</span>
              </div>
              <div class="reviewed-badge">✓ 已评价</div>
            </div>
            <div class="review-card-body">
              <h3 class="task-title">{{ task.title }}</h3>
              <div class="review-summary">
                <StarRating :model-value="task.review.rating" readonly />
              </div>
              <p class="review-feedback">{{ task.review.feedback }}</p>
              <p class="review-time">评价时间：{{ task.review.createdAt }}</p>
            </div>
            <div class="review-card-actions">
              <button class="action-btn default" @click="openViewReviewModal(task)">查看评价结果</button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-icon">⭐</div>
          <h3>暂无评价记录</h3>
          <p>完成项目评价后，可在这里查看您的评价结果</p>
        </div>
      </div>
    </div>

    <!-- 评价提交弹窗 -->
    <Modal
      v-model="showReviewModal"
      icon="⭐"
      icon-type="info"
      title="项目评价"
      size="medium"
      :show-cancel="!submitting"
      cancel-text="取消"
      confirm-text="提交评价"
      :confirm-disabled="!canSubmit || submitting"
      :loading="submitting"
      :close-on-overlay="!submitting"
      @confirm="submitReview"
      @cancel="onReviewModalCancel"
    >
      <div v-if="selectedTask" class="review-form">
        <div class="form-target">
          <span class="target-icon">{{ selectedTask.typeIcon }}</span>
          <div class="target-info">
            <h4>{{ selectedTask.title }}</h4>
            <span class="target-sub">{{ selectedTask.typeName }} · {{ selectedTask.statusText }}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">
            项目评分 <span class="required">*</span>
          </label>
          <div class="form-stars">
            <StarRating v-model="formRating" />
          </div>
          <p v-if="ratingError" class="form-error">{{ ratingError }}</p>
        </div>

        <div class="form-group">
          <label class="form-label">
            反馈内容 <span class="required">*</span>
          </label>
          <textarea
            v-model="formFeedback"
            class="form-textarea"
            :maxlength="feedbackMaxLength"
            rows="5"
            placeholder="请分享您的体验，例如服务态度、场地质量、课程效果等（不能为空）"
          ></textarea>
          <div class="form-footer-row">
            <p v-if="feedbackError" class="form-error">{{ feedbackError }}</p>
            <span class="char-count" :class="{ over: formFeedback.trim().length > feedbackMaxLength }">
              {{ formFeedback.trim().length }}/{{ feedbackMaxLength }}
            </span>
          </div>
        </div>

        <div v-if="submitError" class="submit-error">
          <span class="submit-error-icon">⚠️</span>
          <span class="submit-error-text">{{ submitError }}</span>
        </div>
      </div>
    </Modal>

    <!-- 评价结果弹窗 -->
    <Modal
      v-model="showViewReviewModal"
      icon="📋"
      icon-type="info"
      :title="viewReviewTitle"
      size="medium"
      :show-cancel="false"
      confirm-text="我知道了"
      @confirm="showViewReviewModal = false"
    >
      <div v-if="viewReviewTask" class="view-review">
        <template v-if="viewReviewTask.review">
          <div class="form-target">
            <span class="target-icon">{{ viewReviewTask.typeIcon }}</span>
            <div class="target-info">
              <h4>{{ viewReviewTask.title }}</h4>
              <span class="target-sub">{{ viewReviewTask.typeName }}</span>
            </div>
          </div>
          <div class="result-row">
            <span class="result-label">我的评分</span>
            <StarRating :model-value="viewReviewTask.review.rating" readonly />
          </div>
          <div class="result-row column">
            <span class="result-label">我的反馈</span>
            <p class="result-feedback">{{ viewReviewTask.review.feedback }}</p>
          </div>
          <div class="result-row">
            <span class="result-label">评价时间</span>
            <span class="result-value">{{ viewReviewTask.review.createdAt }}</span>
          </div>
        </template>
        <div v-else class="detail-list">
          <div class="detail-row">
            <span class="detail-label">任务编号</span>
            <span class="detail-value">{{ viewReviewTask.id }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">任务类型</span>
            <span class="detail-value">{{ viewReviewTask.typeName }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">任务描述</span>
            <span class="detail-value">{{ viewReviewTask.subtitle }}</span>
          </div>
          <div v-if="viewReviewTask.amount > 0" class="detail-row">
            <span class="detail-label">交易金额</span>
            <span class="detail-value amount">¥{{ viewReviewTask.amount.toLocaleString() }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">状态</span>
            <span class="detail-value">{{ viewReviewTask.statusText }}</span>
          </div>
        </div>
      </div>
    </Modal>

    <!-- 提交成功弹窗 -->
    <Modal
      v-model="showSuccessModal"
      icon="🎉"
      icon-type="success"
      title="评价提交成功"
      subtitle="感谢您的反馈，您的评价已发布"
      size="small"
      :show-cancel="false"
      confirm-text="我知道了"
      @confirm="onSuccessConfirm"
    />

    <Toast
      v-model="showToast"
      :type="toastType"
      :title="toastTitle"
      :message="toastMessage"
    />
  </div>
</template>

<script>
import Modal from '../components/Modal.vue'
import Toast from '../components/Toast.vue'
import StarRating from '../components/StarRating.vue'
import { logger } from '../utils/api'
import {
  taskStore,
  REVIEW_RULES,
  REVIEW_ERRORS
} from '../utils/taskStore'

export default {
  name: 'Reviews',
  components: { Modal, Toast, StarRating },
  data() {
    return {
      activeTab: 'pending',
      refreshKey: 0,
      // 评价表单
      selectedTask: null,
      showReviewModal: false,
      formRating: 0,
      formFeedback: '',
      ratingError: '',
      feedbackError: '',
      submitError: '',
      submitting: false,
      // 查看评价结果 / 详情
      viewReviewTask: null,
      showViewReviewModal: false,
      viewReviewTitle: '评价结果',
      // 成功提示
      showSuccessModal: false,
      // Toast
      showToast: false,
      toastType: 'success',
      toastTitle: '',
      toastMessage: ''
    }
  },
  computed: {
    feedbackMaxLength() {
      return REVIEW_RULES.MAX_FEEDBACK_LENGTH
    },
    allTasks() {
      // 依赖 refreshKey，提交成功后刷新列表与按钮状态
      this.refreshKey
      return taskStore.getAll()
    },
    pendingReviewTasks() {
      this.refreshKey
      return taskStore.getPendingReviews()
    },
    reviewedTasks() {
      this.refreshKey
      return taskStore.getReviewedTasks()
    },
    canSubmit() {
      // 与 taskStore 校验规则保持一致：1-5 星 + 非空反馈
      return (
        Number.isInteger(this.formRating) &&
        this.formRating >= REVIEW_RULES.MIN_RATING &&
        this.formRating <= REVIEW_RULES.MAX_RATING &&
        this.formFeedback.trim().length > 0 &&
        this.formFeedback.trim().length <= REVIEW_RULES.MAX_FEEDBACK_LENGTH
      )
    }
  },
  watch: {
    '$route.query': {
      handler(query) {
        this.handleRouteQuery(query)
      }
    }
  },
  mounted() {
    this.handleRouteQuery(this.$route.query)
  },
  methods: {
    refresh() {
      this.refreshKey++
    },
    switchTab(tab) {
      this.activeTab = tab
    },
    goBack() {
      this.$router.push('/tasks')
    },
    /**
     * 处理来自任务中心的跳转参数
     * ?taskId=xxx&action=review|viewReview
     * 判定条件与列表完全一致：不存在 / 未完成 / 已取消 → 提示；重复提交 → 直接展示评价结果
     */
    handleRouteQuery(query) {
      if (!query || !query.taskId) return
      const taskId = query.taskId
      const action = query.action === 'viewReview' ? 'viewReview' : 'review'
      const task = taskStore.getById(taskId)

      if (!task) {
        this.showNotification('error', REVIEW_ERRORS.TASK_NOT_FOUND.message, '任务可能已被删除')
        this.clearRouteQuery()
        return
      }
      if (!task.canReview) {
        // 未完成或已取消记录不能评价
        this.showNotification('warning', '无法评价', REVIEW_ERRORS.NOT_COMPLETED.message)
        this.clearRouteQuery()
        return
      }
      if (action === 'viewReview' || task.reviewed) {
        // 已评价（含重复提交评价的情况）：展示既有评价结果，而不是再次打开提交表单
        this.activeTab = 'reviewed'
        this.openViewReviewModal(task)
        this.clearRouteQuery()
        return
      }
      this.activeTab = 'pending'
      this.openReviewModal(task)
      this.clearRouteQuery()
    },
    clearRouteQuery() {
      if (this.$route.query.taskId) {
        this.$router.replace({ path: '/reviews' }).catch(() => {})
      }
    },
    resetForm() {
      this.formRating = 0
      this.formFeedback = ''
      this.ratingError = ''
      this.feedbackError = ''
      this.submitError = ''
      this.submitting = false
    },
    openReviewModal(task) {
      // 入口处再次执行同一规则判定，确保状态始终一致
      if (!task || !task.canReview) {
        this.showNotification('warning', '无法评价', REVIEW_ERRORS.NOT_COMPLETED.message)
        return
      }
      if (task.reviewed) {
        this.showNotification('info', '已评价', REVIEW_ERRORS.ALREADY_REVIEWED.message)
        this.openViewReviewModal(task)
        return
      }
      this.selectedTask = task
      this.resetForm()
      this.showReviewModal = true
    },
    onReviewModalCancel() {
      if (this.submitting) return
      this.showReviewModal = false
    },
    openViewReviewModal(task) {
      this.viewReviewTask = task
      this.viewReviewTitle = task.reviewed ? '评价结果' : task.typeName + '详情'
      this.showViewReviewModal = true
    },
    openViewTaskDetail(task) {
      this.viewReviewTask = task
      this.viewReviewTitle = task.typeName + '详情'
      this.showViewReviewModal = true
    },
    validateForm() {
      let valid = true
      this.ratingError = ''
      this.feedbackError = ''

      if (!Number.isInteger(this.formRating) || this.formRating < REVIEW_RULES.MIN_RATING) {
        this.ratingError = REVIEW_ERRORS.RATING_REQUIRED.message
        valid = false
      } else if (this.formRating > REVIEW_RULES.MAX_RATING) {
        this.ratingError = REVIEW_ERRORS.RATING_OUT_OF_RANGE.message
        valid = false
      }

      const feedback = this.formFeedback.trim()
      if (!feedback) {
        this.feedbackError = REVIEW_ERRORS.FEEDBACK_EMPTY.message
        valid = false
      } else if (feedback.length > REVIEW_RULES.MAX_FEEDBACK_LENGTH) {
        this.feedbackError = REVIEW_ERRORS.FEEDBACK_TOO_LONG.message
        valid = false
      }
      return valid
    },
    async submitReview() {
      if (this.submitting || !this.selectedTask) return

      // 提交失败重试时保留已填内容，仅重新校验当前输入
      if (!this.validateForm()) {
        this.submitError = ''
        return
      }

      this.submitting = true
      this.submitError = ''

      const result = await taskStore.submitReview(this.selectedTask.id, {
        rating: this.formRating,
        feedback: this.formFeedback
      })

      this.submitting = false

      if (result.success) {
        this.showReviewModal = false
        this.selectedTask = result.task
        this.refresh()
        // 提交成功后展示状态切换为「已评价」，返回任务中心时按钮同样变为「查看评价」
        this.activeTab = 'reviewed'
        this.showSuccessModal = true
        logger.info('Review submitted', { taskId: result.task.id, rating: result.review.rating })
        return
      }

      // 失败：可重试错误保留表单并允许再次点击提交；规则类错误给出对应提示
      if (result.retryable) {
        this.submitError = result.error.message + '，请点击「提交评价」重试'
        this.showNotification('error', '提交失败', result.error.message)
      } else if (result.error.code === 'ALREADY_REVIEWED') {
        this.showReviewModal = false
        this.refresh()
        this.showNotification('info', '已评价', result.error.message)
        const latest = taskStore.getById(this.selectedTask.id)
        if (latest) this.openViewReviewModal(latest)
      } else {
        this.submitError = result.error.message
        this.showNotification('error', '无法提交', result.error.message)
      }
    },
    onSuccessConfirm() {
      this.showSuccessModal = false
      if (this.selectedTask) {
        this.openViewReviewModal(this.selectedTask)
      }
    },
    showNotification(type, title, message) {
      this.toastType = type
      this.toastTitle = title
      this.toastMessage = message
      this.showToast = true
    }
  }
}
</script>

<style scoped>
.reviews-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 3rem 4rem;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
}

.back-bar {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.4rem 0.6rem;
  margin-bottom: 1.25rem;
  border-radius: 8px;
  transition: all 0.2s;
}

.back-bar svg {
  width: 16px;
  height: 16px;
}

.back-bar:hover {
  color: var(--primary);
  background: rgba(0, 217, 165, 0.08);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 2rem;
}

.header-content h1 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.stats-summary {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1rem 1.5rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stat-icon {
  font-size: 1.5rem;
}

.stat-text {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.stat-item.pending .stat-value {
  color: #ffc107;
}

.stat-item.done .stat-value {
  color: var(--primary);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: var(--border);
}

.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.tab-group {
  display: flex;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 4px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--gradient-1);
  color: var(--bg-dark);
}

.tab-badge {
  background: rgba(0, 0, 0, 0.2);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.review-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1.5rem;
  transition: all 0.3s;
  border-left: 4px solid #ffc107;
}

.review-card.reviewed {
  border-left-color: var(--primary);
}

.review-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow);
}

.review-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.task-type {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.type-icon {
  font-size: 1.25rem;
}

.type-name {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.task-status,
.reviewed-badge {
  padding: 0.35rem 0.8rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.task-status.success {
  background: rgba(0, 217, 165, 0.15);
  color: var(--primary);
}

.reviewed-badge {
  background: rgba(0, 217, 165, 0.15);
  color: var(--primary);
}

.review-card-body {
  margin-bottom: 1rem;
}

.task-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.task-subtitle {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.task-amount {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--primary);
}

.task-date,
.review-time {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.review-summary {
  margin: 0.5rem 0 0.75rem;
}

.review-feedback {
  font-size: 0.92rem;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.85rem 1rem;
  line-height: 1.6;
}

.review-card-actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.action-btn {
  padding: 0.6rem 1.25rem;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.action-btn.primary {
  background: var(--gradient-1);
  color: var(--bg-dark);
}

.action-btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--primary-glow);
}

.action-btn.default {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.action-btn.default:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--text-muted);
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.empty-action {
  margin-top: 1.25rem;
  padding: 0.7rem 1.5rem;
  border-radius: 12px;
  background: var(--gradient-1);
  color: var(--bg-dark);
  border: none;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.empty-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--primary-glow);
}

/* 表单弹窗 */
.review-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  text-align: left;
}

.form-target {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.85rem 1rem;
}

.target-icon {
  font-size: 1.75rem;
}

.target-info h4 {
  font-size: 1rem;
  margin-bottom: 2px;
}

.target-sub {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.form-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.6rem;
}

.required {
  color: #ff6b6b;
}

.form-stars {
  padding: 0.25rem 0;
}

.form-textarea {
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.85rem 1rem;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.form-textarea::placeholder {
  color: var(--text-muted);
}

.form-footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.4rem;
  gap: 1rem;
}

.char-count {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-left: auto;
}

.char-count.over {
  color: #ff6b6b;
}

.form-error {
  color: #ff6b6b;
  font-size: 0.8rem;
  margin: 0;
}

.submit-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: #ff8a8a;
  border-radius: 10px;
  padding: 0.7rem 1rem;
  font-size: 0.85rem;
}

/* 结果弹窗 */
.view-review {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  text-align: left;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.result-row.column {
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
}

.result-label {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.result-value {
  font-weight: 500;
}

.result-feedback {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.85rem 1rem;
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.detail-label {
  color: var(--text-secondary);
}

.detail-value {
  font-weight: 500;
}

.detail-value.amount {
  color: var(--primary);
  font-weight: 600;
}

@media (max-width: 768px) {
  .reviews-page {
    padding: 1rem 1.5rem 3rem;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .tab-group {
    width: 100%;
  }

  .tab-btn {
    flex: 1;
    justify-content: center;
  }

  .review-card-actions {
    flex-wrap: wrap;
  }

  .action-btn {
    flex: 1;
    justify-content: center;
    min-width: 120px;
  }
}
</style>
