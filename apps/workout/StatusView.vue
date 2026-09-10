<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { StatusView } from './outcomeModel'
import OutcomePagination from './OutcomePagination.vue'
import type { createWorkoutConnection } from './workoutConnection'
const { status, disabled, navigate, openSettings } = defineProps<{ status: StatusView, disabled: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'], openSettings: (onboarding?: boolean) => unknown }>()
const { t, locale } = useI18n()
const section = computed(() => status.related.section)
const go = (section: StatusView['related']['section'], page = 1) => navigate({ name: 'open_status', arguments: { section, page, limit: status.related.connections.meta.limit } }, true)
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short', timeZone: status.presentation.timeZone }).format(new Date(value))
</script>
<template>
  <section
    class="pb-6"
    aria-labelledby="status-heading"
  >
    <h1
      id="status-heading"
      class="font-serif text-3xl"
    >
      {{ t('outcomeUi.status') }}
    </h1><nav
      :aria-label="t('outcomeUi.status')"
      class="my-5 flex flex-wrap gap-2"
    >
      <button
        v-for="tab in ['account', 'integrations', 'exports'] as const"
        :key="tab"
        type="button"
        class="secondary"
        :disabled="disabled"
        :aria-pressed="section === tab"
        @click="go(tab)"
      >
        {{ t(`outcomeUi.${tab}`) }}
      </button>
    </nav>
    <dl
      v-if="section === 'account'"
      class="grid gap-4 sm:grid-cols-2"
    >
      <div class="rounded bg-surface p-4">
        <dt class="text-sm text-muted">
          {{ t('outcomeUi.onboarding') }}
        </dt><dd class="mt-1 text-lg">
          {{ t(status.record.onboardingComplete ? 'outcomeUi.complete' : 'outcomeUi.incomplete') }}
        </dd>
      </div><div class="rounded bg-surface p-4">
        <dt class="text-sm text-muted">
          {{ t('outcomeUi.consent') }}
        </dt><dd class="mt-1 text-lg">
          {{ t(status.record.healthDataConsentAccepted ? 'outcomeUi.accepted' : 'outcomeUi.missing') }}
        </dd>
      </div>
    </dl>
    <section v-else-if="section === 'integrations'">
      <p class="mb-4 text-sm text-muted">
        {{ t('outcomeUi.metadataOnly') }}
      </p><p v-if="!status.related.connections.data.length">
        {{ t('outcomeUi.empty') }}
      </p><ul class="space-y-3">
        <li
          v-for="connection in status.related.connections.data"
          :key="connection.id"
          class="rounded border border-surface-dark p-4"
        >
          <h2 class="font-serif text-xl">
            <button
              type="button"
              :disabled="disabled"
              class="text-left underline underline-offset-4"
              @click="navigate({ name: 'open_integration', arguments: { connectionId: connection.id } })"
            >
              {{ t(`outcomeUi.${connection.provider}`) }}
            </button>
          </h2><p class="mt-2">
            {{ t(`outcomeUi.${connection.status}`) }}
          </p><p class="mt-2 text-sm text-muted">
            {{ t('outcomeUi.updated') }}: <time :datetime="connection.updatedAt">{{ date(connection.updatedAt) }}</time>
          </p>
        </li>
      </ul><OutcomePagination
        :disabled="disabled"
        :meta="status.related.connections.meta"
        @page="go('integrations', $event)"
      />
    </section>
    <section v-else>
      <p class="mb-4 text-sm text-muted">
        {{ t('outcomeUi.exportOnly') }}
      </p><p v-if="!status.related.exports.data.length">
        {{ t('outcomeUi.empty') }}
      </p><ul class="space-y-3">
        <li
          v-for="item in status.related.exports.data"
          :key="item.id"
          class="rounded border border-surface-dark p-4"
        >
          <h2 class="font-serif text-xl">
            {{ t('outcomeUi.ready') }}
          </h2><p class="mt-2">
            {{ t('outcomeUi.created') }}: <time :datetime="item.createdAt">{{ date(item.createdAt) }}</time>
          </p><p class="mt-2 text-sm text-muted">
            {{ t('outcomeUi.expires') }}: <time :datetime="item.expiresAt">{{ date(item.expiresAt) }}</time>
          </p>
        </li>
      </ul><OutcomePagination
        :disabled="disabled"
        :meta="status.related.exports.meta"
        @page="go('exports', $event)"
      />
    </section>
    <button
      type="button"
      class="secondary mt-5"
      :disabled="disabled"
      @click="openSettings(section === 'account' && !status.record.onboardingComplete)"
    >
      {{ t(section === 'account' && !status.record.onboardingComplete ? 'outcomeUi.finishSetup' : 'outcomeUi.appSettings') }}
    </button>
  </section>
</template>
