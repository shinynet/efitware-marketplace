<script setup lang="ts">
import { computed } from 'vue'
import type { CompactSummary } from './compactSummary'
const { summary } = defineProps<{ summary: CompactSummary }>()
const bars = computed(() => {
  const values = summary.bars?.values ?? []
  if (values.length < 2) return []
  const high = Math.max(...values), low = Math.min(0, ...values)
  const step = 350 / values.length
  return values.map((value, index) => {
    const height = high === low ? 4 : Math.max(4, (value - low) / (high - low) * 44)
    return { x: index * step + step * 0.15, width: step * 0.7, y: 48 - height, height }
  })
})
</script>
<template>
  <section
    class="compact flex flex-col gap-3"
    :aria-label="summary.title"
  >
    <div class="flex flex-col gap-1">
      <p class="text-[11px] font-semibold uppercase tracking-[.12em] text-gold-ink">
        {{ summary.eyebrow }}
      </p>
      <h1 class="font-serif text-2xl leading-tight">
        {{ summary.title }}
      </h1>
    </div>
    <dl class="grid grid-cols-3 gap-3 rounded bg-surface px-3.5 py-3">
      <div
        v-for="fact in summary.facts"
        :key="fact.label"
        class="flex min-w-0 flex-col gap-0.5"
      >
        <dt class="text-[11px] text-muted">
          {{ fact.label }}
        </dt>
        <dd class="line-clamp-2 break-words text-[15px] font-medium leading-snug">
          {{ fact.value }}
        </dd>
      </div>
    </dl>
    <figure
      v-if="bars.length"
      class="flex flex-col gap-1.5"
    >
      <svg
        viewBox="0 0 350 48"
        preserveAspectRatio="none"
        role="img"
        :aria-label="summary.bars!.label"
        class="block h-12 w-full text-olive"
      >
        <rect
          v-for="(bar, index) in bars"
          :key="index"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          fill="currentColor"
          opacity=".9"
        />
      </svg>
      <figcaption class="flex justify-between text-[11px] text-muted">
        <span>{{ summary.bars!.start }}</span><span>{{ summary.bars!.label }}</span><span>{{ summary.bars!.end }}</span>
      </figcaption>
    </figure>
    <div
      v-if="summary.detail || $slots.action"
      class="flex items-center justify-between gap-3"
    >
      <div
        v-if="summary.detail"
        class="flex min-w-0 flex-col gap-0.5"
      >
        <p class="text-[11px] text-muted">
          {{ summary.detail.label }}
        </p>
        <p class="line-clamp-2 break-words text-[15px] font-medium leading-snug">
          {{ summary.detail.value }}
        </p>
      </div>
      <slot name="action" />
    </div>
  </section>
</template>
