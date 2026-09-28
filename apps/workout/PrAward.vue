<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatLoad, formatTotal, type Measurement } from './measurement'
import type { PrAwardType } from './progressModel'
/**
 * A personal-record award's kind (EF-1468): "Heaviest", or "Est. 1RM ~215 lb · from 170 lb × 8" with the
 * estimate and the lifted set it came from. Measurements render as given, never converted. Each chunk keeps
 * its words together, so a narrow card wraps between chunks, never inside one.
 */
const { kind, estimate = undefined, weight = undefined, reps = undefined } = defineProps<{ kind: PrAwardType, estimate?: Measurement, weight?: Measurement | null, reps?: number | null }>()
const { t, locale } = useI18n()
const count = (value: number) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value)
</script>
<template>
  <span class="whitespace-nowrap font-semibold">{{ t(`progressUi.prType.${kind}`) }}</span>
  <template v-if="kind === 'oneRm' && estimate">
    {{ ' ' }}<span class="whitespace-nowrap">{{ t('progressUi.estimate', { value: formatTotal(estimate, locale) }) }}</span>
    <template v-if="weight && reps != null">
      {{ ' ' }}<span class="whitespace-nowrap text-muted">· {{ t('progressUi.estimateSource', { weight: formatLoad(weight, locale), reps: count(reps) }) }}</span>
    </template>
  </template>
</template>
