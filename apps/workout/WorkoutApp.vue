<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import StatusView from './StatusView.vue'
import IntegrationView from './IntegrationView.vue'
import ReceiptsView from './ReceiptsView.vue'
import WorkoutReviewView from './WorkoutReviewView.vue'
import ShareView from './ShareView.vue'
import HostFollowUp from './HostFollowUp.vue'
import LibraryView from './LibraryView.vue'
import ExerciseDetailView from './ExerciseDetailView.vue'
import ContextView from './ContextView.vue'
import MemoryView from './MemoryView.vue'
import ExerciseProgressView from './ExerciseProgressView.vue'
import BodyMetricView from './BodyMetricView.vue'
import ProgressView from './ProgressView.vue'
import { resolveDisplayUnitSystem } from './presentation'
import TemplateView from './TemplateView.vue'
import GoalView from './GoalView.vue'
import GoalPlanView from './GoalPlanView.vue'
import ProgramView from './ProgramView.vue'
import ScheduleView from './ScheduleView.vue'
import CalendarView from './CalendarView.vue'
import WorkoutSetRow from './WorkoutSetRow.vue'
import { workoutSections } from './lib/sections'
import { interleavedExerciseSequence } from './lib/sequenceUtils'
import WorkoutActivityCard from './WorkoutActivityCard.vue'
import CompactCard from './CompactCard.vue'
import CompactActions from './CompactActions.vue'
import { appUrl, compactSummary } from './compactSummary'
import { createWorkoutConnection } from './workoutConnection'
import wordmark from './theme/efitware-wordmark.svg?url'
import wordmarkDark from './theme/efitware-wordmark-reversed.svg?url'

const connection = createWorkoutConnection()
const dirtyRows = ref(new Set<string>())
const leaving = ref(false)
const confirmingComplete = ref(false)
const setDirty = (id: string, dirty: boolean) => {
  if (dirty) dirtyRows.value.add(id)
  else dirtyRows.value.delete(id)
}
const returnToPreviousView = async (discard = false) => {
  if (dirtyRows.value.size && !discard) { leaving.value = true; return }
  await connection.back()
  leaving.value = false
}

