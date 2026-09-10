<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ContextView } from './contextModel'
import { formatMeasure } from './presentation'
const { context } = defineProps<{ context: ContextView }>()
const { t, te, locale } = useI18n()
const profile = computed(() => context.record.profile)
const list = (values: string[], namespace: string) => values.length ? new Intl.ListFormat(locale.value).format(values.map(value => te(`${namespace}.${value}`) ? t(`${namespace}.${value}`) : value)) : t('contextUi.missing')
const number = (value: number | null) => value === null ? t('contextUi.missing') : new Intl.NumberFormat(locale.value).format(value)
const rows = computed(() => [
  { label: 'preferredName', value: profile.value.preferredName || t('contextUi.missing') },
  { label: 'goals', value: list(profile.value.trainingGoals, 'contextVocabulary.trainingGoals') },
  { label: 'interests', value: list(profile.value.trainingInterests, 'contextVocabulary.trainingInterests') },
  { label: 'focus', value: list(profile.value.focusAreas, 'contextUi') },
  { label: 'experience', value: profile.value.experience ? t(`contextUi.${profile.value.experience}`) : t('contextUi.missing') },
  { label: 'days', value: number(profile.value.daysPerWeek) },
  { label: 'availableDays', value: profile.value.availableDays.length ? list(profile.value.availableDays, 'contextUi') : t('contextUi.anyDay') },
  { label: 'minutes', value: profile.value.minutesPerSession === null ? t('contextUi.missing') : formatMeasure('duration', profile.value.minutesPerSession * 60, context.record.context.unitSystem, locale.value) }
])
</script>
<template>
  <dl class="grid gap-3 sm:grid-cols-2">
    <div
      v-for="row in rows"
      :key="row.label"
      class="rounded bg-surface p-4"
    >
      <dt class="text-sm text-muted">
        {{ t(`contextUi.${row.label}`) }}
      </dt><dd class="mt-1">
        {{ row.value }}
      </dd>
    </div>
  </dl>
  <section
    v-for="field in ['motivation', 'sportEventContext'] as const"
    v-show="profile[field]"
    :key="field"
    class="my-5"
  >
    <h3 class="font-semibold">
      {{ t(field === 'motivation' ? 'contextUi.motivation' : 'contextUi.preparation') }}
    </h3><p class="mt-2 whitespace-pre-wrap">
      {{ profile[field] }}
    </p>
  </section>
</template>
