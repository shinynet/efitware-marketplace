<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ShareView } from './outcomeModel'
const { chart } = defineProps<{ chart: NonNullable<ShareView['record']['chart']> }>()
const { t, locale } = useI18n()
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const line = computed(() => {
  if (chart.type !== 'line') return ''
  const min = Math.min(...chart.points), max = Math.max(...chart.points)
  return chart.points.map((value, index) => `${20 + index / Math.max(1, chart.points.length - 1) * 360},${160 - (value - min) / (max - min || 1) * 130}`).join(' ')
})
const maximum = computed(() => chart.type === 'bars' ? Math.max(1, ...chart.bars.map(bar => bar.value)) : 1)
</script>
<template>
  <figure class="my-5">
    <svg
      v-if="chart.type === 'line' && chart.points.length"
      viewBox="0 0 400 185"
      role="img"
      :aria-label="t('outcomeUi.chartPreview')"
      class="w-full"
    ><polyline
      :points="line"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      class="text-olive"
    /><circle
      v-if="chart.points.length === 1"
      cx="20"
      cy="160"
      r="5"
      class="fill-olive"
    /></svg><svg
      v-else-if="chart.type === 'bars' && chart.bars.length"
      viewBox="0 0 400 185"
      role="img"
      :aria-label="t('outcomeUi.chartPreview')"
      class="w-full"
    ><rect
      v-for="(bar, index) in chart.bars"
      :key="index"
      :x="10 + index / chart.bars.length * 380"
      :y="170 - bar.value / maximum * 150"
      :width="380 / chart.bars.length - 5"
      :height="bar.value / maximum * 150"
      class="fill-olive"
    /></svg><svg
      v-else-if="chart.type === 'dots'"
      viewBox="0 0 400 230"
      role="img"
      :aria-label="t('outcomeUi.chartPreview')"
      class="w-full"
    ><template
      v-for="(week, index) in chart.weeks"
      :key="index"
    ><circle
      v-for="(trained, day) in week"
      :key="day"
      :cx="20 + index * 31"
      :cy="20 + day * 31"
      r="9"
      :class="trained ? 'fill-olive' : 'fill-surface-dark'"
    /></template></svg><figcaption class="text-xs text-muted">
      <span
        v-if="chart.type === 'line'"
        class="mb-2 flex justify-between gap-4"
      ><span>{{ chart.startLabel }}</span><span>{{ chart.endLabel }}</span></span>{{ t('outcomeUi.chartPreview') }}
      <details class="mt-3">
        <summary class="cursor-pointer">
          {{ t('outcomeUi.chartData') }}
        </summary>
        <ol
          v-if="chart.type === 'line'"
          class="mt-2 list-inside list-decimal"
        >
          <li
            v-for="(value, index) in chart.points"
            :key="index"
          >
            {{ number(value) }}
          </li>
        </ol>
        <dl
          v-else-if="chart.type === 'bars'"
          class="mt-2 space-y-1"
        >
          <div
            v-for="(bar, index) in chart.bars"
            :key="index"
            class="flex justify-between gap-3"
          >
            <dt>{{ bar.label }}</dt><dd>{{ number(bar.value) }}</dd>
          </div>
        </dl>
        <ol
          v-else
          class="mt-2 space-y-1"
        >
          <li
            v-for="(week, index) in chart.weeks"
            :key="index"
          >
            {{ t('outcomeUi.weekSummary', { index: number(index + 1), count: number(week.filter(Boolean).length) }) }}
          </li>
        </ol>
      </details>
    </figcaption>
  </figure>
</template>
