<script setup lang="ts">
/** Recurrence overview and explicit pause/resume or occurrence creation through existing MCP actions. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDay, type ScheduleView } from './planningModel'
import { summarizeRecurrence } from './recurrencePresentation'
import type { createWorkoutConnection } from './workoutConnection'
const { schedule, disabled, navigate, update, create } = defineProps<{
  schedule: ScheduleView, disabled: boolean,
  navigate: ReturnType<typeof createWorkoutConnection>['navigate'],
  update: ReturnType<typeof createWorkoutConnection>['updatePlanning'],
  create: ReturnType<typeof createWorkoutConnection>['createOccurrence']
}>()
const { t, locale } = useI18n()
const recurrence = computed(() => summarizeRecurrence(schedule.record.recurrence, locale.value, t))
</script>
<template>
  <article>
    <header class="mb-6">
      <p class="text-xs font-semibold uppercase tracking-widest text-gold-ink">
        {{ t('recurringSchedule') }}
      </p>
      <h1 class="mt-2 font-serif text-3xl sm:text-4xl">
        {{ schedule.record.name }}
      </h1>
      <p class="mt-3 text-lg">
        {{ recurrence }}
      </p>
      <p class="mt-2 text-sm text-muted">
        {{ t(schedule.record.enabled ? 'scheduleEnabled' : 'schedulePaused') }}
      </p>
    </header>
    <dl class="mb-6 space-y-3 rounded bg-surface p-4">
      <div>
        <dt class="text-sm text-muted">
          {{ t('starts') }}
        </dt><dd class="mt-1">
          <time :datetime="schedule.record.startDate">{{ formatDay(schedule.record.startDate, locale) }}</time>
        </dd>
      </div>
      <div>
        <dt class="text-sm text-muted">
          {{ t('ends') }}
        </dt><dd class="mt-1">
          <time :datetime="schedule.record.endDate">{{ formatDay(schedule.record.endDate, locale) }}</time>
        </dd>
      </div>
      <div>
        <dt class="text-sm text-muted">
          {{ t('nextOccurrence') }}
        </dt><dd class="mt-1">
          <time
            v-if="schedule.record.nextOccurrence"
            :datetime="schedule.record.nextOccurrence"
          >{{ formatDay(schedule.record.nextOccurrence, locale) }}</time><span v-else>{{ t('noOccurrence') }}</span>
        </dd>
      </div>
    </dl>
    <nav
      :aria-label="t('navigation')"
      class="mb-6 flex flex-wrap gap-3"
    >
      <button
        type="button"
        class="secondary"
        :disabled="disabled"
        @click="navigate({ name: 'open_template', arguments: { templateId: schedule.record.templateId } })"
      >
        {{ t('viewTemplate') }}
      </button>
      <button
        v-if="schedule.record.programId"
        type="button"
        class="secondary"
        :disabled="disabled"
        @click="navigate({ name: 'open_program', arguments: { programId: schedule.record.programId, today: schedule.related.today } })"
      >
        {{ t('viewProgram') }}
      </button>
    </nav>
    <section
      class="mb-6 rounded border border-surface-dark p-4"
      aria-labelledby="schedule-actions-title"
    >
      <h2
        id="schedule-actions-title"
        class="font-serif text-xl"
      >
        {{ t('manageSchedule') }}
      </h2>
      <p class="mt-2 text-sm text-muted">
        {{ t('scheduleActionNote') }}
      </p>
      <button
        type="button"
        class="secondary mt-3"
        :disabled="disabled"
        @click="update({ enabled: !schedule.record.enabled })"
      >
        {{ t(schedule.record.enabled ? 'pauseSchedule' : 'resumeSchedule') }}
      </button>
      <p
        v-if="schedule.record.enabled && schedule.record.nextOccurrence"
        class="mt-5 text-sm text-muted"
      >
        {{ t('createOccurrenceNote') }}
      </p>
      <button
        v-if="schedule.record.enabled && schedule.record.nextOccurrence"
        type="button"
        class="primary mt-3"
        :disabled="disabled"
        @click="create(schedule.record.id, schedule.record.nextOccurrence)"
      >
        {{ t('createOccurrence') }}
      </button>
    </section>
  </article>
</template>
