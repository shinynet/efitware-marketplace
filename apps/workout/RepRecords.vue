<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ProgressView } from './progressModel'
import { formatDay } from './planningModel'
import PrAward from './PrAward.vue'

const { records } = defineProps<{ records: NonNullable<ProgressView['related']['progression']['data'][number]['repRecords']> }>()
const { t, locale } = useI18n()
</script>
<template>
  <section
    v-if="records.length"
    class="mt-4"
  >
    <h3 class="text-sm font-semibold">
      {{ t('progressUi.repRecords') }}
    </h3>
    <ul class="mt-2 space-y-2">
      <li
        v-for="(record, index) in records"
        :key="`${record.date}:${index}`"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1"
      >
        <span><pr-award
          kind="reps"
          load-shape="added"
          :weight="record.weight"
          :reps="record.reps"
        /></span>
        <time
          :datetime="record.date"
          class="text-xs text-muted"
        >{{ formatDay(record.date, locale) }}</time>
      </li>
    </ul>
  </section>
</template>
