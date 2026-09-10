<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { chartGeometry, type SeriesPoint } from './progressModel'
import { formatDay } from './planningModel'
const { title, points, format, bars = false, source = false, disabled = false } = defineProps<{ title: string, points: SeriesPoint[], format: (value: number) => string, bars?: boolean, source?: boolean, disabled?: boolean }>()
const emit = defineEmits<{ select: [date: string] }>()
const { t, locale } = useI18n()
const selected = ref(Math.max(0, points.length - 1))
watch(() => points, () => { selected.value = Math.max(0, points.length - 1) })
const geometry = computed(() => chartGeometry(points, bars))
const active = computed(() => points[selected.value])
</script>
<template>
  <figure class="my-5 rounded border border-surface-dark p-4">
    <figcaption class="font-semibold">
      {{ title }}
    </figcaption>
    <p
      v-if="!points.length"
      class="mt-3 text-sm text-muted"
    >
      {{ t('progressUi.noObservations') }}
    </p>
    <template v-else>
      <svg
        v-if="points.length > 1"
        viewBox="0 0 600 180"
        role="img"
        :aria-label="t('progressUi.chartDescription', { title })"
        class="mt-4 block w-full overflow-visible text-olive"
      >
        <title>{{ title }}</title>
        <polyline
          v-if="!bars"
          :points="geometry.points.map(point => `${point.x},${point.y}`).join(' ')"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        />
        <path
          d="M24 160 H576"
          class="stroke-muted"
          fill="none"
        />
        <template
          v-for="(point, index) in geometry.points"
          :key="point.date"
        >
          <path
            v-if="bars"
            :d="`M${point.x} 160 V${point.y}`"
            stroke="currentColor"
            :stroke-width="Math.min(18, 500 / points.length)"
          />
          <circle
            v-else
            :cx="point.x"
            :cy="point.y"
            :r="selected === index ? 6 : 4"
            fill="currentColor"
          />
        </template>
      </svg>
      <p
        v-if="points.length > 1"
        class="mb-2 flex justify-between gap-3 text-xs text-muted"
      >
        <time :datetime="points[0]!.date">{{ formatDay(points[0]!.date, locale) }}</time><time :datetime="points.at(-1)!.date">{{ formatDay(points.at(-1)!.date, locale) }}</time>
      </p>
      <p
        v-if="points.length > 1"
        class="flex flex-wrap justify-between gap-2 text-xs text-muted"
      >
        <span>{{ t('progressUi.axis', { low: format(geometry.low), high: format(geometry.high) }) }}</span>
        <span>{{ t('progressUi.observationsOnly') }}</span>
      </p>
      <label class="mt-4 block text-sm">
        {{ t('progressUi.observation') }}
        <select
          v-model="selected"
          class="mt-2 block min-h-11 w-full rounded border border-muted bg-bg px-2 text-ink"
        >
          <option
            v-for="(point, index) in points"
            :key="point.date"
            :value="index"
          >{{ formatDay(point.date, locale) }} · {{ format(point.value) }}</option>
        </select>
      </label>
      <p
        v-if="active"
        class="mt-3 font-serif text-2xl"
        role="status"
      >
        {{ format(active.value) }}
      </p>
      <button
        v-if="source && active"
        :disabled
        class="secondary mt-3"
        @click="emit('select', active.date)"
      >
        {{ t('progressUi.viewDay') }}
      </button>
    </template>
  </figure>
</template>
