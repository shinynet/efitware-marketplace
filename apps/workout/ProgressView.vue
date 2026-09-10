<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProgressView } from './progressModel'
import type { createWorkoutConnection } from './workoutConnection'
import { formatDay } from './planningModel'
import { resolveDisplayUnitSystem, formatMeasure } from './presentation'
import ProgressChart from './ProgressChart.vue'
import ProgressBalance from './ProgressBalance.vue'
import ProgressMeasurements from './ProgressMeasurements.vue'
import HostFollowUp from './HostFollowUp.vue'
const { progress, disabled, navigate, followUp } = defineProps<{ progress: ProgressView, disabled: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'], followUp: ReturnType<typeof createWorkoutConnection>['sendFollowUp'] }>()
const { t, locale } = useI18n()
const ranges = ['4w', '8w', '12w', '1y'] as const
const sections = ['overview', 'strength', 'body', 'cardio', 'goals'] as const
const select = (patch: Record<string, unknown>) => navigate({ name: 'open_progress', arguments: { range: progress.record.range, today: progress.record.asOf, section: progress.related.section, page: 1, limit: 10, ...patch } }, true)
const meta = computed(() => progress.related.section === 'goals' ? progress.related.goals.meta : progress.related.progression.meta)
const number = (value: number) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value)
const weight = (value: number) => formatMeasure('weight', value, (resolveDisplayUnitSystem(progress.presentation.unitSystem, locale.value)), locale.value)
const delta = (value: number, kind: string) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1, signDisplay: 'exceptZero', ...(kind === 'percent' ? { style: 'percent' } as const : {}) }).format(value)
const day = (date: string) => navigate({ name: 'open_calendar', arguments: { from: date, to: date, date } })
const request = computed(() => t('progressUi.explain', { from: progress.record.rangeStart, to: progress.record.asOf, range: t(`progressUi.ranges.${progress.record.range}`) }))
</script>
<template>
  <article>
    <header class="mb-6">
      <p class="text-xs font-semibold uppercase tracking-widest text-gold-ink">
        {{ t('progressUi.eyebrow') }}
      </p>
      <h1 class="mt-2 font-serif text-3xl sm:text-4xl">
        {{ t('progressUi.title') }}
      </h1>
      <p class="mt-3 text-sm">
        <time :datetime="progress.record.rangeStart">{{ formatDay(progress.record.rangeStart, locale) }}</time> {{ t('through') }} <time :datetime="progress.record.asOf">{{ formatDay(progress.record.asOf, locale) }}</time>
      </p>
      <p class="mt-1 text-xs text-muted">
        {{ t('progressUi.window', { date: formatDay(progress.record.asOf, locale) }) }}
      </p>
    </header>
    <fieldset
      :disabled
      class="mb-4"
    >
      <legend class="mb-2 text-sm font-semibold">
        {{ t('progressUi.range') }}
      </legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="range in ranges"
          :key="range"
          class="secondary"
          :aria-pressed="progress.record.range === range"
          @click="select({ range })"
        >
          {{ t(`progressUi.ranges.${range}`) }}
        </button>
      </div>
    </fieldset>
    <nav
      :aria-label="t('progressUi.sections')"
      class="mb-6 flex flex-wrap gap-2"
    >
      <button
        v-for="section in sections"
        :key="section"
        :disabled
        class="secondary"
        :aria-pressed="progress.related.section === section"
        @click="select({ section })"
      >
        {{ t(`progressUi.${section}`) }}
      </button>
    </nav>
    <template v-if="progress.related.section === 'overview'">
      <dl class="grid grid-cols-2 gap-3">
        <div
          v-for="metric in progress.record.metrics"
          :key="metric.key"
          class="rounded bg-surface p-4"
        >
          <dt class="text-sm text-muted">
            {{ t(`progressUi.metrics.${metric.key}`) }}
          </dt>
          <dd class="mt-2 font-serif text-2xl sm:text-3xl">
            {{ metric.key === 'volume' ? weight(metric.value) : metric.key === 'avgRpe' && metric.value === 0 ? t('progressUi.unavailable') : number(metric.value) }}
          </dd>
          <dd class="mt-2 text-xs text-muted">
            {{ metric.delta === undefined ? t('progressUi.noComparison') : t('progressUi.previous', { value: delta(metric.delta, metric.deltaKind) }) }}
          </dd>
        </div>
      </dl>
      <progress-chart
        :title="t('progressUi.weeklyVolume')"
        :points="progress.record.weeklyVolume.map(week => ({ date: week.weekStart, value: week.volumeKg }))"
        :format="weight"
        bars
      />
      <p
        v-if="progress.record.weeklyVolume.some(week => week.inProgress)"
        class="-mt-2 mb-5 text-xs text-muted"
      >
        {{ t('progressUi.currentWeek') }}
      </p>
      <dl class="grid grid-cols-2 gap-4 rounded bg-surface p-4">
        <div>
          <dt class="text-sm text-muted">
            {{ t('progressUi.adherence') }}
          </dt><dd class="mt-2 text-xl">
            {{ progress.record.consistency.sessionsPlanned ? t('progressUi.adherenceValue', { done: number(progress.record.consistency.sessionsDone), planned: number(progress.record.consistency.sessionsPlanned) }) : t('progressUi.noPlan') }}
          </dd>
        </div>
        <div>
          <dt class="text-sm text-muted">
            {{ t('progressUi.streak') }}
          </dt><dd class="mt-2 font-serif text-3xl">
            {{ number(progress.record.consistency.streakWeeks) }}
          </dd>
        </div>
      </dl>
      <progress-chart
        :title="t('progressUi.heatmap')"
        :points="progress.record.consistency.heatmap.map(week => ({ date: week.weekStart, value: week.sets }))"
        :format="number"
        bars
      />
      <section
        class="mb-6"
        aria-labelledby="prs-title"
      >
        <h2
          id="prs-title"
          class="font-serif text-2xl"
        >
          {{ t('progressUi.recentPrs') }}
        </h2>
        <p class="my-2 text-xs text-muted">
          {{ t('progressUi.recentCap') }}
        </p>
        <p
          v-if="!progress.record.recentPrs.length"
          class="py-4 text-sm text-muted"
        >
          {{ t('progressUi.noPrs') }}
        </p>
        <ul class="space-y-3">
          <li
            v-for="pr in progress.record.recentPrs"
            :key="pr.id"
            class="rounded border border-surface-dark p-4"
          >
            <h3 class="font-semibold">
              {{ pr.i18n?.[locale]?.name ?? pr.exerciseName }}
            </h3>
            <p class="mt-2 text-lg">
              <span v-if="pr.weightKg !== undefined">{{ weight(pr.weightKg) }} · </span><span v-if="pr.reps !== undefined">{{ t('progressUi.reps', { value: number(pr.reps) }) }}</span><span v-if="pr.durationSeconds !== undefined">{{ formatMeasure('duration', pr.durationSeconds, (resolveDisplayUnitSystem(progress.presentation.unitSystem, locale)), locale) }}</span>
            </p>
            <time
              :datetime="pr.date"
              class="mt-1 block text-sm text-muted"
            >{{ formatDay(pr.date, locale) }}</time>
            <button
              class="secondary mt-3"
              :disabled
              @click="navigate({ name: 'open_workout', arguments: { workoutId: pr.workoutId } })"
            >
              {{ t('viewWorkout') }}
            </button>
          </li>
        </ul>
      </section>
    </template>
    <section
      v-if="progress.related.section === 'strength'"
      class="mb-6"
      aria-labelledby="strength-title"
    >
      <h2
        id="strength-title"
        class="font-serif text-2xl"
      >
        {{ t('progressUi.strength') }}
      </h2>
      <p class="mt-2 text-sm text-muted">
        {{ t('progressUi.estimateNote') }}
      </p>
      <progress-balance :progress />
      <p
        v-if="!progress.related.progression.data.length"
        class="py-4 text-muted"
      >
        {{ t('progressUi.noObservations') }}
      </p>
      <section
        v-for="exercise in progress.related.progression.data"
        :key="exercise.id"
        class="mt-5 rounded border border-surface-dark p-4"
      >
        <h3 class="text-lg font-semibold">
          {{ exercise.i18n?.[locale]?.name ?? exercise.name }}
        </h3>
        <p class="mt-2 text-sm">
          {{ t('progressUi.topSet', { reps: number(exercise.bestSetReps), weight: weight(exercise.bestSetWeightKg) }) }}
        </p>
        <button
          class="secondary mt-3"
          :disabled
          @click="navigate({ name: 'open_exercise_progress', arguments: { exerciseId: exercise.id, range: progress.record.range, today: progress.record.asOf } })"
        >
          {{ t('progressUi.viewExercise') }}
        </button>
        <progress-chart
          v-if="exercise.unlocked"
          :title="t('progressUi.estimated')"
          :points="exercise.series"
          :format="weight"
          :disabled
          source
          @select="day"
        />
        <p
          v-else
          class="mt-3 text-sm text-muted"
        >
          {{ t('progressUi.locked', { count: number(exercise.sessionDates.length), required: number(progress.record.unlockSessions) }) }}
        </p>
      </section>
    </section>
    <progress-measurements
      v-if="progress.related.section === 'body' || progress.related.section === 'cardio'"
      :progress
      :disabled
      :navigate
    />
    <section
      v-if="progress.related.section === 'goals'"
      class="mb-6"
      aria-labelledby="goals-title"
    >
      <h2
        id="goals-title"
        class="font-serif text-2xl"
      >
        {{ t('progressUi.goalEvidence') }}
      </h2>
      <p
        v-if="!progress.related.goals.data.length"
        class="py-4 text-muted"
      >
        {{ t('emptyCollection') }}
      </p>
      <ul class="mt-4 space-y-3">
        <li
          v-for="goal in progress.related.goals.data"
          :key="goal.id"
          class="rounded border border-surface-dark p-4"
        >
          <h3 class="text-lg font-semibold">
            {{ goal.name }}
          </h3>
          <p class="mt-1 text-sm text-muted">
            {{ t(`goalStatus.${goal.status}`) }} · {{ t('progressUi.checkIns', { value: number(goal.checkInCount) }) }}
          </p>
          <p
            v-if="goal.targetMeasure"
            class="mt-3"
          >
            {{ goal.targetMeasure }}
          </p>
          <p
            v-if="goal.latestCheckIn"
            class="mt-3 whitespace-pre-wrap text-sm"
          >
            <time :datetime="goal.latestCheckIn.date">{{ formatDay(goal.latestCheckIn.date, locale) }}</time> · {{ goal.latestCheckIn.value ?? goal.latestCheckIn.note }}
          </p>
          <p
            v-else
            class="mt-3 text-sm text-muted"
          >
            {{ t('progressUi.noGoalEvidence') }}
          </p>
          <button
            class="secondary mt-3"
            :disabled
            @click="navigate({ name: 'open_goal', arguments: { goalId: goal.id, today: progress.record.asOf } })"
          >
            {{ t('viewGoal') }}
          </button>
        </li>
      </ul>
    </section>
    <nav
      v-if="['strength', 'goals'].includes(progress.related.section) && meta.total > meta.limit"
      :aria-label="t('pagination')"
      class="mb-6 flex flex-wrap items-center gap-3"
    >
      <button
        class="secondary"
        :disabled="disabled || meta.page === 1"
        @click="select({ page: meta.page - 1, limit: meta.limit })"
      >
        {{ t('previous') }}
      </button>
      <p class="text-sm">
        {{ t('pageOf', { page: number(meta.page), total: number(Math.ceil(meta.total / meta.limit)) }) }}
      </p>
      <button
        class="secondary"
        :disabled="disabled || meta.page * meta.limit >= meta.total"
        @click="select({ page: meta.page + 1, limit: meta.limit })"
      >
        {{ t('next') }}
      </button>
    </nav>
    <aside class="mb-6 rounded bg-surface p-4">
      <p class="text-xs text-muted">
        {{ t('progressUi.readNote') }}
      </p>
      <host-follow-up
        :disabled
        :request
        :send="followUp"
        label="progressUi.askExplain"
      />
    </aside>
  </article>
</template>
