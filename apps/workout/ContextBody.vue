<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ContextView } from './contextModel'
import { circumferenceIds, formatBodyMetric, type BodyMetricId, type Measurement } from './measurement'
import type { createWorkoutConnection } from './workoutConnection'
const { context, busy, navigate } = defineProps<{ context: ContextView, busy: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'] }>()
const { t, locale } = useI18n()
// Height stays canonical centimetres; body metrics render as given, never converted (measurement.ts).
const length = (value: number) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1, style: 'unit', unit: context.record.context.unitSystem === 'imperial' ? 'inch' : 'centimeter' }).format(context.record.context.unitSystem === 'imperial' ? value / 2.54 : value)
const body = (measurement: Measurement) => formatBodyMetric(measurement, locale.value, value => t('progressUi.bpm', { value }))
const rows = computed(() => {
  const p = context.record.profile
  const row = (label: string, measurement: Measurement | null | undefined, key?: BodyMetricId) => measurement ? [{ label, text: body(measurement), key }] : []
  return [
    ...(p.heightCm === null ? [] : [{ label: t('contextUi.height'), text: length(p.heightCm), key: undefined }]),
    ...row(t('progressUi.weight'), p.weight, 'weight'),
    ...row(t('contextUi.targetWeight'), p.goalWeight),
    ...row(t('progressUi.fat'), p.bodyFat, 'body_fat'),
    ...row(t('progressUi.restingHr'), p.restingHeartRate, 'resting_heart_rate'),
    ...circumferenceIds.flatMap(key => row(t(`progressUi.measurement.${key}`), p.measurements[key], key))
  ]
})
const open = (key: BodyMetricId) => {
  const to = context.record.context.today
  const from = new Date(Date.parse(`${to}T12:00:00Z`) - 89 * 86_400_000).toISOString().slice(0, 10)
  return navigate({ name: 'open_body_metric', arguments: { key, from, to } })
}
</script>
<template>
  <section
    v-if="rows.length"
    class="my-6"
    aria-labelledby="context-body-heading"
  >
    <h3
      id="context-body-heading"
      class="mb-3 font-serif text-2xl"
    >
      {{ t('contextUi.body') }}
    </h3><dl class="grid gap-3 sm:grid-cols-2">
      <div
        v-for="row in rows"
        :key="row.label"
        class="rounded bg-surface p-4"
      >
        <dt class="text-sm text-muted">
          {{ row.label }}
        </dt><dd class="mt-1 text-lg">
          <button
            v-if="row.key"
            :disabled="busy"
            type="button"
            class="underline decoration-surface-dark underline-offset-4"
            @click="open(row.key)"
          >
            {{ row.text }}
          </button><span v-else>{{ row.text }}</span>
        </dd>
      </div>
    </dl>
  </section>
</template>
