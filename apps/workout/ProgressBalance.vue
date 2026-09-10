<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProgressView } from './progressModel'
const { progress } = defineProps<{ progress: ProgressView }>()
const { t, te, locale } = useI18n()
const maxSets = computed(() => Math.max(1, ...progress.record.balance.muscles.map(row => row.sets)))
const percent = (value: number) => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(value)
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const label = (key: string) => te(`progressUi.groups.${key}`) ? t(`progressUi.groups.${key}`) : key
</script>
<template>
  <section
    v-if="progress.record.balance.muscles.length || progress.record.balance.movements.length || progress.record.modalitySplit.length"
    class="my-6"
    aria-labelledby="balance-title"
  >
    <h2
      id="balance-title"
      class="font-serif text-2xl"
    >
      {{ t('progressUi.balance') }}
    </h2>
    <section
      v-if="progress.record.balance.muscles.length"
      class="mt-4 rounded bg-surface p-4"
      aria-labelledby="muscle-title"
    >
      <h3
        id="muscle-title"
        class="mb-4 font-semibold"
      >
        {{ t('progressUi.muscleSets') }}
      </h3>
      <dl class="space-y-3">
        <div
          v-for="row in progress.record.balance.muscles"
          :key="row.muscle"
        >
          <dt class="text-sm">
            {{ label(row.muscle) }}
          </dt><dd class="mt-1 flex items-center gap-3">
            <svg
              viewBox="0 0 100 8"
              class="h-2 min-w-0 flex-1"
              preserveAspectRatio="none"
              aria-hidden="true"
            ><rect
              width="100"
              height="8"
              class="fill-surface-dark"
            /><rect
              :width="row.sets / maxSets * 100"
              height="8"
              class="fill-olive"
            /></svg><span class="text-sm">{{ number(row.sets) }}</span>
          </dd>
        </div>
      </dl>
    </section>
    <section
      v-if="progress.record.balance.movements.length"
      class="mt-4 rounded bg-surface p-4"
      aria-labelledby="movement-title"
    >
      <h3
        id="movement-title"
        class="mb-3 font-semibold"
      >
        {{ t('progressUi.movementShare') }}
      </h3>
      <dl class="space-y-2">
        <div
          v-for="row in progress.record.balance.movements"
          :key="row.movement"
          class="flex justify-between gap-3"
        >
          <dt>{{ label(row.movement) }}</dt><dd>{{ percent(row.share) }}</dd>
        </div>
      </dl>
    </section>
    <section
      v-if="progress.record.modalitySplit.length"
      class="mt-4 rounded bg-surface p-4"
      aria-labelledby="modality-title"
    >
      <h3
        id="modality-title"
        class="mb-3 font-semibold"
      >
        {{ t('progressUi.modalityShare') }}
      </h3>
      <dl class="space-y-2">
        <div
          v-for="row in progress.record.modalitySplit"
          :key="row.modality"
          class="flex justify-between gap-3"
        >
          <dt>{{ label(row.modality) }}</dt><dd>{{ percent(row.share) }}</dd>
        </div>
      </dl>
    </section>
  </section>
</template>