const { route, backTarget, view, template, presentation, host, busy, error, saved, stale, pending, canWrite } = connection
const { t, te, locale } = useI18n()
const expanded = ref(false)
const checkInDraft = ref('')
// The compact card owns the draft while the goal view is unmounted; the goal view reports it once mounted.
watch(checkInDraft, draft => { if (!expanded.value) setDirty('goal-check-in', !!draft.trim()) })
const backLabel = computed(() => ({ open_status: 'outcomeUi.backStatus', open_integration: 'outcomeUi.backIntegration', open_receipts: 'outcomeUi.backReceipts', open_workout_review: 'outcomeUi.backReview', open_share: 'outcomeUi.backShare', open_library: 'contextUi.backLibrary', open_exercise: 'contextUi.backExercise', open_context: 'contextUi.backContext', open_memory: 'contextUi.backMemory', open_exercise_progress: 'progressUi.backExercise', open_body_metric: 'progressUi.backMetric', open_progress: 'progressUi.back', open_goal: 'backToGoal', open_goal_plan: 'backToGoalPlan', open_template: 'backToTemplate', open_program: 'backToProgram', open_schedule: 'backToSchedule', open_calendar: 'backToCalendar', open_workout: 'backToWorkout' })[backTarget.value?.name ?? 'open_workout'] ?? 'backToWorkout')
const refreshLabel = computed(() => workout.value ? 'refresh' : template.value ? 'templateRefresh' : 'recordRefresh')
const staleLabel = computed(() => workout.value ? 'stale' : template.value ? 'templateStale' : 'recordStale')
const system = computed(() => resolveDisplayUnitSystem(presentation.value?.unitSystem, locale.value))
const summary = computed(() => route.value ? compactSummary(route.value, { locale: locale.value, system: system.value, t, te }) : undefined)
watch(() => route.value?.view === 'goal' ? route.value.record.id : '', () => { checkInDraft.value = '' })
const workout = computed(() => view.value?.workout)
const sets = computed(() => workout.value?.exercises.flatMap(exercise => exercise.sets) ?? [])
const done = computed(() => sets.value.filter(set => set.completed).length)
const dark = computed(() => {
  const preference = presentation.value?.theme
  return preference && preference !== 'system' ? preference === 'dark' : host.value?.theme === 'dark'
})
watchEffect(() => {
  const language = presentation.value?.locale ?? host.value?.locale ?? navigator.language
  locale.value = language.toLowerCase().startsWith('de') ? 'de' : 'en'
  document.documentElement.lang = locale.value
  document.documentElement.classList.toggle('dark', dark.value)
  document.documentElement.classList.toggle('theme-cyanotype', presentation.value?.skin === 'cyanotype')
  document.documentElement.classList.toggle('theme-camellia', presentation.value?.skin === 'camellia')
})
const dateLabel = computed(() => workout.value ? new Intl.DateTimeFormat(locale.value, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${workout.value.date}T12:00:00Z`)) : '')
const sections = computed(() => workoutSections(workout.value?.exercises ?? [], workout.value?.activities ?? []))
const errorText = computed(() => {
  if (error.value === 'MCP_UNDO_CONFLICT') return t('outcomeUi.undoConflict')
  if (error.value === 'MCP_REVISION_CONFLICT') return t(staleLabel.value)
  if (error.value === 'CONNECTION_LOST') return t(pending.value ? 'lost' : 'unavailable')
  if (pending.value) return t('lost')
  if (error.value.startsWith('READ_FAILED')) return t(workout.value ? 'readFailed' : 'templateReadFailed')
  if (error.value === 'TOOLS_UNAVAILABLE') return t('unavailable')
  return t(workout.value ? 'failed' : template.value ? 'templateFailed' : 'recordFailed')
})
onMounted(connection.start)
onUnmounted(connection.close)
</script>

<template>
  <main
    class="mx-auto max-w-3xl bg-bg px-5 pb-4 pt-4 text-ink"
    :class="expanded ? 'sm:px-7 sm:pb-7' : ''"
  >
    <header class="mb-3 flex items-center justify-between gap-3 border-b border-surface-dark pb-2.5">
      <img
        :src="dark ? wordmarkDark : wordmark"
        alt="eFitware"
        class="h-auto w-24"
      >
      <button
        v-if="summary"
        type="button"
        class="link"
        @click="connection.open(appUrl(summary.path))"
      >
        {{ t('compact.open') }} ↗
      </button>
    </header>
    <p
      v-if="!route && !error"
      role="status"
    >
      {{ t('loading') }}
    </p>
    <aside
      v-if="error || stale"
      role="alert"
      class="mb-5 rounded border border-terracotta p-4"
    >
      <p>{{ error ? errorText : t(staleLabel) }}</p>
      <button
        v-if="pending"
        :disabled="busy"
        class="primary mt-3"
        @click="connection.retry()"
      >
        {{ t('retry') }}
      </button>
      <button
        v-else-if="route"
        :disabled="busy"
        class="secondary mt-3"
        @click="connection.refresh()"
      >
        {{ t(refreshLabel) }}
      </button>
    </aside>
    <nav
      v-if="backTarget"
      :aria-label="t('navigation')"
      class="mb-3"
    >
      <button
        :class="expanded ? 'secondary' : 'link'"
        :disabled="busy || !!pending || connection.needsReadback.value"
        @click="returnToPreviousView()"
      >
        <span aria-hidden="true">←</span> {{ t(backLabel) }}
      </button>
    </nav>
    <aside
      v-if="leaving"
      class="mb-4 rounded border border-terracotta p-4"
      role="alert"
    >
      <p>{{ t(backTarget?.name === 'open_template' ? 'leaveUnsaved' : 'leaveViewUnsaved') }}</p>
      <button
        class="secondary mt-3"
        @click="leaving = false"
      >
        {{ t('keepEditing') }}
      </button>
      <button
        class="secondary mt-3"
        :disabled="busy || !!pending"
        @click="returnToPreviousView(true)"
      >
        {{ t('discardAndBack') }}
      </button>
    </aside>
    <compact-card
      v-if="route && summary && !expanded"
      :summary
    >
      <template #action>
        <compact-actions
          v-model:check-in="checkInDraft"
          :route
          :can-write="canWrite"
          :busy
          :connection
          :locale
          :system
        />
      </template>
    </compact-card>
    <template v-if="expanded">
      <template-view
        v-if="template"
        :template
        :navigate="connection.navigate"
        :disabled="!canWrite"
        :create="connection.createFromTemplate"
        :follow-up="connection.sendFollowUp"
      />
      <exercise-progress-view
        v-if="route?.view === 'exercise-progress'"
        :exercise="route"
        :disabled="!canWrite"
        :navigate="connection.navigate"
        :follow-up="connection.sendFollowUp"
      />
      <StatusView
        v-if="route?.view === 'status'"
        :status="route"
        :disabled="!canWrite"
        :navigate="connection.navigate"
        :open-settings="connection.openSettings"
      />
      <IntegrationView
        v-if="route?.view === 'integration'"
        :integration="route"
        :disabled="!canWrite"
        :navigate="connection.navigate"
      />
      <ReceiptsView
        v-if="route?.view === 'receipts'"
        :receipts="route"
        :disabled="!canWrite"
        :navigate="connection.navigate"
        :undo="connection.undoReceipt"
      />
      <WorkoutReviewView
        v-if="route?.view === 'workout-review'"
        :key="route.record.id"
        :review="route"
        :disabled="!canWrite"
        :navigate="connection.navigate"
        :save="connection.saveCommentary"
        :remove="connection.removeCommentary"
        :follow-up="connection.sendFollowUp"
        @dirty="setDirty('commentary', $event)"
      />
      <ShareView
        v-if="route?.view === 'share'"
        :share="route"
        :disabled="!canWrite"
        :navigate="connection.navigate"
      />
      <LibraryView
        v-if="route?.view === 'library'"
        :library="route"
        :busy="busy"
        :navigate="connection.navigate"
        :send-follow-up="connection.sendFollowUp"
      />
      <ExerciseDetailView
        v-if="route?.view === 'exercise'"
        :exercise="route"
        :busy="busy"
        :can-write="canWrite"
        :navigate="connection.navigate"
        :update-exercise-preference="connection.updateExercisePreference"
        :send-follow-up="connection.sendFollowUp"
      />
      <ContextView
        v-if="route?.view === 'context'"
        :context="route"
        :busy="busy"
        :can-write="canWrite"
        :navigate="connection.navigate"
        :update-preference="connection.updatePreference"
        :make-default="connection.makeDefaultSpace"
        :send-follow-up="connection.sendFollowUp"
      />
      <MemoryView
        v-if="route?.view === 'memory'"
        :key="route.record.id"
        :memory="route"
        :can-write="canWrite"
        :save="connection.saveMemory"
        @dirty="setDirty('memory', $event)"
      />
      <body-metric-view
        v-if="route?.view === 'body-metric'"
        :metric="route"
        :disabled="!canWrite"
        :navigate="connection.navigate"
        :follow-up="connection.sendFollowUp"
      />
      <progress-view
        v-if="route?.view === 'progress'"
        :progress="route"
        :disabled="!canWrite"
        :navigate="connection.navigate"
        :follow-up="connection.sendFollowUp"
      />
      <goal-view
        v-if="route?.view === 'goal'"
        :key="route.record.id"
        v-model:draft="checkInDraft"
        :goal="route"
        :disabled="!canWrite"
        :saved
        :navigate="connection.navigate"
        :update="connection.updateGoal"
        :add-check-in="connection.addCheckIn"
        :follow-up="connection.sendFollowUp"
        @dirty="setDirty"
      />
      <goal-plan-view
        v-if="route?.view === 'goal-plan'"
        :plan="route"
        :disabled="!canWrite"
        :navigate="connection.navigate"
        :update="connection.updateGoalPlan"
        :follow-up="connection.sendFollowUp"
      />
      <program-view
        v-if="route?.view === 'program'"
        :program="route"
        :disabled="!canWrite"
        :navigate="connection.navigate"
        :update="connection.updatePlanning"
      />
      <schedule-view
        v-if="route?.view === 'schedule'"
        :schedule="route"
        :disabled="!canWrite"
        :navigate="connection.navigate"
        :update="connection.updatePlanning"
        :create="connection.createOccurrence"
      />
      <calendar-view
        v-if="route?.view === 'calendar'"
        :calendar="route"
        :disabled="!canWrite"
        :navigate="connection.navigate"
        :create="connection.createOccurrence"
      />
      <template v-if="workout">
        <header class="mb-6">
          <p class="mb-2 text-xs font-semibold uppercase tracking-widest text-gold-ink">
            {{ t(workout.status) }}
          </p>
          <h1 class="font-serif text-3xl leading-tight sm:text-4xl">
            {{ workout.title }}
          </h1>
          <time
            :datetime="workout.date"
            class="mt-2 block text-sm text-muted"
          >{{ dateLabel }}</time>
          <p
            v-if="workout.description"
            class="mt-4 whitespace-pre-wrap text-sm leading-relaxed"
          >
            {{ workout.description }}
          </p>
        </header>
        <div class="mb-5 flex flex-wrap gap-2">
          <button
            v-if="workout.status === 'planned'"
            type="button"
            class="primary"
            :disabled="!canWrite || !!dirtyRows.size"
            @click="connection.setWorkoutStatus('in_progress')"
          >
            {{ t('outcomeUi.startWorkout') }}
          </button>
          <button
            v-if="workout.status === 'planned' || workout.status === 'in_progress'"
            type="button"
            class="secondary"
            :disabled="!canWrite || !!dirtyRows.size"
            @click="confirmingComplete = true"
          >
            {{ t('outcomeUi.completeWorkout') }}
          </button>
          <button
            type="button"
            class="secondary"
            :disabled="!canWrite || !!dirtyRows.size"
            @click="connection.navigate({ name: 'open_workout_review', arguments: { workoutId: workout.id } })"
          >
            {{ t('outcomeUi.savedReview') }}
          </button>
          <button
            v-if="workout.status === 'completed'"
            type="button"
            class="secondary"
            :disabled="!canWrite || !!dirtyRows.size"
            @click="connection.navigate({ name: 'open_share', arguments: { request: { kind: 'workout_complete', workoutId: workout.id, locale, unitSystem: system, options: {} } } })"
          >
            {{ t('outcomeUi.prepareShare') }}
          </button>
        </div>
        <aside
          v-if="confirmingComplete && workout.status !== 'completed'"
          role="alert"
          class="mb-5 rounded border border-terracotta p-4"
        >
          <p>{{ t('outcomeUi.completeHint') }}</p><div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="primary"
              :disabled="!canWrite || !!dirtyRows.size"
              @click="connection.setWorkoutStatus('completed')"
            >
              {{ t('outcomeUi.confirmComplete') }}
            </button><button
              type="button"
              class="secondary"
              :disabled="busy"
              @click="confirmingComplete = false"
            >
              {{ t('outcomeUi.cancel') }}
            </button>
          </div>
        </aside>
        <section
          v-if="sets.length"
          class="mb-6 rounded bg-surface p-4"
          aria-labelledby="progress-title"
        >
          <h2
            id="progress-title"
            class="text-sm font-medium"
          >
            {{ t('sets', { done: new Intl.NumberFormat(locale).format(done), total: new Intl.NumberFormat(locale).format(sets.length) }) }}
          </h2>
          <progress
            :value="done"
            :max="sets.length"
            :aria-label="t('sets', { done, total: sets.length })"
            class="mt-2 h-1.5 w-full"
          />
          <p class="mt-3 text-xs leading-relaxed text-muted">
            {{ t('guidance') }}
          </p>
        </section>
        <p
          v-if="!sections.length"
          class="py-8 text-muted"
        >
          {{ t('empty') }}
        </p>
        <section
          v-for="section in sections"
          :key="section.section"
          :aria-labelledby="`section-${section.section}`"
          class="mb-7"
        >
          <h2
            :id="`section-${section.section}`"
            class="mb-3 font-serif text-2xl"
          >
            {{ t(section.section) }}
          </h2>
          <template
            v-for="item in section.items"
            :key="item.data.id"
          >
            <workout-activity-card
              v-if="item.type === 'activity'"
              :activity="item.data"
              :disabled="!canWrite"
              @save="connection.mutate('update_workout_activity', { activityId: item.data.id, patch: { completed: $event } })"
            />
            <details
              v-else
              class="exercise mb-3 rounded border border-surface-dark"
              open
            >
              <summary class="cursor-pointer px-4 py-4">
                <h3 class="inline font-semibold">
                  {{ locale === 'de' ? (view?.exercises.find(ex => ex.id === item.data.exerciseId)?.nameDe ?? item.data.exerciseName) : item.data.exerciseName }}
                </h3>
              </summary>
              <p
                v-if="item.data.comments"
                class="px-4 pb-3 whitespace-pre-wrap text-sm text-muted"
              >
                {{ item.data.comments }}
              </p>
              <p
                v-if="view?.exercises.find(ex => ex.id === item.data.exerciseId)?.unavailable"
                class="px-4 pb-3 text-sm text-muted"
              >
                {{ t('missing') }}
              </p>
              <ol class="px-4">
                <li
                  v-for="entry in interleavedExerciseSequence(item.data.sets, item.data.activities ?? [])"
                  :key="entry.type === 'set' ? entry.set.id : entry.activity.id"
                >
                  <workout-set-row
                    v-if="entry.type === 'set'"
                    :set="entry.set"
                    :number="item.data.sets.findIndex(set => set.id === entry.set.id) + 1"
                    :system
                    :tracking="view?.exercises.find(ex => ex.id === item.data.exerciseId)"
                    :disabled="!canWrite"
                    :save="patch => connection.mutate('log_sets', { entries: [{ weId: item.data.id, setId: entry.set.id, set: patch }] })"
                    @dirty="setDirty(entry.set.id, $event)"
                  />
                  <workout-activity-card
                    v-else
                    :activity="entry.activity"
                    :disabled="!canWrite"
                    @save="connection.mutate('update_workout_activity', { weId: item.data.id, activityId: entry.activity.id, patch: { completed: $event } })"
                  />
                </li>
              </ol>
            </details>
          </template>
        </section>
      </template>
      <HostFollowUp
        v-if="workout"
        :disabled="!canWrite || !!dirtyRows.size"
        label="outcomeUi.editWorkout"
        :request="t('outcomeUi.editWorkoutRequest', { id: workout.id })"
        :send="connection.sendFollowUp"
      />
      <button
        v-if="connection.lastReceipt.value && route?.view !== 'receipts'"
        type="button"
        class="secondary mb-5"
        :disabled="!canWrite || !!dirtyRows.size"
        @click="connection.navigate({ name: 'open_receipts', arguments: {} })"
      >
        {{ t('outcomeUi.lastReceipt') }}
      </button>
    </template>
    <footer
      v-if="route"
      class="mt-3 flex flex-wrap items-center justify-between gap-3"
      :class="expanded ? 'border-t border-surface-dark pt-4' : ''"
    >
      <p
        role="status"
        class="text-xs text-olive"
      >
        {{ busy ? t(pending ? 'saving' : 'loading') : saved ? t('saved') : '' }}
      </p>
      <div class="flex items-center gap-4">
        <button
          type="button"
          class="link"
          :disabled="busy || !!pending || (dirtyRows.has('goal-check-in') && !connection.needsReadback.value)"
          @click="connection.refresh()"
        >
          {{ t(expanded ? refreshLabel : 'compact.reload') }}
        </button>
        <button
          type="button"
          class="link"
          :aria-expanded="expanded"
          :disabled="expanded && !!dirtyRows.size"
          @click="expanded = !expanded"
        >
          {{ t(expanded ? 'compact.showLess' : 'compact.showMore') }}
        </button>
      </div>
    </footer>
  </main>
</template>
