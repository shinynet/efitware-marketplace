<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ShareView } from './outcomeModel'
import ShareChart from './ShareChart.vue'
import type { createWorkoutConnection } from './workoutConnection'
const { share, disabled, navigate } = defineProps<{ share: ShareView, disabled: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'] }>()
const { t } = useI18n()
const copyState = ref('')
const options = computed(() => Object.entries(share.related.availableOptions).map(([key, value]) => ({ key: key as keyof ShareView['related']['availableOptions'], ...value })))
const change = (key: keyof ShareView['related']['availableOptions'], value: boolean) => navigate({ name: 'open_share', arguments: { request: { ...share.related.request, options: { ...share.related.request.options, [key]: value } } } }, true)
const copy = async () => { try { await navigator.clipboard.writeText(share.record.caption); copyState.value = 'copied' } catch { copyState.value = 'copyFailed' } }
</script>
<template>
  <section
    class="pb-6"
    aria-labelledby="share-heading"
  >
    <h1
      id="share-heading"
      class="font-serif text-3xl"
    >
      {{ t('outcomeUi.share') }}
    </h1><p class="my-4 text-sm text-muted">
      {{ t('outcomeUi.previewOnly') }}
    </p>
    <article
      class="rounded border border-surface-dark bg-surface p-5 sm:p-8"
      :lang="share.record.locale"
    >
      <header class="flex flex-wrap justify-between gap-3 text-xs uppercase tracking-widest text-gold-ink">
        <p>{{ share.record.eyebrow }}</p><p v-if="share.record.date">
          {{ share.record.date }}
        </p>
      </header><h2
        v-if="share.record.titleLines.length"
        class="mt-6 font-serif text-3xl leading-tight"
      >
        <span
          v-for="(line, index) in share.record.titleLines"
          :key="index"
          class="block"
        >{{ line }}</span>
      </h2><p class="mt-6 font-serif text-5xl sm:text-6xl">
        {{ share.record.hero.value }} <span
          v-if="share.record.hero.unit"
          class="text-xl text-muted"
        >{{ share.record.hero.unit }}</span>
      </p><p
        v-if="share.record.subline"
        class="mt-3 font-serif text-xl italic"
      >
        {{ share.record.subline }}
      </p><ShareChart
        v-if="share.record.chart"
        :chart="share.record.chart"
      /><dl class="my-6 grid gap-4 sm:grid-cols-2">
        <div
          v-for="(fact, index) in share.record.facts"
          :key="index"
        >
          <dt class="text-xs text-muted">
            {{ fact.label }}
          </dt><dd class="mt-1 text-xl">
            {{ fact.value }} <span
              v-if="fact.unit"
              class="text-sm text-muted"
            >{{ fact.unit }}</span>
          </dd>
        </div>
      </dl><footer class="flex flex-wrap justify-between gap-2 border-t border-surface-dark pt-4">
        <p class="font-serif text-xl italic">
          eFitware
        </p><p class="text-sm text-muted">
          efitware.com
        </p>
      </footer>
    </article>
    <fieldset
      :disabled="disabled"
      class="my-6"
    >
      <legend class="mb-3 font-semibold">
        {{ t('outcomeUi.options') }}
      </legend><label
        v-for="option in options"
        :key="option.key"
        class="flex min-h-11 items-center gap-3"
      ><input
        type="checkbox"
        :disabled="disabled || !option.enabled"
        :checked="share.related.request.options[option.key] ?? option.defaultValue"
        @change="change(option.key, ($event.target as HTMLInputElement).checked)"
      ><span>{{ t(`outcomeUi.${option.key}`) }}</span></label>
    </fieldset><h2 class="mb-2 font-semibold">
      {{ t('outcomeUi.caption') }}
    </h2><p
      class="whitespace-pre-wrap text-sm leading-relaxed"
      :lang="share.record.locale"
    >
      {{ share.record.caption }}
    </p><button
      class="secondary mt-4"
      type="button"
      @click="copy"
    >
      {{ t('outcomeUi.copyCaption') }}
    </button><p
      v-if="copyState"
      role="status"
      class="mt-2 text-sm"
    >
      {{ t(`outcomeUi.${copyState}`) }}
    </p>
  </section>
</template>
