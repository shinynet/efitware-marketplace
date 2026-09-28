<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BodyMetricView } from './focusedProgressModel'
import type { createWorkoutConnection } from './workoutConnection'
import { resolveDisplayUnitSystem } from './presentation'
import { accountBodyMetricUnit, bodyMetricLabelKey, chartPoints, formatBodyMetric, seriesUnit } from './measurement'
import ProgressChart from './ProgressChart.vue'
import HostFollowUp from './HostFollowUp.vue'
const { metric, disabled, navigate, followUp } = defineProps<{ metric: BodyMetricView, disabled: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'], followUp: ReturnType<typeof createWorkoutConnection>['sendFollowUp'] }>()
const { t, locale } = useI18n()
const from = ref(metric.record.from), to = ref(metric.record.to)
watch(() => metric.record, record => { from.value = record.from; to.value = record.to })
const title = computed(() => t(bodyMetricLabelKey(metric.record.key)))
// Observations render as given, unsnapped at one decimal and never converted (measurement.ts).
const format = computed(() => {
  const unit = seriesUnit(metric.related.observations.data, accountBodyMetricUnit(metric.record.key, resolveDisplayUnitSystem(metric.presentation.unitSystem, locale.value)))
  return (value: number) => formatBodyMetric({ value, unit }, locale.value, text => t('progressUi.bpm', { value: text }))
})
const valid = computed(() => /^\d{4}-\d{2}-\d{2}$/.test(from.value) && /^\d{4}-\d{2}-\d{2}$/.test(to.value) && from.value <= to.value && (Date.parse(`${to.value}T12:00:00Z`) - Date.parse(`${from.value}T12:00:00Z`)) / 86_400_000 <= 371)
const show = () => valid.value && navigate({ name: 'open_body_metric', arguments: { key: metric.record.key, from: from.value, to: to.value } }, true)
const request = computed(() => t('progressUi.metricExplain', { key: metric.record.key, from: metric.record.from, to: metric.record.to }))
</script>
<template>
  <article class="mb-6">
    <p class="text-xs font-semibold uppercase tracking-widest text-gold-ink">
      {{ t('progressUi.title') }}
    </p>
    <h1 class="mt-2 font-serif text-3xl sm:text-4xl">
      {{ title }}
    </h1>
    <p class="mt-3 text-sm text-muted">
      {{ t('progressUi.neutral') }}
    </p>
    <section class="mt-5">
      <fieldset
        :disabled
        class="grid grid-cols-1 items-end gap-3 sm:grid-cols-2"
      >
        <legend class="mb-2 text-sm font-semibold">
          {{ t('progressUi.range') }}
        </legend>
        <label class="min-w-0 text-sm">{{ t('progressUi.from') }}<input
          v-model="from"
          type="date"
          required
          :max="to"
          class="mt-2 block w-full"
          @keydown.enter.prevent="show"
        ></label>
        <label class="min-w-0 text-sm">{{ t('progressUi.to') }}<input
          v-model="to"
          type="date"
          required
          :min="from"
          class="mt-2 block w-full"
          @keydown.enter.prevent="show"
        ></label>
        <button
          class="secondary"
          :disabled="!valid"
          type="button"
          @click="show"
        >
          {{ t('progressUi.showRange') }}
        </button>
      </fieldset>
      <p class="mt-2 text-xs text-muted">
        {{ t('progressUi.maxDays') }}
      </p>
    </section>
    <progress-chart
      :title
      :points="chartPoints(metric.related.observations.data)"
      :format
    />
    <host-follow-up
      :disabled
      :request
      :send="followUp"
      label="progressUi.askExplain"
    />
  </article>
</template>
