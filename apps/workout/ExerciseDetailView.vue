<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { exerciseName, type ExerciseView } from './contextModel'
import HostFollowUp from './HostFollowUp.vue'
import type { createWorkoutConnection } from './workoutConnection'
const { exercise, busy, canWrite, navigate, updateExercisePreference, sendFollowUp } = defineProps<{ exercise: ExerciseView, busy: boolean, canWrite: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'], updateExercisePreference: (patch: { isFavorite?: boolean, hiddenFromSearch?: boolean }) => unknown, sendFollowUp: ReturnType<typeof createWorkoutConnection>['sendFollowUp'] }>()
const { t, te, locale } = useI18n()
const record = computed(() => exercise.record)
const description = computed(() => locale.value === 'de' ? record.value.i18n?.de.description ?? record.value.description : record.value.description)
const instructions = computed(() => locale.value === 'de' ? record.value.i18n?.de.instructions ?? record.value.instructions : record.value.instructions)
const labelEquipment = (id: string) => exercise.related.customEquipment.find(item => item.id === id)?.name ?? (te(`contextVocabulary.equipment.${id}`) ? t(`contextVocabulary.equipment.${id}`) : id)
const lists = computed(() => [{ key: 'setup', rows: record.value.setupInstructions }, { key: 'instructions', rows: instructions.value }, { key: 'cues', rows: record.value.formCues }, { key: 'mistakes', rows: record.value.commonMistakes }, { key: 'contraindications', rows: record.value.contraindications }].filter(item => item.rows?.length))
const tracking = computed(() => ([['tracksWeight', 'weight'], ['tracksReps', 'reps'], ['tracksTime', 'time'], ['tracksDistance', 'distance'], ['tracksHr', 'hr'], ['tracksPace', 'pace'], ['tracksCadence', 'cadence'], ['tracksPower', 'power'], ['tracksElevation', 'elevation']] as const).filter(([flag]) => record.value[flag]).map(([, label]) => t(`contextUi.${label}`)))
</script>
<template>
  <article aria-labelledby="exercise-title">
    <p class="text-xs font-semibold uppercase tracking-wider text-gold-ink">
      {{ t(record.isCustom ? 'contextUi.customBadge' : 'contextUi.catalogBadge') }}
    </p>
    <h1
      id="exercise-title"
      class="mt-2 font-serif text-3xl"
    >
      {{ exerciseName(record, locale) }}
    </h1>
    <p
      v-if="record.archived"
      class="mt-2 text-gold-ink"
    >
      {{ t('contextUi.archived') }}
    </p>
    <p
      v-if="description"
      class="mt-5 whitespace-pre-wrap"
    >
      {{ description }}
    </p>
    <div class="my-5 flex flex-wrap gap-2">
      <button
        :disabled="!canWrite"
        type="button"
        :aria-pressed="record.isFavorite === true"
        class="rounded border border-surface-dark p-3 disabled:opacity-40"
        @click="updateExercisePreference({ isFavorite: !record.isFavorite })"
      >
        {{ t(record.isFavorite ? 'contextUi.unfavorite' : 'contextUi.favorite') }}
      </button><button
        :disabled="!canWrite"
        type="button"
        class="rounded border border-surface-dark p-3 disabled:opacity-40"
        @click="updateExercisePreference({ hiddenFromSearch: !record.isHidden })"
      >
        {{ t(record.isHidden ? 'contextUi.unhide' : 'contextUi.hide') }}
      </button>
    </div>
    <section
      v-if="record.equipmentRequired?.length"
      class="my-5 rounded bg-surface p-4"
    >
      <h2 class="mb-2 font-semibold">
        {{ t('contextUi.equipment') }}
      </h2><ul class="list-inside list-disc">
        <li
          v-for="id in record.equipmentRequired"
          :key="id"
        >
          {{ labelEquipment(id) }}
        </li>
      </ul><button
        :disabled="busy"
        type="button"
        class="mt-3 underline underline-offset-4"
        @click="navigate({ name: 'open_context', arguments: { section: 'equipment' } })"
      >
        {{ t('contextUi.equipmentContext') }}
      </button>
    </section>
    <section
      v-for="list in lists"
      :key="list.key"
      class="my-6"
    >
      <h2 class="mb-3 font-serif text-2xl">
        {{ t(`contextUi.${list.key}`) }}
      </h2><ol class="list-outside list-decimal space-y-2 pl-6">
        <li
          v-for="(text, index) in list.rows"
          :key="index"
          class="whitespace-pre-wrap"
        >
          {{ text }}
        </li>
      </ol>
    </section>
    <section
      v-if="record.breathingPattern"
      class="my-5"
    >
      <h2 class="font-semibold">
        {{ t('contextUi.breathing') }}
      </h2><p>{{ record.breathingPattern }}</p>
    </section>
    <section
      v-if="record.safetyNotes"
      class="my-5 rounded bg-surface p-4"
    >
      <h2 class="font-semibold">
        {{ t('contextUi.safety') }}
      </h2><p>{{ record.safetyNotes }}</p>
    </section>
    <section
      v-if="tracking.length"
      class="my-5"
    >
      <h2 class="mb-2 font-semibold">
        {{ t('contextUi.tracking') }}
      </h2><p>{{ new Intl.ListFormat(locale).format(tracking) }}</p>
    </section>
    <button
      type="button"
      :disabled="busy"
      class="mb-3 block rounded border border-surface-dark p-3"
      @click="navigate({ name: 'open_exercise_progress', arguments: { exerciseId: record.id } })"
    >
      {{ t('contextUi.history') }}
    </button>
    <HostFollowUp
      v-if="record.isCustom"
      :disabled="!canWrite"
      :label="'contextUi.askEdit'"
      :request="t('contextUi.followUp', { kind: t('contextUi.exercise'), id: record.id })"
      :send="sendFollowUp"
    />
  </article>
</template>
