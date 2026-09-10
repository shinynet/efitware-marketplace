<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GoalView } from './goalModel'
import { formatDay } from './planningModel'
import HostFollowUp from './HostFollowUp.vue'
import type { createWorkoutConnection } from './workoutConnection'
const { goal, disabled, saved, navigate, update, addCheckIn, followUp } = defineProps<{
  goal: GoalView, disabled: boolean, saved: boolean,
  navigate: ReturnType<typeof createWorkoutConnection>['navigate'], update: ReturnType<typeof createWorkoutConnection>['updateGoal'],
  addCheckIn: ReturnType<typeof createWorkoutConnection>['addCheckIn'], followUp: ReturnType<typeof createWorkoutConnection>['sendFollowUp']
}>()
const emit = defineEmits<{ dirty: [id: string, dirty: boolean] }>()
const { t, locale } = useI18n()
const date = ref(goal.related.today)
const value = ref('')
const note = ref('')
const clear = () => { value.value = ''; note.value = ''; date.value = goal.related.today }
watch(() => saved, value => { if (value) clear() })
const dirty = computed(() => !!value.value || !!note.value || date.value !== goal.related.today)
watch(dirty, value => emit('dirty', 'goal-check-in', value))
onUnmounted(() => emit('dirty', 'goal-check-in', false))
const meta = computed(() => goal.related.checkIns.meta)
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const page = (page: number) => navigate({ name: 'open_goal', arguments: { goalId: goal.record.id, today: goal.related.today, page, limit: meta.value.limit } }, true)
const submit = async () => {
  if (!date.value || (!value.value.trim() && !note.value.trim())) return
  if (await addCheckIn({ date: date.value, ...(value.value.trim() ? { value: value.value.trim() } : {}), ...(note.value.trim() ? { note: note.value.trim() } : {}) })) clear()
}
</script>
<template>
  <article>
    <header class="mb-6">
      <p class="text-xs font-semibold uppercase tracking-widest text-gold-ink">
        {{ t('trainingGoal') }}
      </p>
      <h1 class="mt-2 font-serif text-3xl sm:text-4xl">
        {{ goal.record.name }}
      </h1>
      <p class="mt-2 text-sm text-muted">
        {{ t(`goalStatus.${goal.record.status}`) }}
      </p>
    </header>
    <dl class="mb-6 space-y-4 rounded bg-surface p-4">
      <div v-if="goal.record.targetMeasure">
        <dt class="text-sm text-muted">
          {{ t('goalTarget') }}
        </dt><dd class="mt-1 text-lg">
          {{ goal.record.targetMeasure }}
        </dd>
      </div>
      <div v-if="goal.record.targetDate">
        <dt class="text-sm text-muted">
          {{ t('targetDate') }}
        </dt><dd class="mt-1">
          <time :datetime="goal.record.targetDate">{{ formatDay(goal.record.targetDate, locale) }}</time>
        </dd>
      </div>
      <div v-if="goal.record.nextCheckInDate">
        <dt class="text-sm text-muted">
          {{ t('nextCheckIn') }}
        </dt><dd class="mt-1">
          <time :datetime="goal.record.nextCheckInDate">{{ formatDay(goal.record.nextCheckInDate, locale) }}</time>
        </dd>
      </div>
      <div>
        <dt class="text-sm text-muted">
          {{ t('checkIns') }}
        </dt><dd class="mt-1 font-serif text-2xl">
          {{ number(goal.related.checkInCount) }}
        </dd>
      </div>
    </dl>
    <nav
      :aria-label="t('navigation')"
      class="mb-6 space-y-3"
    >
      <button
        v-if="goal.related.coachPlan"
        type="button"
        class="primary"
        :disabled="disabled || dirty"
        @click="navigate({ name: 'open_goal_plan', arguments: { planId: goal.related.coachPlan.id, today: goal.related.today } })"
      >
        {{ t('viewGoalPlan') }}
      </button>
      <ul class="space-y-2">
        <li
          v-for="program in goal.related.programs"
          :key="program.id"
        >
          <button
            type="button"
            class="secondary text-left"
            :disabled="disabled || dirty"
            @click="navigate({ name: 'open_program', arguments: { programId: program.id, today: goal.related.today } })"
          >
            {{ program.name }}
          </button>
        </li>
      </ul>
    </nav>
    <section
      class="mb-6"
      aria-labelledby="goal-check-in-title"
    >
      <h2
        id="goal-check-in-title"
        class="font-serif text-2xl"
      >
        {{ t('recordCheckIn') }}
      </h2>
      <p class="mt-2 text-sm text-muted">
        {{ t('checkInEvidenceNote') }}
      </p>
      <fieldset
        class="mt-4 space-y-3"
        :disabled
      >
        <label class="block text-sm">{{ t('checkInDate') }}<input
          v-model="date"
          type="date"
          class="mt-2 block w-full rounded border border-muted bg-bg p-3 text-ink"
          required
        ></label>
        <label class="block text-sm">{{ t('checkInValue') }}<input
          v-model="value"
          type="text"
          maxlength="120"
          class="mt-2 block w-full rounded border border-muted bg-bg p-3 text-ink"
        ></label>
        <label class="block text-sm">{{ t('checkInNote') }}<textarea
          v-model="note"
          maxlength="2000"
          rows="3"
          class="mt-2 block w-full rounded border border-muted bg-bg p-3 text-ink"
        /></label>
        <button
          type="button"
          class="primary"
          :disabled="!date || (!value.trim() && !note.trim())"
          @click="submit"
        >
          {{ t('saveCheckIn') }}
        </button>
        <button
          v-if="dirty"
          type="button"
          class="secondary"
          @click="clear"
        >
          {{ t('discardCheckIn') }}
        </button>
      </fieldset>
      <p
        v-if="dirty"
        class="mt-3 text-sm text-muted"
      >
        {{ t('finishCheckIn') }}
      </p>
    </section>
    <section
      class="mb-6"
      aria-labelledby="goal-history-title"
    >
      <h2
        id="goal-history-title"
        class="mb-3 font-serif text-2xl"
      >
        {{ t('checkInHistory') }}
      </h2>
      <ol class="space-y-3">
        <li
          v-for="entry in goal.related.checkIns.data"
          :key="entry.id"
          class="rounded border border-surface-dark p-4"
        >
          <time
            :datetime="entry.date"
            class="text-sm text-muted"
          >{{ formatDay(entry.date, locale) }}</time>
          <p
            v-if="entry.value"
            class="mt-2 font-semibold"
          >
            {{ entry.value }}
          </p><p
            v-if="entry.note"
            class="mt-2 whitespace-pre-wrap text-sm"
          >
            {{ entry.note }}
          </p>
        </li>
      </ol>
      <p
        v-if="!goal.related.checkIns.data.length"
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
          :disabled="disabled || dirty || meta.page <= 1"
          @click="page(meta.page - 1)"
        >
          {{ t('previous') }}
        </button>
        <p class="text-sm">
          {{ t('pageOf', { page: number(meta.page), total: number(Math.max(1, Math.ceil(meta.total / meta.limit))) }) }}
        </p>
        <button
          type="button"
          class="secondary"
          :disabled="disabled || dirty || meta.page * meta.limit >= meta.total"
          @click="page(meta.page + 1)"
        >
          {{ t('next') }}
        </button>
      </nav>
    </section>
    <section
      class="rounded bg-surface p-4"
      aria-labelledby="goal-status-title"
    >
      <h2
        id="goal-status-title"
        class="font-serif text-xl"
      >
        {{ t('manageGoal') }}
      </h2><p class="mt-2 text-sm text-muted">
        {{ t('goalStatusNote') }}
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="status in (['active', 'achieved', 'abandoned'] as const).filter(status => status !== goal.record.status)"
          :key="status"
          type="button"
          class="secondary"
          :disabled="disabled || dirty"
          @click="update(status)"
        >
          {{ t(`setGoalStatus.${status}`) }}
        </button>
      </div>
      <host-follow-up
        :key="goal.record.id"
        :disabled="disabled || dirty"
        :send="followUp"
        :request="t('goalAdaptPrompt', { id: goal.record.id })"
      />
    </section>
  </article>
</template>
