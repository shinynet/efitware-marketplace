<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import HostFollowUp from './HostFollowUp.vue'
import type { LibraryFit, LibraryItem, LibraryItemRecord, WorkoutLibraryView as LibraryCardView } from './workoutLibraryModel'
import { workoutLibraryArguments, workoutLibraryItemArguments } from './workoutLibraryModel'
import { fitLabel, fitLines, minutesLabel, prescriptionLine, spaceLabel, vocabularyLabel, type LibraryTranslator } from './workoutLibraryPresentation'
import type { createWorkoutConnection } from './workoutConnection'

/**
 * The workout Library card (EF-1607): browse results or one item, read-only.
 * Paging and opening an item reuse `open_workout_library`; preparing and
 * saving stay with the user's AI, which previews and explains swaps first.
 */
const { library, busy, navigate, sendFollowUp } = defineProps<{
  library: LibraryCardView
  busy: boolean
  navigate: ReturnType<typeof createWorkoutConnection>['navigate']
  sendFollowUp: ReturnType<typeof createWorkoutConnection>['sendFollowUp']
}>()
const { t, te, locale } = useI18n()
const translator = computed<LibraryTranslator>(() => ({ t: t as LibraryTranslator['t'], te, locale: locale.value }))
const record = computed(() => library.record)
const space = computed(() => spaceLabel(translator.value, record.value.trainingSpace))
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const go = (patch: Record<string, unknown>, replace = false) => navigate({ name: 'open_workout_library', arguments: workoutLibraryArguments(record.value, patch) }, replace)
const open = (item: LibraryItem) => {
  if (record.value.mode === 'browse') navigate({ name: 'open_workout_library', arguments: workoutLibraryItemArguments(record.value, item) })
}
const badgeClass = (fit: LibraryFit) => ({
  'exact': 'border-olive',
  'adaptable': 'border-gold-ink',
  'unavailable': 'border-surface-dark text-muted',
  'needs-space': 'border-terracotta'
})[fit.state]
const sessionsOf = (item: LibraryItemRecord) => item.content.format === 'workout'
  ? [{ heading: undefined as string | undefined, sessions: [item.content.session] }]
  : item.content.variants.map(variant => ({ heading: t('workoutLibraryUi.variant', { n: variant.daysPerWeek }, variant.daysPerWeek), sessions: variant.sessions }))
const swappedSlots = computed(() => new Set(record.value.mode === 'item' && record.value.fit.state === 'adaptable' ? record.value.fit.swaps.map(swap => swap.slotId) : []))
const facts = (item: { format: string, sessionMinutes: { min: number, max: number }, supportedDays: number[], defaultWeeks?: number }, withFormat = true) => [
  ...(withFormat ? [vocabularyLabel(translator.value, 'format', item.format)] : []),
  minutesLabel(translator.value, item.sessionMinutes),
  ...(item.defaultWeeks ? [t('workoutLibraryUi.weeks', { n: number(item.defaultWeeks) }, item.defaultWeeks)] : [])
]
</script>

