<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { exerciseName, type LibraryView } from './contextModel'
import HostFollowUp from './HostFollowUp.vue'
import type { createWorkoutConnection } from './workoutConnection'
const { library, busy, navigate, sendFollowUp } = defineProps<{ library: LibraryView, busy: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'], sendFollowUp: ReturnType<typeof createWorkoutConnection>['sendFollowUp'] }>()
const { t, locale } = useI18n()
const q = ref(library.record.query.q ?? '')
watch(() => library.record.query.q, value => { q.value = value ?? '' })
const search = (patch: Partial<LibraryView['record']['query']> = {}) => navigate({ name: 'open_library', arguments: { ...library.record.query, q: q.value.trim(), page: 1, ...patch } }, true)
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
</script>
<template>
  <section aria-labelledby="library-heading">
    <p class="text-xs font-semibold uppercase tracking-wider text-gold-ink">
      {{ t('contextUi.eyebrow') }}
    </p>
    <h1
      id="library-heading"
      class="mt-2 font-serif text-3xl"
    >
      {{ t('contextUi.library') }}
    </h1>
    <fieldset
      :disabled="busy"
      class="my-5"
    >
      <legend class="mb-2 font-semibold">
        {{ t('contextUi.search') }}
      </legend>
      <div class="flex gap-2">
        <input
          v-model="q"
          :aria-label="t('contextUi.search')"
          maxlength="200"
          class="min-w-0 flex-1 rounded border border-muted bg-bg p-3"
          @keydown.enter.prevent="search()"
        ><button
          class="rounded border border-terracotta px-4"
          type="button"
          @click="search()"
        >
          {{ t('contextUi.browse') }}
        </button>
      </div>
      <label class="mt-3 block"><span class="sr-only">{{ t('contextUi.anyModality') }}</span><select
        :value="library.record.query.modality ?? ''"
        class="w-full rounded border border-muted bg-bg p-3"
        @change="search({ modality: ($event.target as HTMLSelectElement).value as LibraryView['record']['query']['modality'] || undefined })"
      ><option value="">{{ t('contextUi.anyModality') }}</option><option
        v-for="mode in ['resistance', 'cardio', 'mobility']"
        :key="mode"
        :value="mode"
      >{{ t(`contextUi.${mode}`) }}</option></select></label>
    </fieldset>
    <nav
      :aria-label="t('contextUi.library')"
      class="mb-5 flex flex-wrap gap-2"
    >
      <button
        v-for="show in ['all', 'favorites', 'custom', 'hidden'] as const"
        :key="show"
        type="button"
        :disabled="busy"
        :aria-pressed="library.record.query.show === show"
        class="rounded border border-surface-dark px-3 py-2 aria-pressed:border-terracotta aria-pressed:ring-1 aria-pressed:ring-terracotta"
        @click="search({ show })"
      >
        {{ t(`contextUi.${show}`) }}
      </button>
    </nav>
    <p
      v-if="!library.related.exercises.data.length"
      class="my-8 text-muted"
    >
      {{ t('contextUi.empty') }}
    </p>
    <ul class="space-y-3">
      <li
        v-for="exercise in library.related.exercises.data"
        :key="exercise.id"
        class="rounded border border-surface-dark p-4"
      >
        <p class="text-xs text-muted">
          {{ t(`contextUi.${exercise.modality}`) }} · {{ t(exercise.isCustom ? 'contextUi.customBadge' : 'contextUi.catalogBadge') }}
        </p><h2 class="my-2 font-serif text-xl">
          <button
            class="text-left underline decoration-surface-dark underline-offset-4"
            :disabled="busy"
            @click="navigate({ name: 'open_exercise', arguments: { exerciseId: exercise.id } })"
          >
            {{ exerciseName(exercise, locale) }}
          </button>
        </h2><p
          v-if="exercise.summary"
          class="text-sm text-muted"
        >
          {{ locale === 'de' ? exercise.i18n?.de.summary ?? exercise.summary : exercise.summary }}
        </p>
      </li>
    </ul>
    <nav
      :aria-label="t('contextUi.page', { page: number(library.related.exercises.meta.page), total: number(library.related.exercises.meta.total) })"
      class="my-5 flex flex-wrap items-center justify-between gap-3"
    >
      <p class="w-full text-sm text-muted">
        {{ t('contextUi.page', { page: number(library.related.exercises.meta.page), total: number(library.related.exercises.meta.total) }) }}
      </p><button
        type="button"
        :disabled="busy || library.record.query.page <= 1"
        class="rounded border border-surface-dark px-3 py-2 disabled:opacity-40"
        @click="search({ page: library.record.query.page - 1 })"
      >
        {{ t('contextUi.previous') }}
      </button><button
        type="button"
        :disabled="busy || library.record.query.page * library.record.query.limit >= library.related.exercises.meta.total"
        class="rounded border border-surface-dark px-3 py-2 disabled:opacity-40"
        @click="search({ page: library.record.query.page + 1 })"
      >
        {{ t('contextUi.next') }}
      </button>
    </nav>
    <HostFollowUp
      :disabled="busy"
      :label="'contextUi.askCreate'"
      :request="t('contextUi.addFollowUp', { kind: t('contextUi.library') })"
      :send="sendFollowUp"
    />
  </section>
</template>
