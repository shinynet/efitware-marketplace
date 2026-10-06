<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LibrarySession } from './workoutLibraryModel'
import { minutesLabel, prescriptionLine, timedFormatLabel, type LibraryTranslator } from './workoutLibraryPresentation'

/** One Library session in the item view: its name, length and each exercise with its set summary. */
const { session, translator, swappedSlots, headingLevel = 4 } = defineProps<{
  session: LibrarySession
  translator: LibraryTranslator
  swappedSlots: ReadonlySet<string>
  headingLevel?: 4 | 5
}>()
const { t } = useI18n()
const timedFormats = computed(() => (session.executionGroups ?? []).flatMap(group => group.format ? [timedFormatLabel(translator, group.format)] : []))
</script>

<template>
  <section class="mt-2 rounded border border-surface-dark p-4">
    <component
      :is="`h${headingLevel}`"
      class="font-serif text-lg"
    >
      {{ session.name }}
    </component>
    <p class="text-xs text-muted">
      {{ minutesLabel(translator, { min: session.estimatedMinutes, max: session.estimatedMinutes }) }}
    </p>
    <ul
      v-if="timedFormats.length"
      class="mt-2 space-y-1 text-sm text-muted"
      :aria-label="t('workoutLibraryUi.timedFormats')"
    >
      <li
        v-for="(label, index) in timedFormats"
        :key="index"
      >
        {{ label }}
      </li>
    </ul>
    <ol class="mt-2 space-y-1 text-sm">
      <li
        v-for="slot in session.slots"
        :key="slot.slotId"
        class="flex flex-wrap justify-between gap-x-3"
      >
        <span>{{ slot.name ?? t('workoutLibraryUi.anExercise') }}<span
          v-if="swappedSlots.has(slot.slotId)"
          class="ml-2 text-xs text-gold-ink"
        >{{ t('workoutLibraryUi.swapped') }}</span></span>
        <span class="ml-auto text-muted">{{ prescriptionLine(translator, slot.prescription.sets) }}</span>
      </li>
    </ol>
  </section>
</template>
