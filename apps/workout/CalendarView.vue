<script setup lang="ts">
/** Read-only calendar selection; creating an occurrence is a separately labelled, explicit mutation. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { dayMarks, formatDay, rangeDays, sessionMark, shiftDay, type CalendarView } from './planningModel'
import CalendarMark from './CalendarMark.vue'
import type { createWorkoutConnection } from './workoutConnection'
const { calendar, disabled, navigate, create } = defineProps<{
  calendar: CalendarView, disabled: boolean,
  navigate: ReturnType<typeof createWorkoutConnection>['navigate'],
  create: ReturnType<typeof createWorkoutConnection>['createOccurrence']
}>()
const { t, locale } = useI18n()
const days = computed(() => rangeDays(calendar.record.from, calendar.record.to))
const byDate = computed(() => new Map(calendar.record.days.map(day => [day.date, day])))
const select = (date: string) => navigate({ name: 'open_calendar', arguments: { from: calendar.record.from, to: calendar.record.to, date } }, true)
const shift = (direction: number) => navigate({ name: 'open_calendar', arguments: { from: shiftDay(calendar.record.from, days.value.length * direction), to: shiftDay(calendar.record.to, days.value.length * direction), date: shiftDay(calendar.record.date, days.value.length * direction) } }, true)
const n = (value: number) => new Intl.NumberFormat(locale.value).format(value)
type AgendaItem = NonNullable<CalendarView['record']['agenda']>['items'][number]
/** Visible label: missed and terminal rows name their presentation state; an untapped occurrence says it has no saved workout. */
const itemLabel = (item: AgendaItem) => item.displayStatus === 'missed' ? t(item.scheduleId ? 'missedOccurrence' : 'missed') : t(item.scheduleId ? 'scheduledOccurrence' : item.displayStatus)
const timed = (item: AgendaItem) => !item.scheduleId && item.displayStatus !== 'planned' && item.displayStatus !== 'missed'
const time = (instant: string) => new Intl.DateTimeFormat(locale.value, { hour: 'numeric', minute: '2-digit', timeZone: calendar.presentation.timeZone }).format(new Date(instant))
</script>
<template>
  <article>
    <header class="mb-6">
      <p class="text-xs font-semibold uppercase tracking-widest text-gold-ink">
        {{ t('trainingCalendar') }}
      </p>
      <h1 class="mt-2 font-serif text-3xl">
        {{ t('yourTraining') }}
      </h1>
      <p class="mt-3 text-sm">
        <time :datetime="calendar.record.from">{{ formatDay(calendar.record.from, locale) }}</time> {{ t('through') }} <time :datetime="calendar.record.to">{{ formatDay(calendar.record.to, locale) }}</time>
      </p>
    </header>
    <nav
      :aria-label="t('calendarRange')"
      class="mb-4 flex justify-between gap-3"
    >
      <button
        type="button"
        class="secondary"
        :disabled="disabled"
        @click="shift(-1)"
      >
        {{ t('previousRange') }}
      </button>
      <button
        type="button"
        class="secondary"
        :disabled="disabled"
        @click="shift(1)"
      >
        {{ t('nextRange') }}
      </button>
    </nav>
    <ol class="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <li
        v-for="date in days"
        :key="date"
      >
        <button
          type="button"
          class="secondary h-full w-full text-left"
          :aria-pressed="calendar.record.date === date"
          :disabled="disabled"
          @click="select(date)"
        >
          <time
            :datetime="date"
            class="block font-semibold"
          >{{ formatDay(date, locale) }}</time>
          <span
            v-if="dayMarks(byDate.get(date)).length"
            class="mt-2 flex flex-wrap gap-1.5"
          >
            <calendar-mark
              v-for="(kind, index) in dayMarks(byDate.get(date))"
              :key="`${kind}-${index}`"
              :kind="kind"
              :label="t(`calendarMark.${kind}`)"
            />
          </span>
          <span class="mt-1 block text-sm text-muted">{{ t('calendarCounts', { total: n(byDate.get(date)?.sessionCount ?? 0), completed: n(byDate.get(date)?.completedSessionCount ?? 0) }, byDate.get(date)?.sessionCount ?? 0) }}</span>
          <span
            v-if="byDate.get(date)?.summary"
            class="mt-2 block text-sm"
          >{{ byDate.get(date)?.summary?.title }}</span>
        </button>
      </li>
    </ol>
    <section
      aria-labelledby="calendar-agenda-title"
      class="mb-6"
    >
      <h2
        id="calendar-agenda-title"
        class="mb-4 font-serif text-2xl"
      >
        <time :datetime="calendar.record.date">{{ formatDay(calendar.record.date, locale) }}</time>
      </h2>
      <p
        v-if="!calendar.record.agenda?.items.length"
        class="py-4 text-muted"
      >
        {{ t('emptyAgenda') }}
      </p>
      <ol class="space-y-3">
        <li
          v-for="item in calendar.record.agenda?.items ?? []"
          :key="item.id"
          class="rounded border border-surface-dark bg-surface p-4"
        >
          <h3 class="text-lg font-semibold">
            {{ item.name }}
          </h3>
          <p
            class="mt-2 flex items-center gap-2 text-sm text-muted"
            :data-display-status="item.displayStatus"
          >
            <calendar-mark :kind="sessionMark(item.displayStatus)" />
            <span>{{ itemLabel(item) }} <time
              v-if="timed(item)"
              :datetime="item.time"
            >· {{ time(item.time) }}</time></span>
          </p>
          <p
            v-if="item.displayStatus === 'missed'"
            class="mt-2 text-sm text-muted"
          >
            {{ t(item.scheduleId ? 'logPastOccurrenceNote' : 'logPastWorkoutNote') }}
          </p>
          <p
            v-else-if="item.scheduleId"
            class="mt-2 text-sm text-muted"
          >
            {{ t('createOccurrenceNote') }}
          </p>
          <button
            v-if="item.scheduleId"
            type="button"
            :class="item.displayStatus === 'missed' ? 'secondary mt-3' : 'primary mt-3'"
            :disabled="disabled"
            @click="create(item.scheduleId, calendar.record.date)"
          >
            {{ t(item.displayStatus === 'missed' ? 'logPastWorkout' : 'createOccurrence') }}
          </button>
          <button
            v-else-if="item.displayStatus === 'missed'"
            type="button"
            class="secondary mt-3"
            :disabled="disabled"
            @click="navigate({ name: 'open_workout', arguments: { workoutId: item.id } })"
          >
            {{ t('logPastWorkout') }}
          </button>
          <button
            v-else
            type="button"
            class="secondary mt-3"
            :disabled="disabled"
            @click="navigate({ name: 'open_workout', arguments: { workoutId: item.id } })"
          >
            {{ t('viewWorkout') }}
          </button>
        </li>
      </ol>
    </section>
  </article>
</template>
