/**
 * 评价中心页面（Reviews.vue）组件测试
 *
 * 测试范围（展示状态与判定规则与 store/rules 同源）：
 * - 待评价 / 已评价列表展示与计数
 * - 评分与反馈提交成功
 * - 未选评分、空反馈阻止提交并展示统一错误
 * - 提交失败后保留输入，点击「重新提交」成功
 * - 未完成/已取消记录无评价入口
 * - 返回任务中心跳转 /tasks
 * - 已评价记录展示评价结果
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Reviews from '../views/Reviews.vue'
import { reviewStore } from '../utils/reviewStore'

// ==================== Mock 设置 ====================

const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn(key => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn(key => { delete store[key] }),
    clear: vi.fn(() => { store = {} })
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock, configurable: true })

const seedTasks = tasks => {
  localStorage.setItem('billiard_user_tasks', JSON.stringify(tasks))
}

const completedTask = (overrides = {}) => ({
  id: 'T1',
  type: 'course',
  title: '台球入门基础课',
  subtitle: '课程已完成',
  amount: 599,
  status: 'completed',
  createdAt: '2026-09-01 10:00',
  ...overrides
})

// 将 Teleport 内容渲染在组件内，便于查询并避免 body 清理问题
function mountPage(query = {}) {
  const push = vi.fn()
  const wrapper = mount(Reviews, {
    global: {
      stubs: { teleport: true },
      mocks: {
        $router: { push },
        $route: { query }
      }
    }
  })
  return { wrapper, push }
}

async function openReviewForm(wrapper) {
  await wrapper.findAll('.action-btn').find(b => b.text() === '去评价').trigger('click')
  await flushPromises()
}

async function setStarsAndFeedback(wrapper, starIndex, feedback) {
  await wrapper.findAll('.star-btn').at(starIndex).trigger('click')
  await wrapper.find('.feedback-input').setValue(feedback)
}

function submitButton(wrapper) {
  return wrapper.findAll('.form-actions .action-btn').find(b => b.text().includes('提交') || b.text().includes('重新提交'))
}

// 提交包含 500ms 模拟网络延迟，等待其完成
async function clickSubmit(wrapper) {
  await submitButton(wrapper).trigger('click')
  await new Promise(r => setTimeout(r, 550))
  await flushPromises()
}

describe('Reviews Page', () => {
  let wrapper

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
  })

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('待评价任务出现在待评价列表，已取消/未完成不出现', () => {
    seedTasks([
      completedTask({ id: 'DONE' }),
      completedTask({ id: 'CANCELLED', status: 'cancelled' }),
      completedTask({ id: 'ONGOING', status: 'ongoing' })
    ])
    wrapper = mountPage().wrapper

    expect(wrapper.findAll('.task-card')).toHaveLength(1)
    expect(wrapper.text()).toContain('台球入门基础课')
    expect(wrapper.find('.stat-item.pending .stat-value').text()).toBe('1')
  })

  it('点击「去评价」打开表单弹窗，展示项目信息', async () => {
    seedTasks([completedTask({ id: 'FORM' })])
    wrapper = mountPage().wrapper

    await openReviewForm(wrapper)

    expect(wrapper.text()).toContain('项目评价')
    expect(wrapper.text()).toContain('台球入门基础课')
    expect(wrapper.find('.star-picker').exists()).toBe(true)
    expect(wrapper.find('.feedback-input').exists()).toBe(true)
  })

  it('未选评分、空反馈提交时展示统一错误，且不产生评价', async () => {
    seedTasks([completedTask({ id: 'EMPTY' })])
    wrapper = mountPage().wrapper

    await openReviewForm(wrapper)

    // 初始 0 分即未选择评分
    await submitButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('.form-error-banner').text()).toContain('请先选择星级评分')
    expect(reviewStore.getByTaskId('EMPTY')).toBeNull()

    // 选择评分但反馈为空 -> 切换到空反馈错误
    await setStarsAndFeedback(wrapper, 4, '')
    await submitButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('.form-error-banner').text()).toContain('反馈内容不能为空')
    expect(reviewStore.getByTaskId('EMPTY')).toBeNull()

    // 纯空白反馈同样拒绝
    await wrapper.find('.feedback-input').setValue('   ')
    await submitButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('.form-error-banner').text()).toContain('反馈内容不能为空')
  })

  it('星级选择器仅提供 1-5，界面无法提交越界评分', async () => {
    seedTasks([completedTask({ id: 'RANGE' })])
    wrapper = mountPage().wrapper

    await openReviewForm(wrapper)
    expect(wrapper.findAll('.star-btn')).toHaveLength(5)

    await setStarsAndFeedback(wrapper, 0, '体验很好')
    await clickSubmit(wrapper)

    expect(reviewStore.getByTaskId('RANGE')).not.toBeNull()
    expect(reviewStore.getByTaskId('RANGE').rating).toBe(1)
  })

  it('合法评价提交成功，进入已评价列表并展示星级与反馈', async () => {
    seedTasks([completedTask({ id: 'SUBMIT' })])
    wrapper = mountPage().wrapper

    await openReviewForm(wrapper)
    await setStarsAndFeedback(wrapper, 4, '教练非常专业')
    await clickSubmit(wrapper)

    // 成功弹窗
    expect(wrapper.text()).toContain('评价提交成功')
    expect(reviewStore.getByTaskId('SUBMIT').rating).toBe(5)

    // 待评价归零，已评价为 1
    expect(wrapper.find('.stat-item.pending .stat-value').text()).toBe('0')
    expect(wrapper.find('.stat-item.completed .stat-value').text()).toBe('1')

    // 切换到已评价页签
    await wrapper.findAll('.tab-btn').find(b => b.text().includes('已评价')).trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.task-card')).toHaveLength(1)
    expect(wrapper.text()).toContain('教练非常专业')
    expect(wrapper.text()).toContain('非常满意')
  })

  it('提交失败后保留评分与反馈，点击重新提交成功', async () => {
    seedTasks([completedTask({ id: 'RETRY' })])
    reviewStore.simulateNextSubmitFailure()
    wrapper = mountPage().wrapper

    await openReviewForm(wrapper)
    await setStarsAndFeedback(wrapper, 3, '失败后保留的反馈')
    await clickSubmit(wrapper)

    // 失败：弹窗保留，按钮变为重新提交，输入仍在
    expect(reviewStore.getByTaskId('RETRY')).toBeNull()
    const retryButton = submitButton(wrapper)
    expect(retryButton.text()).toContain('重新提交')
    expect(wrapper.find('.feedback-input').element.value).toBe('失败后保留的反馈')
    expect(wrapper.findAll('.star-btn.active')).toHaveLength(4)
    expect(wrapper.find('.form-error-banner').text()).toContain('提交失败')

    await retryButton.trigger('click')
    await new Promise(r => setTimeout(r, 550))
    await flushPromises()

    expect(reviewStore.getByTaskId('RETRY')).not.toBeNull()
    expect(reviewStore.getByTaskId('RETRY').rating).toBe(4)
    expect(reviewStore.getByTaskId('RETRY').feedback).toBe('失败后保留的反馈')
  })

  it('重复提交（已有评价）时表单转为展示已有评价结果', async () => {
    seedTasks([completedTask({ id: 'DUP' })])
    await reviewStore.submitReview('DUP', { rating: 5, feedback: '已有评价' })

    wrapper = mountPage({ taskId: 'DUP', tab: 'pending' }).wrapper
    await flushPromises()

    expect(wrapper.text()).toContain('评价结果')
    expect(wrapper.text()).toContain('已有评价')
    expect(wrapper.find('.feedback-input').exists()).toBe(false)
  })

  it('从任务中心带 taskId 进入：已完成自动打开表单，已取消提示不可评价', async () => {
    seedTasks([
      completedTask({ id: 'OPEN' }),
      completedTask({ id: 'CANCELLED', status: 'cancelled' })
    ])

    const ok = mountPage({ taskId: 'OPEN', tab: 'pending' })
    wrapper = ok.wrapper
    await flushPromises()
    expect(wrapper.text()).toContain('项目评价')
    wrapper.unmount()
    wrapper = null

    const bad = mountPage({ taskId: 'CANCELLED', tab: 'pending' })
    wrapper = bad.wrapper
    await flushPromises()
    expect(wrapper.text()).toContain('仅已完成的项目可以评价')
    expect(wrapper.find('.feedback-input').exists()).toBe(false)
  })

  it('「查看评价」展示评价结果弹窗', async () => {
    seedTasks([completedTask({ id: 'VIEW' })])
    await reviewStore.submitReview('VIEW', { rating: 2, feedback: '有待改进' })

    wrapper = mountPage().wrapper
    await wrapper.findAll('.tab-btn').find(b => b.text().includes('已评价')).trigger('click')
    await flushPromises()

    await wrapper.findAll('.action-btn').find(b => b.text() === '查看评价').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('评价结果')
    expect(wrapper.text()).toContain('有待改进')
    expect(wrapper.text()).toContain('不满意')
  })

  it('返回任务中心按钮跳转到 /tasks', async () => {
    seedTasks([completedTask({ id: 'BACK' })])
    const mounted = mountPage()
    wrapper = mounted.wrapper

    await wrapper.find('.back-btn').trigger('click')
    expect(mounted.push).toHaveBeenCalledWith('/tasks')
  })

  it('未完成任务的卡片在评价中心完全不展示（无评价入口）', () => {
    seedTasks([
      completedTask({ id: 'P1', status: 'pending_payment' }),
      completedTask({ id: 'P2', status: 'shipped' }),
      completedTask({ id: 'P3', status: 'cancelled' })
    ])
    wrapper = mountPage().wrapper

    expect(wrapper.findAll('.task-card')).toHaveLength(0)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })
})
