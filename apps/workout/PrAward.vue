<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatLoad, formatTotal, type Measurement } from './measurement'
import type { PrAwardType } from './progressModel'
import type { LoadShape } from './model'
import { hasExternalEstimate, progressLoad } from './addedLoadPresentation'
/**
 * A personal-record award: Heaviest, Heaviest added, a dated rep record, or an external-load
 * estimate with the lifted set it came from. Added work never presents an estimated maximum. Measurements render as given, never converted. Each chunk keeps
 * its words together, so a narrow card wraps between chunks, never inside one.
 */
const { kind, estimate = undefined, weight = undefined, reps = undefined, loadShape = undefined } = defineProps<{ kind: PrAwardType, estimate?: Measurement, weight?: Measurement | null, reps?: number | null, loadShape?: LoadShape }>()
const { t, locale } = useI18n()
const count = (value: number) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value)
</script>
<template>
  <i18n-t
    v-if="kind === 'reps' && weight && reps != null"
    keypath="progressUi.repRecordValue"
    :plural="reps"
    tag="span"
  >
    <template #reps>
      <span class="whitespace-nowrap">{{ count(reps) }}</span>
    </template>
    <template #load>
      <span class="whitespace-nowrap">{{ weight.value === 0 ? t('progressUi.bodyWeightAt') : progressLoad(weight, 'added', locale, t) }}</span>
    </template>
  </i18n-t>
  <template v-else-if="kind !== 'oneRm' || hasExternalEstimate(loadShape)">
    <span class="whitespace-nowrap font-semibold">{{ t(kind === 'weight' && loadShape === 'added' ? 'progressUi.heaviestAdded' : `progressUi.prType.${kind}`) }}</span>
    <template v-if="kind === 'oneRm' && estimate">
      {{ ' ' }}<span class="whitespace-nowrap">{{ t('progressUi.estimate', { value: formatTotal(estimate, locale) }) }}</span>
      <template v-if="weight && reps != null">
        {{ ' ' }}<span class="whitespace-nowrap text-muted">· {{ t('progressUi.estimateSource', { weight: formatLoad(weight, locale), reps: count(reps) }) }}</span>
      </template>
    </template>
  </template>
</template>
