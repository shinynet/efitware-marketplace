<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ContextView } from './contextModel'
import { formatMeasure } from './presentation'
import type { createWorkoutConnection } from './workoutConnection'
const { context, busy, navigate } = defineProps<{ context: ContextView, busy: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'] }>()
const { t, locale } = useI18n()
const number = (value: number) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value)
const length = (value: number) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1, style: 'unit', unit: context.record.context.unitSystem === 'imperial' ? 'inch' : 'centimeter' }).format(context.record.context.unitSystem === 'imperial' ? value / 2.54 : value)
const weight = (value: number) => formatMeasure('weight', value, context.record.context.unitSystem, locale.value)
const rows = computed(() => {
  const p = context.record.profile
  return [
    { label: t('contextUi.height'), value: p.heightCm, format: length },
    { label: t('progressUi.weight'), value: p.weightKg, format: weight, key: 'weight_kg' },
    { label: t('contextUi.targetWeight'), value: p.goalWeightKg, format: weight },
    { label: t('progressUi.fat'), value: p.bodyFatPercent, format: (value: number) => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(value / 100), key: 'body_fat_percent' },
    { label: t('progressUi.restingHr'), value: p.restingHeartRate, format: (value: number) => t('progressUi.bpm', { value: number(value) }), key: 'resting_heart_rate_bpm' },
    ...Object.entries(p.measurements).map(([key, value]) => ({ label: t(`progressUi.measurement.${key}`), value, format: length, key: `${key}_cm` }))
  ].filter(row => row.value !== null)
})
const open = (key: string) => {
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
            {{ row.format(row.value!) }}
          </button><span v-else>{{ row.format(row.value!) }}</span>
        </dd>
      </div>
    </dl>
  </section>
</template>
