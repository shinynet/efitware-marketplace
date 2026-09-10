<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ViewActivity } from './model'
import { formatMeasure } from './presentation'

const { activity, disabled } = defineProps<{ activity: ViewActivity, disabled: boolean }>()
const emit = defineEmits<{ save: [completed: boolean] }>()
const { t, locale } = useI18n()
</script>

<template>
  <article class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center border-b border-surface-dark py-4">
    <header class="min-w-0 flex-1">
      <h3 class="font-medium">
        {{ activity.title || t(activity.kind === 'rest' ? 'restKind' : activity.kind) }}
      </h3>
      <p
        v-if="activity.detail"
        class="text-sm text-muted"
      >
        {{ activity.detail }}
      </p>
      <p
        v-if="activity.durationTarget !== undefined"
        class="mt-1 text-sm text-muted"
      >
        {{ t('prescription') }}: {{ formatMeasure('duration', activity.durationTarget, 'metric', locale) }}
      </p>
      <p
        v-if="activity.durationActual !== undefined"
        class="mt-1 text-sm"
      >
        {{ t('actuals') }}: {{ formatMeasure('duration', activity.durationActual, 'metric', locale) }}
      </p>
      <p
        v-if="activity.notes"
        class="mt-2 whitespace-pre-wrap text-sm"
      >
        {{ activity.notes }}
      </p>
    </header>
    <button
      class="secondary"
      :disabled
      :aria-pressed="activity.completed"
      @click="emit('save', !activity.completed)"
    >
      <span
        v-if="activity.completed"
        aria-hidden="true"
      >✓ </span>{{ t(activity.completed ? 'reopen' : 'done') }}
    </button>
  </article>
</template>
