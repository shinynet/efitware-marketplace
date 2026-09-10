<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ContextView } from './contextModel'
import ContextBody from './ContextBody.vue'
import ContextProfile from './ContextProfile.vue'
import ContextSpaces from './ContextSpaces.vue'
import HostFollowUp from './HostFollowUp.vue'
import type { createWorkoutConnection } from './workoutConnection'
const { context, busy, canWrite, navigate, updatePreference, makeDefault, sendFollowUp } = defineProps<{ context: ContextView, busy: boolean, canWrite: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'], updatePreference: (patch: { unitSystem?: 'metric' | 'imperial', theme?: 'system' | 'light' | 'dark' }) => unknown, makeDefault: (id: string) => unknown, sendFollowUp: ReturnType<typeof createWorkoutConnection>['sendFollowUp'] }>()
const { t, te, locale } = useI18n()
const section = computed(() => context.related.section)
const go = (section: ContextView['related']['section'], page = 1) => navigate({ name: 'open_context', arguments: { section, page, limit: context.related.memories.meta.limit } }, true)
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const label = (namespace: string, value: string) => te(`${namespace}.${value}`) ? t(`${namespace}.${value}`) : value
const fields = computed(() => [ { label: 'language', value: new Intl.DisplayNames(locale.value, { type: 'language' }).of(context.record.context.locale) ?? context.record.context.locale }, { label: 'weekStart', value: t(`contextUi.${context.record.context.weekStart}`) }, { label: 'skin', value: t(`contextUi.${context.record.preferences.skin ?? 'calm'}`) } ])
</script>
<template>
  <section
    class="pb-6"
    aria-labelledby="context-heading"
  >
    <p class="text-xs font-semibold uppercase tracking-wider text-gold-ink">
      {{ t('contextUi.eyebrow') }}
    </p><h1
      id="context-heading"
      class="mt-2 font-serif text-3xl"
    >
      {{ t('contextUi.context') }}
    </h1>
    <nav
      :aria-label="t('contextUi.context')"
      class="my-5 flex flex-wrap gap-2"
    >
      <button
        v-for="tab in ['profile', 'health', 'equipment', 'spaces', 'preferences', 'memories'] as const"
        :key="tab"
        type="button"
        :disabled="busy"
        :aria-pressed="section === tab"
        class="rounded border border-surface-dark px-3 py-2 aria-pressed:border-terracotta aria-pressed:ring-1 aria-pressed:ring-terracotta"
        @click="go(tab)"
      >
        {{ t(`contextUi.${tab}`) }}
      </button>
    </nav>
    <h2 class="mb-5 font-serif text-2xl">
      {{ t(`contextUi.${section}`) }}
    </h2>
    <ContextProfile
      v-if="section === 'profile'"
      :context="context"
    />
    <section v-else-if="section === 'health'">
      <h3 class="font-semibold">
        {{ t('contextUi.limitations') }}
      </h3><p
        v-if="!context.record.health.limitations.length"
        class="mt-2 text-muted"
      >
        {{ t('contextUi.noLimitations') }}
      </p><ul
        v-else
        class="mt-2 list-inside list-disc"
      >
        <li
          v-for="item in context.record.health.limitations"
          :key="item"
        >
          {{ label('contextVocabulary.limitations', item) }}
        </li>
      </ul><h3 class="mt-5 font-semibold">
        {{ t('contextUi.healthNotes') }}
      </h3><p class="mt-2 whitespace-pre-wrap">
        {{ context.record.health.healthNotes || t('contextUi.missing') }}
      </p>
    </section>
    <section v-else-if="section === 'equipment'">
      <p
        v-if="!context.record.customEquipment.length"
        class="text-muted"
      >
        {{ t('contextUi.noEquipment') }}
      </p><ul class="space-y-4">
        <li
          v-for="item in context.record.customEquipment"
          :key="item.id"
          class="rounded border border-surface-dark p-4"
        >
          <h3 class="font-serif text-xl">
            {{ item.name }}
          </h3><p
            v-if="item.trainingInterests.length"
            class="mt-2 text-sm text-muted"
          >
            {{ new Intl.ListFormat(locale).format(item.trainingInterests.map(value => label('contextVocabulary.trainingInterests', value))) }}
          </p><HostFollowUp
            :disabled="!canWrite"
            :label="'contextUi.askEdit'"
            :request="t('contextUi.followUp', { kind: t('contextUi.equipment'), id: item.id })"
            :send="sendFollowUp"
          />
        </li>
      </ul><button
        type="button"
        :disabled="busy"
        class="mt-4 rounded border border-surface-dark p-3"
        @click="go('spaces')"
      >
        {{ t('contextUi.spaces') }}
      </button>
    </section>
    <ContextSpaces
      v-else-if="section === 'spaces'"
      :context="context"
      :can-write="canWrite"
      :make-default="makeDefault"
      :send-follow-up="sendFollowUp"
    />
    <section v-else-if="section === 'preferences'">
      <fieldset
        :disabled="!canWrite"
        class="mb-5"
      >
        <legend class="mb-2 font-semibold">
          {{ t('contextUi.units') }}
        </legend><div class="flex flex-wrap gap-2">
          <button
            v-for="units in ['metric', 'imperial'] as const"
            :key="units"
            type="button"
            :aria-pressed="context.record.context.unitSystem === units"
            class="rounded border border-surface-dark p-3 aria-pressed:border-terracotta aria-pressed:ring-1 aria-pressed:ring-terracotta"
            @click="updatePreference({ unitSystem: units })"
          >
            {{ t(`contextUi.${units}`) }}
          </button>
        </div>
      </fieldset><fieldset
        :disabled="!canWrite"
        class="mb-5"
      >
        <legend class="mb-2 font-semibold">
          {{ t('contextUi.theme') }}
        </legend><div class="flex flex-wrap gap-2">
          <button
            v-for="theme in ['system', 'light', 'dark'] as const"
            :key="theme"
            type="button"
            :aria-pressed="(context.record.preferences.theme ?? 'system') === theme"
            class="rounded border border-surface-dark p-3 aria-pressed:border-terracotta aria-pressed:ring-1 aria-pressed:ring-terracotta"
            @click="updatePreference({ theme })"
          >
            {{ t(`contextUi.${theme}`) }}
          </button>
        </div>
      </fieldset><dl class="space-y-3">
        <div
          v-for="field in fields"
          :key="field.label"
        >
          <dt class="text-sm text-muted">
            {{ t(`contextUi.${field.label}`) }}
          </dt><dd>{{ field.value }}</dd>
        </div>
      </dl>
    </section>
    <section v-else-if="section === 'memories'">
      <p class="mb-4 text-sm text-muted">
        {{ t('contextUi.memoryHint') }}
      </p><p
        v-if="!context.related.memories.data.length"
        class="my-6 text-muted"
      >
        {{ t('contextUi.empty') }}
      </p><ul class="space-y-3">
        <li
          v-for="fact in context.related.memories.data"
          :key="fact.id"
          class="rounded border border-surface-dark p-4"
        >
          <button
            type="button"
            :disabled="busy"
            class="text-left underline decoration-surface-dark underline-offset-4"
            @click="navigate({ name: 'open_memory', arguments: { memoryId: fact.id } })"
          >
            {{ fact.content }}
          </button><p class="mt-2 text-xs text-muted">
            {{ t(fact.externalMcp ? 'contextUi.external' : `contextUi.${fact.source}`) }}
          </p>
        </li>
      </ul><nav
        :aria-label="t('contextUi.memories')"
        class="my-5 flex flex-wrap justify-between gap-3"
      >
        <p class="w-full text-sm text-muted">
          {{ t('contextUi.page', { page: number(context.related.memories.meta.page), total: number(context.related.memories.meta.total) }) }}
        </p><button
          :disabled="busy || context.related.memories.meta.page <= 1"
          type="button"
          class="rounded border border-surface-dark p-3 disabled:opacity-40"
          @click="go('memories', context.related.memories.meta.page - 1)"
        >
          {{ t('contextUi.previous') }}
        </button><button
          :disabled="busy || context.related.memories.meta.page * context.related.memories.meta.limit >= context.related.memories.meta.total"
          type="button"
          class="rounded border border-surface-dark p-3 disabled:opacity-40"
          @click="go('memories', context.related.memories.meta.page + 1)"
        >
          {{ t('contextUi.next') }}
        </button>
      </nav>
    </section>
    <ContextBody
      v-if="section === 'profile'"
      :context="context"
      :busy="busy"
      :navigate="navigate"
    />
    <HostFollowUp
      v-if="section !== 'spaces'"
      :disabled="!canWrite"
      :label="['equipment', 'memories'].includes(section) ? 'contextUi.askCreate' : 'contextUi.askEdit'"
      :request="['equipment', 'memories'].includes(section) ? t('contextUi.addFollowUp', { kind: t(`contextUi.${section}`) }) : t('contextUi.followUp', { kind: t(`contextUi.${section}`), id: section })"
      :send="sendFollowUp"
    />
  </section>
</template>
