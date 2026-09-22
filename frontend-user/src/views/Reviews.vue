<template>
  <div class="reviews-page">
    <div class="container">
      <div class="page-header">
      <div class="header-content">
        <button class="back-btn" @click="backToTasks">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          返回任务中心
        </button>
        <h1>会员评价中心</h1>
        <p class="subtitle">对已完成的项目进行评分与反馈，查看您的评价结果</p>
      </div>
      <div class="header-actions">
        <div class="stats-summary">
        <div class="stat-item pending">
          <span class="stat-icon">📝</span>
          <div class="stat-text">
          <span class="stat-value">{{ pendingCount }}</span>
          <span class="stat-label">待评价</span>
          </div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item completed">
          <span class="stat-icon">⭐</span>
          <div class="stat-text">
          <span class="stat-value">{{ reviewedCount }}</span>
          <span class="stat-label">已评价</span>
          </div>
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
          <span v-if="pendingCount > 0" class="tab-badge">{{ pendingCount }}</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'reviewed' }"
          @click="switchTab('reviewed')"
        >
          <span class="tab-label">已评价</span>
          <span v-if="reviewedCount > 0" class="tab-badge">{{ reviewedCount }}</span>
        </button>
      </div>

      <div class="type-filters">
        <button
          class="filter-btn"
          :class="{ active: activeType === 'all' }"
          @click="activeType = 'all'"
        >全部</button>
        <button
          class="filter-btn"
          :class="{ active: activeType === 'booking' }"
          @click="activeType = 'booking'"
        >🎱 预约</button>
        <button
          class="filter-btn"
          :class="{ active: activeType === 'course' }"
          @click="activeType = 'course'"
        >📚 课程</button>
        <button
          class="filter-btn"
          :class="{ active: activeType === 'competition' }"
          @click="activeType = 'competition'"
        >🏆 赛事</button>
        <button
          class="filter-btn"
          :class="{ active: activeType === 'order' }"
          @click="activeType = 'order'"
        >🛒 订单</button>
      </div>
      </div>

      <div v-if="filteredTasks.length > 0" class="tasks-list">
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="task-card"
        :class="[task.statusType, task.type]"
      >
        <div class="task-header">
          <div class="task-type">
            <span class="type-icon">{{ task.typeIcon }}</span>
            <span class="type-name">{{ task.typeName }}</span>
          </div>
          <div v-if="activeTab === 'reviewed' && task.review" class="review-score">
            <span class="score-stars">
              <span
                v-for="(active, index) in getStarStates(task.review.rating)"
                :key="index"
                class="star"
                :class="{ active }"
              >★</span>
            </span>
            <span class="score-label">{{ getRatingLabel(task.review.rating) }}</span>
          </div>
          <div v-else class="task-status" :class="task.statusType">
            {{ task.statusText }}
          </div>
        </div>

        <div class="task-body">
          <h3 class="task-title">{{ task.title }}</h3>
          <p class="task-subtitle">{{ task.subtitle }}</p>
          <div class="task-meta">
            <span v-if="task.amount > 0" class="task-amount">
              ¥{{ task.amount.toLocaleString() }}
            </span>
            <span class="task-date">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
              </svg>
              {{ task.createdAt }}
            </span>
          </div>
          <p v-if="activeTab === 'reviewed' && task.review" class="review-preview">
            {{ task.review.feedback }}
          </p>
        </div>

        <div class="task-actions">
          <button
            v-for="action in getCardActions(task)"
            :key="action.key"
            class="action-btn"
            :class="action.type"
            @click="handleAction(task, action)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
      </div>

      <div v-else class="empty-state">
      <div class="empty-icon">{{ activeTab === 'pending' ? '📝' : '⭐' }}</div>
      <h3>暂无{{ activeTab === 'pending' ? '待评价' : '已评价' }}项目</h3>
      <p>{{ emptyHint }}</p>
      </div>
    </div>

    <!-- 评价提交弹窗 -->
    <Modal
      v-model="showFormModal"
      :title="formTitle"
      :subtitle="selectedTask?.title"
      size="large"
      :show-footer="false"
      :close-on-overlay="!submitLoading"
      @cancel="closeFormModal"
    >
      <div v-if="selectedTask" class="review-form">
        <div class="form-project">
          <span class="form-project-icon">{{ selectedTask.typeIcon }}</span>
          <div class="form-project-meta">
            <span class="form-project-type">{{ selectedTask.typeName }}</span>
            <span class="form-project-id">编号：{{ selectedTask.id }}</span>
          </div>
          <span v-if="selectedTask.amount > 0" class="form-project-amount">
            ¥{{ selectedTask.amount.toLocaleString() }}
          </span>
        </div>

        <div class="form-group">
          <label class="form-label">
            项目评分
            <span class="form-required">*</span>
          </label>
          <div class="star-picker">
            <button
              v-for="star in 5"
              :key="star"
              type="button"
              class="star-btn"
              :class="{ active: star <= formRating }"
              @click="setRating(star)"
            >★</button>
            <span v-if="formRating > 0" class="star-picker-label">
              {{ getRatingLabel(formRating) }}
            </span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">
            反馈内容
            <span class="form-required">*</span>
          </label>
          <textarea
            v-model="formFeedback"
            class="feedback-input"
            rows="5"
            :maxlength="REVIEW_RULES.MAX_FEEDBACK_LENGTH"
            placeholder="请分享您对本次项目的真实感受，例如服务态度、场地质量、课程效果等"
          ></textarea>
          <div class="feedback-footer">
            <span class="feedback-tip">
              {{ formFeedback.trim() ? '' : '反馈内容不能为空' }}
            </span>
            <span class="feedback-count" :class="{ over: isFeedbackOverLimit }">
              {{ formFeedback.length }}/{{ REVIEW_RULES.MAX_FEEDBACK_LENGTH }}
            </span>
          </div>
        </div>

        <div v-if="formError" class="form-error-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{{ formError }}</span>
        </div>

        <div class="form-actions">
          <button class="action-btn default" :disabled="submitLoading" @click="closeFormModal">
            {{ formErrorType === 'submit_failed' ? '稍后评价' : '取消' }}
          </button>
          <button class="action-btn primary" :disabled="submitLoading" @click="submitReview">
            <span v-if="submitLoading" class="btn-spinner"></span>
            <span>{{ submitButtonText }}</span>
          </button>
        </div>
      </div>
    </Modal>

    <!-- 评价结果弹窗 -->
    <Modal
      v-model="showResultModal"
      title="评价结果"
      :subtitle="resultTask?.title"
      size="medium"
      :show-cancel="false"
      confirm-text="我知道了"
      @confirm="showResultModal = false"
    >
      <div v-if="currentReview" class="review-result">
        <div class="result-project">
          <span class="result-project-icon">{{ resultTask?.typeIcon || currentReview.task?.typeIcon }}</span>
          <div class="result-project-meta">
            <span class="result-project-type">{{ resultTask?.typeName || currentReview.task?.typeName }}</span>
            <span class="result-project-id">编号：{{ currentReview.taskId }}</span>
          </div>
        </div>
        <div class="result-rating">
          <div class="result-stars">
            <span
              v-for="(active, index) in getStarStates(currentReview.rating)"
              :key="index"
              class="star"
              :class="{ active }"
            >★</span>
          </div>
          <span class="result-rating-label">{{ getRatingLabel(currentReview.rating) }}</span>
        </div>
        <div class="result-feedback">{{ currentReview.feedback }}</div>
        <div class="result-date">评价时间：{{ currentReview.createdAt }}</div>
      </div>
    </Modal>

    <!-- 任务详情弹窗 -->
    <Modal
      v-model="showDetailModal"
      :title="selectedTask?.typeName + '详情'"
      size="medium"
      :show-footer="false"
    >
      <div v-if="selectedTask" class="detail-content">
        <div class="detail-header">
          <div class="detail-icon">{{ selectedTask.typeIcon }}</div>
          <div class="detail-info">
            <h3>{{ selectedTask.title }}</h3>
            <div class="detail-status" :class="selectedTask.statusType">
              {{ selectedTask.statusText }}
            </div>
          </div>
        </div>
        <div class="detail-list">
          <div class="detail-row">
            <span class="detail-label">任务编号</span>
            <span class="detail-value">{{ selectedTask.id }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">任务类型</span>
            <span class="detail-value">{{ selectedTask.typeName }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">任务描述</span>
            <span class="detail-value">{{ selectedTask.subtitle }}</span>
          </div>
          <div v-if="selectedTask.amount > 0" class="detail-row">
            <span class="detail-label">交易金额</span>
            <span class="detail-value amount">¥{{ selectedTask.amount.toLocaleString() }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">创建时间</span>
            <span class="detail-value">{{ selectedTask.createdAt }}</span>
          </div>
        </div>
      </div>
    </Modal>

    <Modal
      v-model="showSuccessModal"
      icon="🎉"
      icon-type="success"
      title="评价提交成功"
      subtitle="感谢您的反馈，您的评价已发布"
      size="small"
      :show-cancel="false"
      confirm-text="我知道了"
      @confirm="showSuccessModal = false"
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
import { logger } from '../utils/api'
import { taskStore } from '../utils/taskStore'
import { reviewStore } from '../utils/reviewStore'
import {
  REVIEW_RULES,
  REVIEW_ERRORS,
  getRatingLabel,
  getStarStates,
  isTaskCompleted
} from '../utils/reviewRules'

export default {
  name: 'Reviews',
  components: { Modal, Toast },
  data() {
    return {
      activeTab: 'pending',
      activeType: 'all',
      selectedTask: null,
      showFormModal: false,
      showResultModal: false,
      showDetailModal: false,
      showSuccessModal: false,
      submitLoading: false,
      formRating: 0,
      formFeedback: '',
      formError: '',
      formErrorType: '',
      formTitle: '项目评价',
      currentReview: null,
      resultTask: null,
      showToast: false,
      toastType: 'success',
      toastTitle: '',
      toastMessage: '',
      refreshKey: 0
    }
  },
  computed: {
    REVIEW_RULES() {
      return REVIEW_RULES
    },
    pendingTasks() {
      this.refreshKey
      return reviewStore.getPendingTasks()
    },
    reviewedTasks() {
      this.refreshKey
      return reviewStore.getReviewedTasks()
    },
    pendingCount() {
      return this.pendingTasks.length
    },
    reviewedCount() {
      return this.reviewedTasks.length
    },
    currentTabTasks() {
      return this.activeTab === 'pending' ? this.pendingTasks : this.reviewedTasks
    },
    filteredTasks() {
      if (this.activeType === 'all') return this.currentTabTasks
      return this.currentTabTasks.filter(task => task.type === this.activeType)
    },
    isFeedbackOverLimit() {
      return this.formFeedback.length > REVIEW_RULES.MAX_FEEDBACK_LENGTH
    },
    submitButtonText() {
      if (this.submitLoading) return '提交中...'
      if (this.formErrorType === 'submit_failed') return '重新提交'
      return '提交评价'
    },
    emptyHint() {
      if (this.activeTab === 'pending') {
        return this.activeType === 'all' ? '所有已完成项目都已评价' : '该类型暂无待评价项目'
      }
      return this.activeType === 'all' ? '完成项目评价后将在此展示' : '该类型暂无已评价项目'
    }
  },
  mounted() {
    this.handleRouteQuery()
  },
  methods: {
    getRatingLabel,
    getStarStates,
    refresh() {
      this.refreshKey++
    },
    switchTab(tab) {
      this.activeTab = tab
    },
    backToTasks() {
      // 返回任务中心前与关闭弹窗遵循同一规则：保留未提交的草稿
      this.persistDraft()
      this.$router.push('/tasks')
    },
    getCardActions(_task) {
      // 列表卡片只保留评价中心相关操作，其他业务跳转不放在评价中心
      if (this.activeTab === 'pending') {
        return [
          { key: 'view', label: '查看详情', type: 'default' },
          { key: 'review', label: '去评价', type: 'primary' }
        ]
      }
      return [
        { key: 'view', label: '查看详情', type: 'default' },
        { key: 'view_review', label: '查看评价', type: 'primary' }
      ]
    },
    handleAction(task, action) {
      this.selectedTask = { ...task }
      if (action.key === 'review') {
        this.openReviewForm(task.id)
      } else if (action.key === 'view_review') {
        this.openReviewResult(task.id)
      } else if (action.key === 'view') {
        this.showDetailModal = true
      }
    },
    /**
     * 从任务中心跳转时携带 taskId/tab，按统一规则决定打开表单还是结果，
     * 未完成或已取消的记录一律不可评价
     */
    handleRouteQuery() {
      const { taskId, tab } = this.$route.query
      if (tab === 'reviewed' || tab === 'pending') {
        this.activeTab = tab
      }
      if (!taskId) return

      const task = taskStore.getById(taskId)
      if (!task) {
        this.showNotification('error', REVIEW_ERRORS.TASK_NOT_FOUND.message)
        return
      }
      if (!isTaskCompleted(task)) {
        // 未完成 / 已取消：展示状态与判定条件一致，不打开任何评价入口
        this.showNotification('warning', '无法评价', REVIEW_ERRORS.TASK_NOT_COMPLETED.message)
        return
      }

      const review = reviewStore.getByTaskId(taskId)
      if (review) {
        this.openReviewResult(taskId)
      } else if (this.activeTab !== 'reviewed') {
        this.openReviewForm(taskId)
      }
    },
    openReviewForm(taskId) {
      const task = taskStore.getById(taskId)
      // 打开入口同样执行统一判定：未完成/已取消不可评价
      if (!isTaskCompleted(task)) {
        this.showNotification('warning', '无法评价', REVIEW_ERRORS.TASK_NOT_COMPLETED.message)
        return
      }
      if (reviewStore.getByTaskId(taskId)) {
        // 已评价不允许再次进入提交表单
        this.openReviewResult(taskId)
        return
      }

      this.selectedTask = task
      const draft = reviewStore.getDraft(taskId)
      this.formRating = draft?.rating || 0
      this.formFeedback = draft?.feedback || ''
      this.formError = ''
      this.formErrorType = ''
      this.formTitle = '项目评价'
      this.showFormModal = true
      logger.info('Open review form', { taskId })
    },
    setRating(star) {
      this.formRating = star
      if (this.formErrorType && this.formErrorType !== 'submit_failed') {
        this.formError = ''
        this.formErrorType = ''
      }
    },
    closeFormModal() {
      // 返回任务中心/关闭弹窗前保存草稿，已输入内容不丢失
      if (this.selectedTask && !this.submitLoading) {
        this.persistDraft()
      }
      this.showFormModal = false
    },
    persistDraft() {
      if (!this.selectedTask) return
      if (this.formRating > 0 || this.formFeedback.trim()) {
        reviewStore.saveDraft(this.selectedTask.id, {
          rating: this.formRating,
          feedback: this.formFeedback
        })
      }
    },
    openReviewResult(taskId) {
      const review = reviewStore.getByTaskId(taskId)
      if (!review) {
        // 没有评价结果时，符合条件则回到提交表单
        this.openReviewForm(taskId)
        return
      }
      this.currentReview = review
      this.resultTask = taskStore.getById(taskId)
      this.showResultModal = true
    },
    async submitReview() {
      if (!this.selectedTask || this.submitLoading) return

      // 提交前先保存草稿，失败重试或返回任务中心后内容保持一致
      this.persistDraft()
      this.submitLoading = true
      this.formError = ''
      this.formErrorType = ''

      const result = await reviewStore.submitReview(this.selectedTask.id, {
        rating: this.formRating,
        feedback: this.formFeedback
      })

      this.submitLoading = false

      if (result.success) {
        this.showFormModal = false
        this.formRating = 0
        this.formFeedback = ''
        this.refresh()
        this.showSuccessModal = true
        logger.info('Review submitted', { taskId: this.selectedTask.id })
        return
      }

      // 所有失败分支共用同一错误码 -> 同一展示规则
      this.formError = result.error.message
      this.formErrorType = result.error.code

      if (result.error.code === 'already_reviewed') {
        // 重复提交：关闭表单并展示已有评价结果
        this.showFormModal = false
        this.refresh()
        this.openReviewResult(this.selectedTask.id)
      } else if (result.error.code === 'task_not_completed' || result.error.code === 'task_not_found') {
        // 任务状态变化（取消等）导致不可评价：关闭表单，刷新列表
        this.showFormModal = false
        this.refresh()
        this.showNotification('error', '无法评价', result.error.message)
      } else if (result.error.code === 'submit_failed') {
        // 提交失败：保留评分与反馈，按钮变为「重新提交」
        this.showNotification('error', '提交失败', result.error.message)
      }
    },
    showNotification(type, title, message = '') {
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

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 2rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.75rem;
  transition: color 0.3s;
}

.back-btn svg {
  width: 16px;
  height: 16px;
}

.back-btn:hover {
  color: var(--primary);
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

.header-actions {
  display: flex;
  align-items: center;
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

.stat-item.completed .stat-value {
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

.type-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.5rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 20px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s;
}

.filter-btn:hover {
  border-color: var(--primary);
  color: var(--text-primary);
}

.filter-btn.active {
  background: rgba(0, 217, 165, 0.15);
  border-color: rgba(0, 217, 165, 0.3);
  color: var(--primary);
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.task-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1.5rem;
  transition: all 0.3s;
}

.task-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow);
}

.task-card.success {
  border-left: 4px solid var(--primary);
}

.task-header {
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

.task-status {
  padding: 0.35rem 0.8rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.task-status.success {
  background: rgba(0, 217, 165, 0.15);
  color: var(--primary);
}

.review-score {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.score-stars {
  display: flex;
  gap: 2px;
}

.score-stars .star {
  font-size: 0.95rem;
  color: var(--text-muted);
}

.score-stars .star.active {
  color: #ffc107;
}

.score-label {
  font-size: 0.8rem;
  color: var(--primary);
  font-weight: 600;
}

.task-body {
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

.task-date {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.task-date svg {
  width: 14px;
  height: 14px;
}

.review-preview {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-actions {
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
  justify-content: center;
  gap: 0.4rem;
}

.action-btn.primary {
  background: var(--gradient-1);
  color: var(--bg-dark);
}

.action-btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--primary-glow);
}

.action-btn.default {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.action-btn.default:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--text-muted);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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

/* ===== 评价表单 ===== */

.review-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-project {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 14px;
}

.form-project-icon {
  font-size: 1.75rem;
}

.form-project-meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
}

.form-project-type {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.form-project-id {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.form-project-amount {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--primary);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.form-label {
  font-size: 0.9rem;
  font-weight: 600;
}

.form-required {
  color: #ff6b6b;
  margin-left: 2px;
}

.star-picker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.star-btn {
  background: transparent;
  border: none;
  font-size: 2rem;
  line-height: 1;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 2px;
  transition: color 0.15s, transform 0.15s;
}

.star-btn:hover {
  transform: scale(1.15);
}

.star-btn.active {
  color: #ffc107;
}

.star-picker-label {
  margin-left: 0.5rem;
  font-size: 0.9rem;
  color: #ffc107;
  font-weight: 600;
}

.feedback-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.85rem 1rem;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.3s;
}

.feedback-input:focus {
  outline: none;
  border-color: var(--primary);
}

.feedback-input::placeholder {
  color: var(--text-muted);
}

.feedback-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.feedback-tip {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.feedback-count {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.feedback-count.over {
  color: #ff6b6b;
}

.form-error-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 10px;
  color: #ff6b6b;
  font-size: 0.85rem;
}

.form-error-banner svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.form-actions .action-btn {
  flex: 1;
  padding: 0.85rem 1.25rem;
}

/* ===== 评价结果 ===== */

.review-result {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.result-project {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.result-project-icon {
  font-size: 1.75rem;
}

.result-project-meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.result-project-type {
  font-size: 0.9rem;
  font-weight: 600;
}

.result-project-id {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.result-rating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem;
  background: rgba(255, 193, 7, 0.06);
  border-radius: 14px;
}

.result-stars {
  display: flex;
  gap: 4px;
}

.result-stars .star {
  font-size: 1.75rem;
  color: var(--text-muted);
}

.result-stars .star.active {
  color: #ffc107;
}

.result-rating-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #ffc107;
}

.result-feedback {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--text-primary);
}

.result-date {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-align: right;
}

/* ===== 详情弹窗 ===== */

.detail-content {
  padding: 0.5rem;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.detail-icon {
  font-size: 3rem;
}

.detail-info h3 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
}

.detail-status {
  display: inline-block;
  padding: 0.35rem 0.8rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.detail-status.success {
  background: rgba(0, 217, 165, 0.15);
  color: var(--primary);
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

  .filter-section {
    flex-direction: column;
    align-items: flex-start;
  }

  .tab-group {
    width: 100%;
  }

  .tab-btn {
    flex: 1;
    justify-content: center;
  }

  .task-actions {
    flex-wrap: wrap;
  }

  .action-btn {
    flex: 1;
    min-width: 120px;
  }
}
</style>
