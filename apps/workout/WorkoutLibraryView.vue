<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import HostFollowUp from './HostFollowUp.vue'
import WorkoutLibrarySession from './WorkoutLibrarySession.vue'
import type { LibraryBlock, LibraryFit, LibraryItem, LibraryItemRecord, LibrarySession, WorkoutLibraryView as LibraryCardView } from './workoutLibraryModel'
import { workoutLibraryArguments, workoutLibraryItemArguments } from './workoutLibraryModel'
import { fitLabel, fitLines, minutesLabel, spaceLabel, tagLine, vocabularyLabel, type LibraryTranslator } from './workoutLibraryPresentation'
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
/**
 * A Program variant with blocks (app EF-1603) shows each block: "Weeks 1–4 ·
 * Base", or "Your weeks" for a variant's only block, and an alternating block
 * a Week A / Week B switch. The week shown is card state only: switching
 * never calls the host or the application.
 */
const weekB = ref<Record<string, boolean>>({})
const showWeek = (key: string, b: boolean) => { weekB.value = { ...weekB.value, [key]: b } }
interface BlockView { key: string, heading: string, alternates: boolean, weekB: boolean, sessions: LibrarySession[] }
// keyed by item, variant and block, so another item never inherits a shown week
const blockViews = (itemId: string, variantId: string, blocks: LibraryBlock[]): BlockView[] => blocks.map((block) => {
  const key = `${itemId}/${variantId}/${block.id}`
  const alternates = block.rotation.length === 2
  const shownB = alternates && weekB.value[key] === true
  return {
    key, alternates, weekB: shownB,
    sessions: block.rotation[shownB ? 1 : 0] ?? [],
    // a variant's only block is the whole run and carries no label
    heading: blocks.length > 1 && block.label
      ? t('workoutLibraryUi.blockHeading', { from: number(block.startWeek + 1), to: number(block.startWeek + block.weeks), label: block.label })
      : t('workoutLibraryUi.yourWeeks')
  }
})
const sessionsOf = (item: LibraryItemRecord) => item.content.format === 'workout'
  ? [{ key: 'workout', heading: undefined as string | undefined, sessions: [item.content.session], blocks: undefined as BlockView[] | undefined }]
  : item.content.variants.map(variant => ({
      key: variant.id,
      heading: t('workoutLibraryUi.variant', { n: variant.daysPerWeek }, variant.daysPerWeek),
      sessions: variant.sessions,
      blocks: variant.blocks?.length ? blockViews(item.id, variant.id, variant.blocks) : undefined
    }))
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
          v-if="tagLine(translator, item.tags)"
          class="mt-2 text-xs text-muted"
        >
          {{ tagLine(translator, item.tags) }}
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
    <p
      v-if="tagLine(translator, record.tags)"
      class="mt-1 text-sm text-muted"
    >
      {{ tagLine(translator, record.tags) }}
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
      :key="group.key"
      class="mt-3"
    >
      <h3
        v-if="group.heading"
        class="text-sm font-semibold text-muted"
      >
        {{ group.heading }}
      </h3>
      <template v-if="group.blocks">
        <section
          v-for="block in group.blocks"
          :key="block.key"
          class="mt-3"
          :aria-labelledby="`library-block-${block.key}`"
        >
          <h4
            :id="`library-block-${block.key}`"
            class="font-serif text-xl italic"
          >
            {{ block.heading }}
          </h4>
          <template v-if="block.alternates">
            <p class="mt-1 text-sm text-muted">
              {{ t('workoutLibraryUi.alternates') }}
            </p>
            <div
              role="group"
              :aria-label="t('workoutLibraryUi.weekChoice', { block: block.heading })"
              class="mt-2 flex flex-wrap gap-2"
            >
              <button
                v-for="b in [false, true]"
                :key="String(b)"
                type="button"
                :aria-pressed="block.weekB === b"
                class="rounded border border-surface-dark px-3 py-2 aria-pressed:border-terracotta aria-pressed:ring-1 aria-pressed:ring-terracotta"
                @click="showWeek(block.key, b)"
              >
                {{ t(b ? 'workoutLibraryUi.weekB' : 'workoutLibraryUi.weekA') }}
              </button>
            </div>
          </template>
          <WorkoutLibrarySession
            v-for="session in block.sessions"
            :key="session.sessionId"
            :session="session"
            :translator="translator"
            :swapped-slots="swappedSlots"
            :heading-level="5"
          />
        </section>
      </template>
      <template v-else>
        <WorkoutLibrarySession
          v-for="session in group.sessions"
          :key="session.sessionId"
          :session="session"
          :translator="translator"
          :swapped-slots="swappedSlots"
        />
      </template>
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
