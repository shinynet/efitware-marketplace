<script setup lang="ts">
/** Program overview and explicitly paginated membership; navigation stays within the host card. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDay, shiftDay, type ProgramView } from './planningModel'
import type { createWorkoutConnection } from './workoutConnection'
const { program, disabled, navigate, update } = defineProps<{
  program: ProgramView, disabled: boolean,
  navigate: ReturnType<typeof createWorkoutConnection>['navigate'],
  update: ReturnType<typeof createWorkoutConnection>['updatePlanning']
}>()
const { t, locale } = useI18n()
const collection = computed(() => program.related.collection)
const pageMeta = computed(() => program.related[`${collection.value}Meta`])
const page = (number: number, tab = collection.value) => navigate({ name: 'open_program', arguments: { programId: program.record.id, today: program.related.today, page: number, limit: program.related.limit, collection: tab } }, true)
const n = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const openSchedule = (id: string) => navigate({ name: 'open_schedule', arguments: { scheduleId: id, today: program.related.today } })
const openWorkout = (id: string) => navigate({ name: 'open_workout', arguments: { workoutId: id } })
</script>
<template>
  <article>
    <header class="mb-6">
      <p class="text-xs font-semibold uppercase tracking-widest text-gold-ink">
        {{ t('trainingProgram') }}
      </p>
      <h1 class="mt-2 font-serif text-3xl sm:text-4xl">
        {{ program.record.name }}
      </h1>
      <p class="mt-2 text-sm text-muted">
        {{ t(program.record.status) }}
      </p>
      <p
        v-if="program.record.description"
        class="mt-4 whitespace-pre-wrap text-sm leading-relaxed"
      >
        {{ program.record.description }}
      </p>
      <p
        v-if="program.related.span"
        class="mt-3 text-sm"
      >
        <time :datetime="program.related.span.startDate">{{ formatDay(program.related.span.startDate, locale) }}</time>
        {{ t('through') }}
        <time :datetime="program.related.span.endDate">{{ formatDay(program.related.span.endDate, locale) }}</time>
      </p>
      <p
        v-if="program.related.supportsGoal"
        class="mt-3 text-sm text-gold-ink"
      >
        {{ t('supportsGoal', { name: program.related.supportsGoal.name }) }}
      </p>
    </header>
    <nav
      :aria-label="t('navigation')"
      class="mb-6"
    >
      <button
        type="button"
        class="secondary"
        :disabled="disabled"
        @click="navigate({ name: 'open_calendar', arguments: { from: program.related.today, to: shiftDay(program.related.today, 6), date: program.related.today } })"
      >
        {{ t('viewTrainingWeek') }}
      </button>
    </nav>
    <dl class="mb-6 grid grid-cols-2 gap-4 rounded bg-surface p-4">
      <div>
        <dt class="text-sm text-muted">
          {{ t('schedules') }}
        </dt><dd class="mt-1 font-serif text-3xl">
          {{ n(program.related.schedulesMeta.total) }}
        </dd>
      </div>
      <div>
        <dt class="text-sm text-muted">
          {{ t('workoutCount') }}
        </dt><dd class="mt-1 font-serif text-3xl">
          {{ n(program.related.workoutCount) }}
        </dd>
      </div>
    </dl>
    <section
      aria-labelledby="program-members-title"
      class="mb-6"
    >
      <h2
        id="program-members-title"
        class="mb-3 font-serif text-2xl"
      >
        {{ t('programMembers') }}
      </h2>
      <nav
        :aria-label="t('programMembers')"
        class="mb-4 flex flex-wrap gap-2"
      >
        <button
          v-for="tab in (['schedules', 'attachedWorkouts', 'recentWorkouts'] as const)"
          :key="tab"
          type="button"
          class="secondary"
          :aria-pressed="collection === tab"
          :disabled="disabled"
          @click="page(1, tab)"
        >
          {{ t(tab) }}
        </button>
      </nav>
      <ul
        v-if="collection === 'schedules'"
        class="space-y-3"
      >
        <li
          v-for="schedule in program.related.schedules"
          :key="schedule.id"
          class="rounded border border-surface-dark p-4"
        >
          <button
            type="button"
            class="secondary w-full text-left"
            :disabled="disabled"
            @click="openSchedule(schedule.id)"
          >
            {{ schedule.name }}
          </button>
          <p class="mt-2 text-sm text-muted">
            {{ t(schedule.enabled ? 'scheduleEnabled' : 'schedulePaused') }}
          </p>
          <p
            v-if="schedule.nextOccurrence"
            class="mt-2 text-sm"
          >
            {{ t('nextOccurrence') }} <time :datetime="schedule.nextOccurrence">{{ formatDay(schedule.nextOccurrence, locale) }}</time>
          </p>
        </li>
      </ul>
      <ul
        v-else
        class="space-y-3"
      >
        <li
          v-for="workout in program.related[collection]"
          :key="workout.id"
          class="rounded border border-surface-dark p-4"
        >
          <button
            type="button"
            class="secondary w-full text-left"
            :disabled="disabled"
            @click="openWorkout(workout.id)"
          >
            {{ workout.title }}
          </button>
          <p class="mt-2 text-sm text-muted">
            <time :datetime="workout.date">{{ formatDay(workout.date, locale) }}</time> · {{ t(workout.status) }}
          </p>
        </li>
      </ul>
      <p
        v-if="!program.related[collection].length"
        class="py-4 text-sm text-muted"
      >
        {{ t('emptyCollection') }}
      </p>
      <nav
        :aria-label="t('pagination')"
        class="mt-4 flex flex-wrap items-center justify-between gap-3"
      >
        <button
          type="button"
          class="secondary"
          :disabled="disabled || pageMeta.page <= 1"
          @click="page(pageMeta.page - 1)"
        >
          {{ t('previous') }}
        </button>
        <p class="text-sm">
          {{ t('pageOf', { page: n(pageMeta.page), total: n(Math.max(1, Math.ceil(pageMeta.total / pageMeta.limit))) }) }}
        </p>
        <button
          type="button"
          class="secondary"
          :disabled="disabled || pageMeta.page * pageMeta.limit >= pageMeta.total"
          @click="page(pageMeta.page + 1)"
        >
          {{ t('next') }}
        </button>
      </nav>
    </section>
    <aside class="mb-6 rounded bg-surface p-4">
      <p class="mb-3 text-sm text-muted">
        {{ t('archiveDoesNotPause') }}
      </p>
      <button
        type="button"
        class="secondary"
        :disabled="disabled"
        @click="update({ status: program.record.status === 'active' ? 'archived' : 'active' })"
      >
        {{ t(program.record.status === 'active' ? 'archiveProgram' : 'reactivateProgram') }}
      </button>
    </aside>
  </article>
</template>
