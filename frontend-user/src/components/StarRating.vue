<!--
  StarRating.vue - 星级评分组件

  功能说明：
  - 支持只读展示与交互选择两种模式
  - 悬停预览，鼠标移出后恢复当前评分
  - 评分范围固定 1-5，与 taskStore.REVIEW_RULES 保持一致

  Props:
  - modelValue: Number - 当前评分（1-5，0 表示未选择）
  - readonly: Boolean - 是否只读
  - size: String - 星星尺寸（可选，默认通过 CSS 控制）

  Events:
  - update:modelValue: 选择评分时触发
-->
<template>
  <div
    class="star-rating"
    :class="{ readonly }"
    role="radiogroup"
    aria-label="评分"
    @mouseleave="hoverRating = 0"
  >
    <button
      v-for="star in 5"
      :key="star"
      type="button"
      class="star-btn"
      :class="{ active: star <= displayRating }"
      :aria-checked="modelValue === star"
      :aria-label="star + ' 星'"
      :disabled="readonly"
      role="radio"
      @mouseenter="hoverRating = star"
      @click="select(star)"
    >
      <svg viewBox="0 0 24 24" :fill="star <= displayRating ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </button>
    <span v-if="showLabel && displayRating > 0" class="rating-label">{{ ratingText }}</span>
  </div>
</template>

<script>
import { RATING_LABELS } from '../utils/taskStore'

export default {
  name: 'StarRating',
  props: {
    modelValue: { type: Number, default: 0 },
    readonly: { type: Boolean, default: false },
    showLabel: { type: Boolean, default: true }
  },
  emits: ['update:modelValue'],
  data() {
    return {
      hoverRating: 0
    }
  },
  computed: {
    displayRating() {
      return this.hoverRating || this.modelValue || 0
    },
    ratingText() {
      return RATING_LABELS[this.displayRating] || ''
    }
  },
  methods: {
    select(star) {
      if (this.readonly) return
      this.$emit('update:modelValue', star)
    }
  }
}
</script>

<style scoped>
.star-rating {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.star-btn {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: var(--text-muted);
  transition: color 0.2s, transform 0.15s;
  line-height: 0;
}

.star-btn svg {
  width: 32px;
  height: 32px;
}

.star-btn.active {
  color: #ffc107;
}

.star-btn:hover:not(:disabled) {
  transform: scale(1.15);
}

.star-btn:disabled {
  cursor: default;
}

.star-rating.readonly .star-btn.active {
  color: #ffc107;
}

.rating-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #ffc107;
  margin-left: 0.25rem;
}
</style>
