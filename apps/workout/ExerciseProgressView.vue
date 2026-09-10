<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExerciseProgressView } from './focusedProgressModel'
import type { createWorkoutConnection } from './workoutConnection'
import { formatDay } from './planningModel'
import { resolveDisplayUnitSystem, formatMeasure } from './presentation'
import ProgressChart from './ProgressChart.vue'
import HostFollowUp from './HostFollowUp.vue'
const { exercise, disabled, navigate, followUp } = defineProps<{ exercise: ExerciseProgressView, disabled: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'], followUp: ReturnType<typeof createWorkoutConnection>['sendFollowUp'] }>()
const { t, locale } = useI18n()
const title = computed(() => exercise.record.i18n?.[locale.value]?.name ?? exercise.record.name)
const window = computed(() => exercise.related.progression.metadata)
const curve = computed(() => exercise.related.progression.data[0])
const system = computed(() => resolveDisplayUnitSystem(exercise.presentation.unitSystem, locale.value))
const number = (value: number) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value)
const weight = (value: number) => formatMeasure('weight', value, system.value, locale.value)
const select = (patch: Record<string, unknown>) => navigate({ name: 'open_exercise_progress', arguments: { exerciseId: exercise.record.id, range: window.value.range, today: window.value.today, collection: exercise.related.collection, page: 1, limit: exercise.related.limit, ...patch } }, true)
const openWorkout = (workoutId: string) => navigate({ name: 'open_workout', arguments: { workoutId } })
const request = computed(() => t('progressUi.exerciseExplain', { exerciseId: exercise.record.id, name: title.value, from: window.value.rangeStart, to: window.value.today }))
const rows = computed(() => exercise.related.collection === 'history' ? exercise.related.history : exercise.related.records)
</script>
<template>
  <article class="mb-6">
    <p class="text-xs font-semibold uppercase tracking-widest text-gold-ink">
      {{ t('progressUi.title') }}
    </p>
    <h1 class="mt-2 font-serif text-3xl sm:text-4xl">
      {{ title }}
    </h1>
    <p class="mt-3 text-sm">
      <time :datetime="window.rangeStart">{{ formatDay(window.rangeStart, locale) }}</time> {{ t('through') }} <time :datetime="window.today">{{ formatDay(window.today, locale) }}</time>
    </p>
    <fieldset
      :disabled
      class="my-5"
    >
      <legend class="mb-2 text-sm font-semibold">
        {{ t('progressUi.range') }}
      </legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="range in ['4w', '8w', '12w', '1y']"
          :key="range"
          class="secondary"
          :aria-pressed="window.range === range"
          @click="select({ range })"
        >
          {{ t(`progressUi.ranges.${range}`) }}
        </button>
      </div>
    </fieldset>
    <section
      aria-labelledby="all-time-title"
      class="rounded bg-surface p-4"
    >
      <h2
        id="all-time-title"
        class="text-sm font-semibold"
      >
        {{ t('progressUi.allTime') }}
      </h2>
      <dl class="mt-3 grid grid-cols-2 gap-4">
        <div>
          <dt class="text-sm text-muted">
            {{ t('progressUi.qualifyingSessions') }}
          </dt><dd class="mt-1 font-serif text-2xl">
            {{ number(exercise.related.stats.sessions) }}
          </dd>
        </div>
        <div>
          <dt class="text-sm text-muted">
            {{ t('progressUi.metrics.prs') }}
          </dt><dd class="mt-1 font-serif text-2xl">
            {{ number(exercise.related.stats.prCount) }}
          </dd>
        </div>
        <div
          v-if="exercise.related.stats.topSet"
          class="col-span-2"
        >
          <dt class="text-sm text-muted">
            {{ t('progressUi.heaviestSet') }}
          </dt><dd class="mt-1 text-xl">
            {{ number(exercise.related.stats.topSet.reps) }} × {{ weight(exercise.related.stats.topSet.weightKg) }}
          </dd><dd class="mt-1 text-xs">
            <time :datetime="exercise.related.stats.topSet.date">{{ formatDay(exercise.related.stats.topSet.date, locale) }}</time>
          </dd>
        </div>
      </dl>
    </section>
    <template v-if="curve?.unlocked">
      <progress-chart
        :title="t('progressUi.estimated')"
        :points="curve.series"
        :format="weight"
      />
      <p class="-mt-2 mb-5 text-xs text-muted">
        {{ t('progressUi.estimateNote') }}
      </p>
    </template>
    <p
      v-else-if="exercise.related.stats.progressionEligible !== false && exercise.record.modality === 'resistance'"
      class="my-5 text-sm text-muted"
    >
      {{ t('progressUi.locked', { count: number(curve?.sessionDates.length ?? 0), required: number(exercise.related.stats.unlockAt) }) }}
    </p>
    <nav
      :aria-label="t('progressUi.exerciseSections')"
      class="my-5 flex flex-wrap gap-2"
    >
      <button
        class="secondary"
        :disabled
        :aria-pressed="exercise.related.collection === 'history'"
        @click="select({ collection: 'history' })"
      >
        {{ t('progressUi.history') }}
      </button>
      <button
        class="secondary"
        :disabled
        :aria-pressed="exercise.related.collection === 'records'"
        @click="select({ collection: 'records' })"
      >
        {{ t('progressUi.recentPrs') }}
      </button>
    </nav>
    <p class="mb-3 text-xs text-muted">
      {{ t('progressUi.actualsNote') }}
    </p>
    <p
      v-if="!rows.length"
      class="py-5 text-muted"
    >
      {{ t('emptyCollection') }}
    </p>
    <ul
      v-if="exercise.related.collection === 'history'"
      class="space-y-4"
    >
      <li
        v-for="entry in exercise.related.history"
        :key="`${entry.workoutId}:${entry.instanceId}`"
        class="rounded border border-surface-dark p-4"
      >
        <h2 class="font-semibold">
          {{ entry.workoutTitle }}
        </h2>
        <time
          :datetime="entry.date"
          class="mt-1 block text-sm text-muted"
        >{{ formatDay(entry.date, locale) }}</time>
        <ol class="mt-3 divide-y divide-surface-dark">
          <li
            v-for="(set, index) in entry.sets"
            :key="set.id"
            class="py-3"
          >
            <p class="text-xs text-muted">
              {{ t('progressUi.set', { value: number(index + 1) }) }} · {{ t(`setCategory.${set.category}`) }}
            </p>
            <p class="mt-1 text-lg">
              <span v-if="set.weight !== undefined && set.weight !== null">{{ weight(set.weight) }} · </span>
              <span v-if="set.reps !== undefined && set.reps !== null">{{ t('progressUi.reps', { value: number(set.reps) }) }}</span>
              <span v-if="set.duration !== undefined && set.duration !== null">{{ formatMeasure('duration', set.duration, system, locale) }} </span>
              <span v-if="set.distance !== undefined && set.distance !== null">{{ formatMeasure('distance', set.distance, system, locale) }}</span>
              <span v-if="set.weight == null && set.reps == null && set.duration == null && set.distance == null">{{ t('progressUi.unavailable') }}</span>
            </p>
          </li>
        </ol>
        <button
          class="secondary mt-2"
          :disabled
          @click="openWorkout(entry.workoutId)"
        >
          {{ t('viewWorkout') }}
        </button>
      </li>
    </ul>
    <ul
      v-else
      class="space-y-3"
    >
      <li
        v-for="record in exercise.related.records"
        :key="`${record.workoutId}:${record.instanceId}:${record.setId}`"
        class="rounded border border-surface-dark p-4"
      >
        <time
          :datetime="record.date"
          class="block text-sm text-muted"
        >{{ formatDay(record.date, locale) }}</time>
        <p class="mt-2 text-xl">
          {{ record.reps === null ? t('progressUi.unavailable') : t('progressUi.reps', { value: number(record.reps) }) }} · {{ record.weightKg === null ? t('progressUi.unavailable') : weight(record.weightKg) }}
        </p>
        <p class="mt-1 text-sm text-muted">
          {{ new Intl.ListFormat(locale).format(record.prs.map(pr => t(`progressUi.prType.${pr.type}`))) }}
        </p>
        <button
          class="secondary mt-3"
          :disabled
          @click="openWorkout(record.workoutId)"
        >
          {{ t('viewWorkout') }}
        </button>
      </li>
    </ul>
    <nav
      :aria-label="t('pagination')"
      class="my-5 flex flex-wrap items-center gap-3"
    >
      <button
        class="secondary"
        :disabled="disabled || exercise.related.page === 1"
        @click="select({ page: exercise.related.page - 1 })"
      >
        {{ t('previous') }}
      </button>
      <p class="text-sm">
        {{ t('progressUi.page', { value: number(exercise.related.page) }) }}
      </p>
      <button
        class="secondary"
        :disabled="disabled || !rows.length || exercise.related.page >= 10000"
        @click="select({ page: exercise.related.page + 1 })"
      >
        {{ t('next') }}
      </button>
    </nav>
    <host-follow-up
      :disabled
      :request
      :send="followUp"
      label="progressUi.askExplain"
    />
  </article>
</template>
