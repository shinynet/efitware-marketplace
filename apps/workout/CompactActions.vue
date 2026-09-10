<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TrainingView } from './templateModel'
import { nextSet } from './compactSummary'
import type { createWorkoutConnection } from './workoutConnection'
type Connection = ReturnType<typeof createWorkoutConnection>
const { route, canWrite, busy, connection, locale, system } = defineProps<{ route: TrainingView, canWrite: boolean, busy: boolean, connection: Connection, locale: string, system: 'metric' | 'imperial' }>()
const { t } = useI18n()
const checkIn = ref('')
const copyState = ref<'' | 'copied' | 'copyFailed'>('')
const today = computed(() => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
const workout = computed(() => route.view === 'workout' ? route.record.workout : undefined)
const next = computed(() => workout.value ? nextSet(workout.value.exercises) : undefined)
const receipt = computed(() => route.view === 'receipts' ? route.record.data.find(row => row.undoable && !row.undoneAt) : undefined)
const submitCheckIn = async () => {
  if (route.view !== 'goal') return
  const value = checkIn.value.trim()
  if (await connection.addCheckIn({ date: route.related.today, ...(value ? { value } : {}) })) checkIn.value = ''
}
const copy = async () => {
  if (route.view !== 'share') return
  try { await navigator.clipboard.writeText(route.record.caption); copyState.value = 'copied' } catch { copyState.value = 'copyFailed' }
}
</script>
<template>
  <template v-if="workout">
    <button
      v-if="workout.status === 'planned' && !workout.exercises.some(exercise => exercise.sets.some(set => set.completed))"
      type="button"
      class="primary shrink-0"
      :disabled="!canWrite"
      @click="connection.setWorkoutStatus('in_progress')"
    >
      {{ t('compact.startWorkout') }}
    </button>
    <button
      v-else-if="next && workout.status !== 'completed'"
      type="button"
      class="primary shrink-0"
      :disabled="!canWrite"
      @click="connection.mutate('log_sets', { entries: [{ weId: next.exercise.id, setId: next.set.id, set: { completed: true } }] })"
    >
      {{ t('compact.markDone') }}
    </button>
    <button
      v-else-if="workout.status === 'planned' || workout.status === 'in_progress'"
      type="button"
      class="primary shrink-0"
      :disabled="!canWrite"
      @click="connection.setWorkoutStatus('completed')"
    >
      {{ t('compact.completeSession') }}
    </button>
    <button
      v-else-if="workout.status === 'completed'"
      type="button"
      class="secondary shrink-0"
      :disabled="!canWrite"
      @click="connection.navigate({ name: 'open_share', arguments: { request: { kind: 'workout_complete', workoutId: workout.id, locale, unitSystem: system, options: {} } } })"
    >
      {{ t('compact.sharePreview') }}
    </button>
  </template>
  <button
    v-else-if="route.view === 'template'"
    type="button"
    class="primary shrink-0"
    :disabled="!canWrite"
    @click="connection.createFromTemplate(today)"
  >
    {{ t('compact.createToday') }}
  </button>
  <button
    v-else-if="route.view === 'schedule' && route.record.nextOccurrence"
    type="button"
    class="primary shrink-0"
    :disabled="!canWrite"
    @click="connection.createOccurrence(route.record.id, route.record.nextOccurrence)"
  >
    {{ t('compact.createNext') }}
  </button>
  <button
    v-else-if="route.view === 'program' && route.related.supportsGoal"
    type="button"
    class="secondary shrink-0"
    :disabled="busy"
    @click="connection.navigate({ name: 'open_goal', arguments: { goalId: route.related.supportsGoal.id, today: route.related.today } })"
  >
    {{ t('compact.openGoal') }}
  </button>
  <button
    v-else-if="route.view === 'program' && route.related.schedules[0]"
    type="button"
    class="secondary shrink-0"
    :disabled="busy"
    @click="connection.navigate({ name: 'open_schedule', arguments: { scheduleId: route.related.schedules[0].id, today: route.related.today } })"
  >
    {{ t('compact.openSchedule') }}
  </button>
  <form
    v-else-if="route.view === 'goal' && route.record.status === 'active'"
    class="flex w-full items-stretch gap-2"
    @submit.prevent="submitCheckIn"
  >
    <label
      class="sr-only"
      for="compact-check-in"
    >{{ t('checkInValue') }}</label>
    <input
      id="compact-check-in"
      v-model="checkIn"
      class="min-w-0 flex-1 text-sm"
      :placeholder="t('compact.checkInPlaceholder')"
      :disabled="!canWrite"
    >
    <button
      type="submit"
      class="primary shrink-0"
      :disabled="!canWrite"
    >
      {{ t('compact.saveCheckIn') }}
    </button>
  </form>
  <button
    v-else-if="route.view === 'goal-plan'"
    type="button"
    class="secondary shrink-0"
    :disabled="busy"
    @click="connection.navigate({ name: 'open_goal', arguments: { goalId: route.record.goalId, today: route.related.today } })"
  >
    {{ t('compact.openGoal') }}
  </button>
  <button
    v-else-if="route.view === 'exercise'"
    type="button"
    class="secondary shrink-0"
    :disabled="!canWrite"
    :aria-pressed="!!route.record.isFavorite"
    @click="connection.updateExercisePreference({ isFavorite: !route.record.isFavorite })"
  >
    {{ t(route.record.isFavorite ? 'compact.removeFavorite' : 'compact.addFavorite') }}
  </button>
  <button
    v-else-if="route.view === 'status' && !route.record.onboardingComplete"
    type="button"
    class="primary shrink-0"
    @click="connection.openSettings(true)"
  >
    {{ t('compact.finishSetup') }}
  </button>
  <button
    v-else-if="receipt"
    type="button"
    class="secondary shrink-0"
    :disabled="!canWrite"
    @click="connection.undoReceipt(receipt.id)"
  >
    {{ t('compact.undoLatest') }}
  </button>
  <button
    v-else-if="route.view === 'workout-review'"
    type="button"
    class="secondary shrink-0"
    :disabled="busy"
    @click="connection.navigate({ name: 'open_workout', arguments: { workoutId: route.record.id } })"
  >
    {{ t('compact.openWorkout') }}
  </button>
  <button
    v-else-if="route.view === 'share'"
    type="button"
    class="secondary shrink-0"
    @click="copy"
  >
    {{ t(copyState ? `outcomeUi.${copyState}` : 'compact.copyCaption') }}
  </button>
</template>
