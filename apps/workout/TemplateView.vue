<script setup lang="ts">
/** Saved-template prescription and explicit dated-workout creation. No session actuals. */
import { computed, ref } from 'vue'
import HostFollowUp from './HostFollowUp.vue'
import { useI18n } from 'vue-i18n'
import type { TemplateView } from './templateModel'
import { formatMeasure } from './presentation'
import { interleavedExerciseSequence } from './lib/sequenceUtils'
import { workoutSections } from './lib/sections'

const { template, disabled, create, followUp } = defineProps<{
  template: TemplateView, disabled: boolean,
  create: (date: string) => Promise<boolean | undefined> | undefined,
  followUp: (prompt: string) => Promise<'accepted' | 'unavailable' | 'rejected' | 'uncertain'>
}>()
const { t, locale } = useI18n()
const date = ref('')
const system = computed(() => template.presentation.unitSystem ?? 'metric')
const exerciseDetails = computed(() => new Map(template.related.exercises.map(exercise => [exercise.id, exercise])))
const missingExercises = computed(() => template.record.exercises.some(exercise => exerciseDetails.value.get(exercise.exerciseId)?.unavailable))
const instructions = (id: string) => {
  const exercise = exerciseDetails.value.get(id)
  return (locale.value === 'de' ? exercise?.instructionsDe ?? exercise?.instructions : exercise?.instructions) ?? []
}
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
// Reuse canonical ordering only; these derived flags are never rendered as logged results.
const sections = computed(() => workoutSections(template.record.exercises.map(ex => ({ ...ex,
  sets: ex.sets.map(set => ({ ...set, completed: false })),
  activities: ex.activities?.map(activity => ({ ...activity, completed: false }))
})), (template.record.activities ?? []).map(activity => ({ ...activity, completed: false }))))
</script>

