<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { IntegrationView } from './outcomeModel'
import OutcomePagination from './OutcomePagination.vue'
import type { createWorkoutConnection } from './workoutConnection'
const { integration, disabled, navigate } = defineProps<{ integration: IntegrationView, disabled: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'] }>()
const { t, locale } = useI18n()
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short', timeZone: integration.presentation.timeZone }).format(new Date(value))
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
</script>
<template>
  <article
    class="pb-6"
    aria-labelledby="integration-heading"
  >
    <p class="mb-2 text-sm text-gold-ink">
      {{ t('outcomeUi.integration') }}
    </p><h1
      id="integration-heading"
      class="font-serif text-3xl"
    >
      {{ t(`outcomeUi.${integration.record.provider}`) }}
    </h1><p class="mt-3">
      {{ t(`outcomeUi.${integration.record.status}`) }}
    </p><p class="my-4 text-sm text-muted">
      {{ t('outcomeUi.metadataOnly') }}
    </p>
    <dl class="space-y-4 rounded bg-surface p-4">
      <div>
        <dt class="text-sm text-muted">
          {{ t('outcomeUi.lastSync') }}
        </dt><dd>{{ integration.record.lastSuccessfulSyncAt ? date(integration.record.lastSuccessfulSyncAt) : t('outcomeUi.never') }}</dd>
      </div><div>
        <dt class="text-sm text-muted">
          {{ t('outcomeUi.error') }}
        </dt><dd>{{ integration.record.lastErrorCode ? t(`outcomeUi.${integration.record.lastErrorCode}`) : t('outcomeUi.noError') }}</dd>
      </div><div>
        <dt class="text-sm text-muted">
          {{ t('outcomeUi.capabilities') }}
        </dt><dd>{{ integration.record.capabilities.length ? new Intl.ListFormat(locale).format(integration.record.capabilities.map(value => t(`outcomeUi.capability.${value}`))) : t('outcomeUi.never') }}</dd>
      </div>
    </dl>
    <h2 class="my-5 font-serif text-2xl">
      {{ t('outcomeUi.syncHistory') }}
    </h2><p v-if="!integration.related.runs.data.length">
      {{ t('outcomeUi.empty') }}
    </p><ol class="space-y-4">
      <li
        v-for="run in integration.related.runs.data"
        :key="run.id"
        class="rounded border border-surface-dark p-4"
      >
        <h3 class="font-semibold">
          {{ t(`outcomeUi.${run.status}`) }}
        </h3><time
          :datetime="run.startedAt"
          class="mt-2 block text-sm text-muted"
        >{{ date(run.startedAt) }}</time><dl class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div
            v-for="(value, key) in run.counts"
            :key="key"
          >
            <dt class="text-xs text-muted">
              {{ t(`outcomeUi.${key}`) }}
            </dt><dd class="text-xl">
              {{ number(value) }}
            </dd>
          </div>
        </dl><ul
          v-if="run.errors.length"
          class="mt-4 list-inside list-disc text-sm"
        >
          <li
            v-for="(error, index) in run.errors"
            :key="index"
          >
            {{ t('outcomeUi.recordIndex', { index: number(error.index) }) }}: {{ t(`outcomeUi.${error.code}`) }}
          </li>
        </ul>
      </li>
    </ol><OutcomePagination
      :disabled="disabled"
      :meta="integration.related.runs.meta"
      @page="navigate({ name: 'open_integration', arguments: { connectionId: integration.record.id, page: $event, limit: integration.related.runs.meta.limit } }, true)"
    />
  </article>
</template>