<template>
  <section
    v-if="record.mode === 'browse'"
    class="pb-6"
    aria-labelledby="workout-library-heading"
  >
    <p class="text-xs font-semibold uppercase tracking-wider text-gold-ink">
      {{ t('workoutLibraryUi.eyebrow') }}
    </p>
    <h1
      id="workout-library-heading"
      class="mt-2 font-serif text-3xl"
    >
      {{ t('workoutLibraryUi.browseTitle') }}
    </h1>
    <p class="mt-2 text-sm text-muted">
      {{ t('workoutLibraryUi.browseIntro', { space }) }}
    </p>
    <p
      v-if="record.trainingSpace.equipment === 'unconfigured'"
      class="mt-4 rounded border border-terracotta p-3 text-sm"
    >
      {{ t('workoutLibraryUi.needsSpace', { space }) }}
    </p>
    <p
      v-if="!record.data.length"
      class="my-8 text-muted"
    >
      {{ t('workoutLibraryUi.empty') }}
    </p>
    <ul class="mt-5 space-y-3">
      <li
        v-for="item in record.data"
        :key="item.id"
        class="rounded border border-surface-dark p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-muted">
            {{ facts(item).join(' · ') }}
          </p>
          <span
            class="rounded-full border px-2 py-0.5 text-xs font-semibold"
            :class="badgeClass(item.fit)"
          >{{ fitLabel(translator, item.fit) }}</span>
        </div>
        <h2 class="my-2 font-serif text-xl">
          <button
            type="button"
            class="title-link"
            :aria-label="t('workoutLibraryUi.view', { title: item.title })"
            :disabled="busy"
            @click="open(item)"
          >
            {{ item.title }}
          </button>
        </h2>
        <p class="text-sm">
          {{ item.summary }}
        </p>
        <p
          v-for="line in fitLines(translator, item.fit)"
          :key="line"
          class="mt-2 text-sm text-muted"
        >
          {{ line }}
        </p>
      </li>
    </ul>
    <nav
      :aria-label="t('workoutLibraryUi.page', { page: number(record.meta.page), total: number(record.meta.total) })"
      class="my-5 flex flex-wrap items-center justify-between gap-3"
    >
      <p class="w-full text-sm text-muted">
        {{ t('workoutLibraryUi.page', { page: number(record.meta.page), total: number(record.meta.total) }) }}
      </p>
      <button
        type="button"
        class="secondary"
        :disabled="busy || record.query.page <= 1"
        @click="go({ page: record.query.page - 1 }, true)"
      >
        {{ t('workoutLibraryUi.previous') }}
      </button>
      <button
        type="button"
        class="secondary"
        :disabled="busy || record.query.page * record.query.limit >= record.meta.total"
        @click="go({ page: record.query.page + 1 }, true)"
      >
        {{ t('workoutLibraryUi.next') }}
      </button>
    </nav>
  </section>

  <article
    v-else
    class="pb-6"
    aria-labelledby="workout-library-item-heading"
  >
    <p class="text-xs font-semibold uppercase tracking-wider text-gold-ink">
      {{ t('workoutLibraryUi.itemEyebrow', { format: vocabularyLabel(translator, 'format', record.format) }) }}
    </p>
    <h1
      id="workout-library-item-heading"
      class="mt-2 font-serif text-3xl"
    >
      {{ record.title }}
    </h1>
    <p class="mt-1 text-sm text-muted">
      {{ facts(record, false).join(' · ') }}
    </p>
    <p class="mt-3">
      {{ record.description }}
    </p>
    <section
      class="mt-5 rounded border border-surface-dark p-4"
      aria-labelledby="workout-library-fit"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="workout-library-fit"
          class="font-semibold"
        >
          {{ t('workoutLibraryUi.fitFor', { space }) }}
        </h2>
        <span
          class="rounded-full border px-2 py-0.5 text-xs font-semibold"
          :class="badgeClass(record.fit)"
        >{{ fitLabel(translator, record.fit) }}</span>
      </div>
      <p
        v-if="record.fit.state === 'needs-space'"
        class="mt-2 text-sm"
      >
        {{ t('workoutLibraryUi.needsSpace', { space }) }}
      </p>
      <ul
        v-else
        class="mt-2 space-y-1 text-sm"
      >
        <li
          v-for="line in fitLines(translator, record.fit)"
          :key="line"
        >
          {{ line }}
        </li>
      </ul>
    </section>
    <h2 class="mt-5 font-semibold">
      {{ t('workoutLibraryUi.suits') }}
    </h2>
    <p class="mt-1 text-sm">
      {{ record.suitability }}
    </p>
    <h2 class="mt-5 font-semibold">
      {{ t('workoutLibraryUi.sessionList') }}
    </h2>
    <div
      v-for="group in sessionsOf(record)"
      :key="group.heading ?? 'workout'"
      class="mt-3"
    >
      <h3
        v-if="group.heading"
        class="text-sm font-semibold text-muted"
      >
        {{ group.heading }}
      </h3>
      <section
        v-for="session in group.sessions"
        :key="session.sessionId"
        class="mt-2 rounded border border-surface-dark p-4"
      >
        <h4 class="font-serif text-lg">
          {{ session.name }}
        </h4>
        <p class="text-xs text-muted">
          {{ minutesLabel(translator, { min: session.estimatedMinutes, max: session.estimatedMinutes }) }}
        </p>
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
    </div>
    <p
      v-if="record.format === 'program'"
      class="mt-5 text-sm text-muted"
    >
      {{ t('workoutLibraryUi.programNote') }}
    </p>
    <HostFollowUp
      v-else-if="record.fit.state === 'exact' || record.fit.state === 'adaptable'"
      :disabled="busy"
      label="workoutLibraryUi.askPrepare"
      :request="t('workoutLibraryUi.prepareRequest', { title: record.title, id: record.id, space })"
      :send="sendFollowUp"
    />
  </article>
</template>