<template>
  <article>
    <header class="mb-6">
      <p class="mb-2 text-xs font-semibold uppercase tracking-widest text-gold-ink">
        {{ t('reusableTemplate') }}
      </p>
      <h1 class="font-serif text-3xl leading-tight sm:text-4xl">
        {{ template.record.name }}
      </h1>
      <p
        v-if="template.record.description"
        class="mt-4 whitespace-pre-wrap text-sm leading-relaxed"
      >
        {{ template.record.description }}
      </p>
      <ul
        v-if="template.record.tags?.length"
        :aria-label="t('tags')"
        class="mt-3 flex flex-wrap gap-2"
      >
        <li
          v-for="tag in template.record.tags"
          :key="tag"
          class="rounded bg-surface px-3 py-1 text-sm"
        >
          {{ tag }}
        </li>
      </ul>
    </header>
    <section
      class="mb-6 rounded border border-surface-dark bg-surface p-4"
      aria-labelledby="template-use-title"
    >
      <h2
        id="template-use-title"
        class="font-serif text-xl"
      >
        {{ t('useTemplate') }}
      </h2>
      <p class="mt-2 text-sm text-muted">
        {{ t('templatePlannedOnly') }}
      </p>
      <fieldset
        class="mt-4 flex flex-wrap items-end gap-3"
        :disabled="disabled"
        aria-labelledby="template-use-title"
      >
        <label class="flex min-w-0 flex-col gap-2 text-sm">
          {{ t('workoutDate') }}
          <input
            v-model="date"
            type="date"
            required
            :disabled="disabled"
          >
        </label>
        <button
          type="button"
          class="primary"
          :disabled="disabled || !date || missingExercises"
          @click="create(date)"
        >
          {{ t('createDatedWorkout') }}
        </button>
      </fieldset>
      <host-follow-up
        :disabled
        :send="followUp"
        :request="t('templateAdaptPrompt', { id: template.record.id })"
      />
    </section>
    <p
      v-if="!sections.length"
      class="py-8 text-muted"
    >
      {{ t('emptyTemplate') }}
    </p>
    <section
      v-for="section in sections"
      :key="section.section"
      :aria-labelledby="`template-section-${section.section}`"
      class="mb-7"
    >
      <h2
        :id="`template-section-${section.section}`"
        class="mb-3 font-serif text-2xl"
      >
        {{ t(section.section) }}
      </h2>
      <template
        v-for="item in section.items"
        :key="item.data.id"
      >
        <article
          v-if="item.type === 'activity'"
          class="mb-3 rounded bg-surface p-4"
        >
          <h3 class="font-semibold">
            {{ item.data.title }}
          </h3>
          <p
            v-if="item.data.detail"
            class="mt-2 whitespace-pre-wrap text-sm"
          >
            {{ item.data.detail }}
          </p>
          <p
            v-if="item.data.notes"
            class="mt-2 whitespace-pre-wrap text-sm text-muted"
          >
            {{ item.data.notes }}
          </p>
          <p
            v-if="item.data.durationTarget !== undefined"
            class="mt-2 text-sm text-muted"
          >
            {{ formatMeasure('duration', item.data.durationTarget, system, locale) }}
          </p>
        </article>
        <details
          v-else
          class="exercise mb-3 rounded border border-surface-dark"
          open
        >
          <summary class="cursor-pointer px-4 py-4">
            <h3 class="inline font-semibold">
              {{ locale === 'de' ? (exerciseDetails.get(item.data.exerciseId)?.nameDe ?? item.data.exerciseName) : item.data.exerciseName }}
            </h3>
          </summary>
          <p
            v-if="item.data.comments"
            class="px-4 pb-3 whitespace-pre-wrap text-sm text-muted"
          >
            {{ item.data.comments }}
          </p>
          <p
            v-if="exerciseDetails.get(item.data.exerciseId)?.unavailable"
            class="px-4 pb-3 text-sm text-muted"
          >
            {{ t('missingTemplateExercise') }}
          </p>
          <ol
            v-if="instructions(item.data.exerciseId).length"
            class="list-decimal space-y-1 px-4 pb-4 pl-9 text-sm"
          >
            <li
              v-for="(instruction, position) in instructions(item.data.exerciseId)"
              :key="position"
            >
              {{ instruction }}
            </li>
          </ol>
          <ol class="px-4">
            <li
              v-for="entry in interleavedExerciseSequence(item.data.sets, item.data.activities ?? [])"
              :key="entry.type === 'set' ? entry.set.id : entry.activity.id"
              class="border-t border-surface-dark py-3"
            >
              <template v-if="entry.type === 'set'">
                <p class="font-semibold">
                  {{ t('set', { number: number(item.data.sets.findIndex(set => set.id === entry.set.id) + 1) }) }}
                </p>
                <p
                  v-if="entry.set.plannedReps"
                  class="mt-1 text-sm"
                >
                  {{ t('repTarget', { value: entry.set.plannedReps.min === entry.set.plannedReps.max ? number(entry.set.plannedReps.min) : t('range', { min: number(entry.set.plannedReps.min), max: number(entry.set.plannedReps.max) }) }) }}
                </p>
                <p
                  v-if="entry.set.plannedWeight !== undefined"
                  class="mt-1 text-sm"
                >
                  {{ formatMeasure('weight', entry.set.plannedWeight, system, locale) }}
                </p>
                <p
                  v-if="entry.set.plannedDuration !== undefined"
                  class="mt-1 text-sm"
                >
                  {{ formatMeasure('duration', entry.set.plannedDuration, system, locale) }}
                </p>
                <p
                  v-if="entry.set.plannedDistance !== undefined"
                  class="mt-1 text-sm"
                >
                  {{ formatMeasure('distance', entry.set.plannedDistance, system, locale) }}
                </p>
                <p
                  v-if="entry.set.restTarget !== undefined"
                  class="mt-1 text-sm text-muted"
                >
                  {{ t('rest', { value: formatMeasure('duration', entry.set.restTarget, system, locale) }) }}
                </p>
                <p
                  v-if="entry.set.rirTarget !== undefined"
                  class="mt-1 text-sm text-muted"
                >
                  {{ t('rir', { value: number(entry.set.rirTarget) }) }}
                </p>
                <p class="mt-1 text-sm text-muted">
                  {{ t(`setCategory.${entry.set.category}`) }}
                </p>
                <p
                  v-if="entry.set.plannedAmrap"
                  class="mt-1 text-sm"
                >
                  {{ t('amrapTarget') }}
                </p>
                <p
                  v-if="entry.set.plannedRpe !== undefined"
                  class="mt-1 text-sm"
                >
                  {{ t('rpeTarget', { value: number(entry.set.plannedRpe) }) }}
                </p>
                <p
                  v-if="entry.set.tempo"
                  class="mt-1 text-sm"
                >
                  {{ t('tempoTarget', { value: entry.set.tempo }) }}
                </p>
                <p
                  v-if="entry.set.side"
                  class="mt-1 text-sm"
                >
                  {{ t(`sideTarget.${entry.set.side}`) }}
                </p>
                <p
                  v-if="entry.set.comments"
                  class="mt-1 whitespace-pre-wrap text-sm text-muted"
                >
                  {{ entry.set.comments }}
                </p>
              </template>
              <template v-else>
                <h4 class="font-medium">
                  {{ entry.activity.title }}
                </h4>
                <p
                  v-if="entry.activity.detail"
                  class="mt-1 whitespace-pre-wrap text-sm"
                >
                  {{ entry.activity.detail }}
                </p>
                <p
                  v-if="entry.activity.notes"
                  class="mt-1 whitespace-pre-wrap text-sm text-muted"
                >
                  {{ entry.activity.notes }}
                </p>
                <p
                  v-if="entry.activity.durationTarget !== undefined"
                  class="mt-1 text-sm text-muted"
                >
                  {{ formatMeasure('duration', entry.activity.durationTarget, system, locale) }}
                </p>
              </template>
            </li>
          </ol>
        </details>
      </template>
    </section>
  </article>
</template>
