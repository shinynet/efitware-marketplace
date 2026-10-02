<script setup lang="ts">
/**
 * One superset or circuit (app EF-1552), shown before its first member: the
 * kind, the round count, the members in order, and each round's turns with the
 * Activities the record already anchors after each selected set — rest between
 * members or after a round is the saved rest Activity, never an invented one.
 * The members' own rows still render in full below, so nothing is flattened or
 * dropped. The card cannot edit a grouping, so that action opens the app.
 */
import { useI18n } from 'vue-i18n'
import type { PresentedGroup } from './executionGroups'
import { formatMeasure } from './presentation'

const { presented, nameOf, open } = defineProps<{
  presented: PresentedGroup
  nameOf: (exercise: PresentedGroup['members'][number]) => string
  open: () => void
}>()
const { t, locale } = useI18n()
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const headingId = `group-${presented.group.id}`
const activityLabel = (activity: PresentedGroup['rounds'][number][number]['activities'][number]) => {
  const name = activity.title || t(activity.kind === 'rest' ? 'restKind' : activity.kind)
  if (activity.durationTarget === undefined) return name
  const duration = formatMeasure('duration', activity.durationTarget, 'metric', locale.value)
  return activity.kind === 'rest' && !activity.title ? t('rest', { value: duration }) : t('groupUi.activityWithDuration', { name, duration })
}
</script>

<template>
  <section
    class="mb-3 rounded border border-surface-dark bg-surface p-4"
    :aria-labelledby="headingId"
  >
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h3
        :id="headingId"
        class="font-serif text-xl"
      >
        {{ t(`groupUi.${presented.group.kind}`) }}
      </h3>
      <p class="text-sm text-muted">
        {{ t('groupUi.rounds', presented.rounds.length) }}
      </p>
    </header>
    <h4 class="mt-3 text-xs font-semibold uppercase tracking-widest text-gold-ink">
      {{ t('groupUi.order') }}
    </h4>
    <ol class="mt-1 list-decimal pl-5 text-sm">
      <li
        v-for="member in presented.members"
        :key="member.id"
      >
        {{ nameOf(member) }}
      </li>
    </ol>
    <h4 class="mt-4 text-xs font-semibold uppercase tracking-widest text-gold-ink">
      {{ t('groupUi.sequence') }}
    </h4>
    <ol class="mt-1 space-y-3">
      <li
        v-for="(turns, round) in presented.rounds"
        :key="round"
      >
        <p class="text-sm font-medium">
          {{ t('groupUi.round', { number: number(round + 1) }) }}
        </p>
        <ol class="mt-1 border-l border-surface-dark pl-3 text-sm">
          <template
            v-for="turn in turns"
            :key="`${round}-${turn.exercise.id}`"
          >
            <li>{{ t('groupUi.turn', { exercise: nameOf(turn.exercise), number: number(turn.setNumber) }) }}</li>
            <li
              v-for="activity in turn.activities"
              :key="`${round}-${activity.id}`"
              class="text-muted"
            >
              {{ activityLabel(activity) }}
            </li>
          </template>
        </ol>
      </li>
    </ol>
    <p class="mt-4 text-xs text-muted">
      {{ t('groupUi.editNote') }}
    </p>
    <button
      type="button"
      class="link mt-1"
      @click="open()"
    >
      {{ t('groupUi.editInApp') }}
    </button>
  </section>
</template>
