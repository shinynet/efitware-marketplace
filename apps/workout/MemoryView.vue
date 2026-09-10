<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MemoryView } from './contextModel'
const { memory, canWrite, save } = defineProps<{ memory: MemoryView, canWrite: boolean, save: (content: string) => Promise<unknown> | undefined }>()
const emit = defineEmits<{ dirty: [value: boolean] }>()
const { t, locale } = useI18n()
const draft = ref(memory.record.content)
const baseline = ref(memory.record.content)
const dirty = computed(() => draft.value !== baseline.value)
watch(dirty, value => emit('dirty', value), { immediate: true })
watch(() => memory.record.content, content => {
  if (!dirty.value || draft.value === content) draft.value = content
  baseline.value = content
})
const submit = async () => { if (!canWrite || !draft.value.trim() || draft.value.length > 500) return; draft.value = draft.value.trim(); await save(draft.value) }
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short', timeZone: memory.presentation.timeZone }).format(new Date(value))
</script>
<template>
  <article aria-labelledby="memory-heading">
    <p class="text-xs font-semibold uppercase tracking-wider text-gold-ink">
      {{ t('contextUi.eyebrow') }}
    </p>
    <h1
      id="memory-heading"
      class="mt-2 font-serif text-3xl"
    >
      {{ t('contextUi.memory') }}
    </h1>
    <blockquote class="my-6 border-l-2 border-olive pl-4 text-xl leading-relaxed">
      {{ memory.record.content }}
    </blockquote>
    <dl class="space-y-3 rounded bg-surface p-4 text-sm">
      <div>
        <dt class="text-muted">
          {{ t('contextUi.author') }}
        </dt><dd>
          {{ t(memory.record.externalMcp ? 'contextUi.external' : `contextUi.${memory.record.source}`) }}
        </dd>
      </div><div>
        <dt class="text-muted">
          {{ t('contextUi.created') }}
        </dt><dd><time :datetime="memory.record.createdAt">{{ date(memory.record.createdAt) }}</time></dd>
      </div><div>
        <dt class="text-muted">
          {{ t('contextUi.updated') }}
        </dt><dd><time :datetime="memory.record.updatedAt">{{ date(memory.record.updatedAt) }}</time></dd>
      </div>
    </dl>
    <label
      class="mt-6 block font-semibold"
      for="memory-correction"
    >{{ t('contextUi.editFact') }}</label><textarea
      id="memory-correction"
      v-model="draft"
      :disabled="!canWrite"
      maxlength="500"
      rows="5"
      aria-describedby="memory-limit"
      class="mt-2 w-full rounded border border-muted bg-bg p-3"
    />
    <p
      id="memory-limit"
      class="mt-2 text-sm text-muted"
    >
      {{ t('contextUi.memoryLimit') }}
    </p><p
      v-if="dirty"
      role="status"
      class="mt-2 text-sm text-gold-ink"
    >
      {{ t('contextUi.draft') }}
    </p>
    <button
      type="button"
      :disabled="!canWrite || !dirty || !draft.trim()"
      class="mt-4 rounded border border-surface-dark p-3 disabled:opacity-40"
      @click="submit"
    >
      {{ t('contextUi.saveFact') }}
    </button>
  </article>
</template>
