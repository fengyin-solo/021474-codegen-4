/**
 * 评价中心页面（Reviews.vue）组件测试
 *
 * 验证页面状态与 taskStore 规则保持一致：
 * - 仅已完成未评价项目出现在「待评价」；已取消/未完成不出现
 * - 提交按钮在未评分或空反馈时禁用；失败可重试且保留输入
 * - 提交成功后状态切换到「我的评价」并展示评分与反馈
 * - 返回任务中心跳转 /tasks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import Reviews from '../views/Reviews.vue'
import { taskStore } from '../utils/taskStore'

// Modal 通过 Teleport 挂载到 body，每个测试后自动卸载组件以清理残留弹窗
enableAutoUnmount(afterEach)

// ==================== Mock localStorage ====================

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

function seedTasks(tasks) {
  localStorageMock.clear()
  localStorageMock.store['billiard_user_tasks'] = JSON.stringify(tasks)
}

function makeTask(overrides = {}) {
  return {
    id: 'T' + Math.random().toString(36).slice(2, 8),
    type: 'order',
    title: '测试项目',
    subtitle: '描述',
    amount: 100,
    status: 'completed',
    createdAt: '2026-09-01 10:00',
    ...overrides
  }
}

function mountPage(query = {}) {
  const router = {
    push: vi.fn(),
    replace: vi.fn(() => Promise.resolve())
  }
  // 挂载到 body，使 Teleport 弹窗与页面内容均可在 document 中查询
  const wrapper = mount(Reviews, {
    attachTo: document.body,
    global: {
      mocks: {
        $router: router,
        $route: { query }
      }
    }
  })
  return { wrapper, router }
}

describe('Reviews Page', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.restoreAllMocks()
  })

  it('待评价列表只包含已完成且未评价的项目', () => {
    seedTasks([
      makeTask({ id: 'T1', title: '可评价项目' }),
      makeTask({ id: 'T2', status: 'cancelled', title: '已取消项目' }),
      makeTask({ id: 'T3', status: 'ongoing', title: '进行中项目' }),
      makeTask({
        id: 'T4',
        title: '已评价项目',
        review: { rating: 5, feedback: '好评', createdAt: '2026-09-10 10:00' }
      })
    ])

    const { wrapper } = mountPage()
    const titles = wrapper.findAll('.task-title').map(n => n.text())

    expect(titles).toContain('可评价项目')
    expect(titles).not.toContain('已取消项目')
    expect(titles).not.toContain('进行中项目')
    expect(titles).not.toContain('已评价项目')
  })

  it('点击「返回任务中心」跳转 /tasks', async () => {
    seedTasks([])
    const { wrapper, router } = mountPage()

    await wrapper.find('.back-bar').trigger('click')
    expect(router.push).toHaveBeenCalledWith('/tasks')
  })

  it('未评分或反馈为空时提交按钮禁用，填写完整后可提交', async () => {
    seedTasks([makeTask({ id: 'T1', title: '待评价项目' })])
    const { wrapper } = mountPage()

    await wrapper.find('.action-btn.primary').trigger('click')
    await wrapper.vm.$nextTick()

    const confirmBtn = document.querySelector('.modal-footer .btn-confirm')
    expect(confirmBtn.disabled).toBe(true)

    // 选择 5 星
    const stars = document.querySelectorAll('.star-rating:not(.readonly) .star-btn')
    stars[4].dispatchEvent(new window.Event('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(confirmBtn.disabled).toBe(true) // 仍缺反馈

    // 填入反馈
    wrapper.vm.formFeedback = '体验很棒'
    await wrapper.vm.$nextTick()
    expect(confirmBtn.disabled).toBe(false)
  })

  it('提交失败时保留输入并展示重试提示，再次提交成功', async () => {
    seedTasks([makeTask({ id: 'T1', title: '待评价项目' })])
    const { wrapper } = mountPage()

    const submitSpy = vi
      .spyOn(taskStore, 'submitReview')
      .mockResolvedValueOnce({
        success: false,
        retryable: true,
        error: { code: 'SUBMIT_FAILED', message: '网络异常，请稍后重试' }
      })
      .mockResolvedValueOnce({
        success: true,
        review: { rating: 5, feedback: '体验很棒', createdAt: '2026-09-20 10:00' },
        task: { ...taskStore.getById('T1'), reviewed: true }
      })

    await wrapper.find('.action-btn.primary').trigger('click')
    await wrapper.vm.$nextTick()

    wrapper.vm.formRating = 5
    wrapper.vm.formFeedback = '体验很棒'
    await wrapper.vm.$nextTick()

    const confirmBtn = document.querySelector('.modal-footer .btn-confirm')
    confirmBtn.dispatchEvent(new window.Event('click', { bubbles: true }))
    await flushPromises()
    await wrapper.vm.$nextTick()

    // 失败：弹窗仍在、输入保留、显示重试提示
    expect(wrapper.vm.showReviewModal).toBe(true)
    expect(wrapper.vm.formRating).toBe(5)
    expect(wrapper.vm.formFeedback).toBe('体验很棒')
    expect(wrapper.vm.submitError).toContain('重试')

    // 重试成功
    confirmBtn.dispatchEvent(new window.Event('click', { bubbles: true }))
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(submitSpy).toHaveBeenCalledTimes(2)
    expect(wrapper.vm.showReviewModal).toBe(false)
    expect(wrapper.vm.showSuccessModal).toBe(true)
    expect(wrapper.vm.activeTab).toBe('reviewed')

    submitSpy.mockRestore()
  })

  it('我的评价标签展示评分与反馈内容', async () => {
    seedTasks([
      makeTask({
        id: 'T1',
        title: '已评价项目',
        review: { rating: 4, feedback: '整体不错，值得推荐', createdAt: '2026-09-10 10:00' }
      })
    ])
    const { wrapper } = mountPage()

    const tabs = wrapper.findAll('.tab-btn')
    await tabs[1].trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.review-feedback').text()).toBe('整体不错，值得推荐')
    expect(wrapper.find('.reviewed-badge').exists()).toBe(true)
    // 只读星级：4 颗激活
    const activeStars = document.querySelectorAll('.review-card.reviewed .star-rating.readonly .star-btn.active')
    expect(activeStars.length).toBe(4)
  })

  it('通过 taskId 跳转且任务已评价时，直接展示评价结果而非提交表单', async () => {
    seedTasks([
      makeTask({
        id: 'T1',
        review: { rating: 5, feedback: '已有的好评', createdAt: '2026-09-10 10:00' }
      })
    ])
    const { wrapper } = mountPage({ taskId: 'T1', action: 'review' })
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(wrapper.vm.activeTab).toBe('reviewed')
    expect(wrapper.vm.showViewReviewModal).toBe(true)
    expect(wrapper.vm.showReviewModal).toBe(false)
  })

  it('通过 taskId 评价未完成项目时给出拦截提示且不打开表单', async () => {
    seedTasks([makeTask({ id: 'T1', status: 'cancelled' })])
    const { wrapper } = mountPage({ taskId: 'T1', action: 'review' })
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(wrapper.vm.showReviewModal).toBe(false)
    expect(wrapper.vm.showToast).toBe(true)
    expect(wrapper.vm.toastType).toBe('warning')
  })
})
