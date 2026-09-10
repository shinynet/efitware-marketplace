<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { createWorkoutConnection } from './workoutConnection'
import type { ProgressView } from './progressModel'
import { resolveDisplayUnitSystem, formatMeasure } from './presentation'
import { formatDay } from './planningModel'
import ProgressChart from './ProgressChart.vue'
const { progress, disabled, navigate } = defineProps<{ progress: ProgressView, disabled: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'] }>()
const open = (key: string) => navigate({ name: 'open_body_metric', arguments: { key, from: progress.record.rangeStart, to: progress.record.asOf } })
const { t, locale } = useI18n()
const weight = (value: number) => formatMeasure('weight', value, (resolveDisplayUnitSystem(progress.presentation.unitSystem, locale.value)), locale.value)
const percent = (value: number) => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(value / 100)
const length = (value: number) => new Intl.NumberFormat(locale.value, { style: 'unit', unit: resolveDisplayUnitSystem(progress.presentation.unitSystem, locale.value) === 'imperial' ? 'inch' : 'centimeter', maximumFractionDigits: 1 }).format(resolveDisplayUnitSystem(progress.presentation.unitSystem, locale.value) === 'imperial' ? value / 2.54 : value)
const number = (value: number) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value)
const heartRate = (value: number) => t('progressUi.bpm', { value: number(value) })
</script>
<template>
  <section
    v-if="progress.related.section === 'body'"
    class="mb-6"
    aria-labelledby="body-title"
  >
    <h2
      id="body-title"
      class="font-serif text-2xl"
    >
      {{ t('progressUi.body') }}
    </h2>
    <p class="mt-2 text-sm text-muted">
      {{ t('progressUi.neutral') }}
    </p>
    <dl class="mt-4 grid grid-cols-2 gap-4 rounded bg-surface p-4">
      <div>
        <dt class="text-sm text-muted">
          {{ t('progressUi.weight') }}
        </dt><dd class="mt-1 text-xl">
          {{ progress.record.body.weightKg === null ? t('progressUi.unavailable') : weight(progress.record.body.weightKg) }}
        </dd>
      </div>
      <div>
        <dt class="text-sm text-muted">
          {{ t('progressUi.targetWeight') }}
        </dt><dd class="mt-1 text-xl">
          {{ progress.record.body.goalWeightKg === null ? t('progressUi.unavailable') : weight(progress.record.body.goalWeightKg) }}
        </dd>
      </div>
      <div>
        <dt class="text-sm text-muted">
          {{ t('progressUi.fat') }}
        </dt><dd class="mt-1 text-xl">
          {{ progress.record.body.bodyFatPercent === null ? t('progressUi.unavailable') : percent(progress.record.body.bodyFatPercent) }}
        </dd>
      </div>
    </dl>
    <button
      class="secondary mt-4"
      :disabled
      @click="open('weight_kg')"
    >
      {{ t('progressUi.viewWeight') }}
    </button>
    <button
      class="secondary mt-4"
      :disabled
      @click="open('body_fat_percent')"
    >
      {{ t('progressUi.viewFat') }}
    </button>
    <progress-chart
      :title="t('progressUi.weight')"
      :points="progress.record.body.weightSeries"
      :format="weight"
    />
    <progress-chart
      :title="t('progressUi.fat')"
      :points="progress.record.body.bodyFatSeries"
      :format="percent"
    />
    <section
      v-for="measurement in progress.record.body.measurements"
      :key="measurement.key"
      class="mt-5"
    >
      <h3 class="font-semibold">
        {{ t(`progressUi.measurement.${measurement.key}`) }}
      </h3>
      <p class="mt-1 text-sm">
        {{ t('progressUi.current', { value: length(measurement.valueCm) }) }}
      </p>
      <button
        class="secondary mt-3"
        :disabled
        @click="open(`${measurement.key}_cm`)"
      >
        {{ t('progressUi.viewMetric') }}
      </button>
      <progress-chart
        :title="t(`progressUi.measurement.${measurement.key}`)"
        :points="measurement.series"
        :format="length"
      />
    </section>
  </section>
  <section
    v-else
    class="mb-6"
    aria-labelledby="cardio-title"
  >
    <h2
      id="cardio-title"
      class="font-serif text-2xl"
    >
      {{ t('progressUi.cardio') }}
    </h2>
    <dl class="mt-4 grid grid-cols-2 gap-4 rounded bg-surface p-4">
      <div>
        <dt class="text-sm text-muted">
          {{ t('progressUi.zone2') }}
        </dt><dd class="mt-1 text-xl">
          {{ formatMeasure('duration', progress.record.cardio.zone2Minutes * 60, (resolveDisplayUnitSystem(progress.presentation.unitSystem, locale)), locale) }}
        </dd>
      </div>
      <div>
        <dt class="text-sm text-muted">
          {{ t('progressUi.restingHr') }}
        </dt><dd class="mt-1 text-xl">
          {{ progress.record.cardio.restingHr === null ? t('progressUi.unavailable') : heartRate(progress.record.cardio.restingHr) }}
        </dd>
      </div>
    </dl>
    <button
      class="secondary mt-4"
      :disabled
      @click="open('resting_heart_rate_bpm')"
    >
      {{ t('progressUi.viewMetric') }}
    </button>
    <progress-chart
      :title="t('progressUi.restingHr')"
      :points="progress.record.cardio.restingHrSeries"
      :format="heartRate"
    />
    <dl class="space-y-4">
      <div
        v-for="effort in progress.record.cardio.bestEfforts"
        :key="effort.key"
        class="rounded border border-surface-dark p-4"
      >
        <dt>{{ t(`progressUi.efforts.${effort.key}`) }}</dt>
        <dd class="mt-2 font-serif text-2xl">
          {{ effort.seconds !== undefined ? formatMeasure('duration', effort.seconds, (resolveDisplayUnitSystem(progress.presentation.unitSystem, locale)), locale) : effort.distanceMeters !== undefined ? formatMeasure('distance', effort.distanceMeters, (resolveDisplayUnitSystem(progress.presentation.unitSystem, locale)), locale) : effort.watts !== undefined ? t('progressUi.watts', { value: number(effort.watts) }) : t('progressUi.unavailable') }}
        </dd>
        <dd class="mt-2 text-sm text-muted">
          <time :datetime="effort.date">{{ formatDay(effort.date, locale) }}</time>
        </dd>
      </div>
    </dl>
  </section>
</template>
