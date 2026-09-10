<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ReceiptsView } from './outcomeModel'
import OutcomePagination from './OutcomePagination.vue'
import type { createWorkoutConnection } from './workoutConnection'
const { receipts, disabled, navigate, undo } = defineProps<{ receipts: ReceiptsView, disabled: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'], undo: (id: string) => Promise<unknown> | undefined }>()
const { t, te, locale } = useI18n()
const confirming = ref('')
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short', timeZone: receipts.presentation.timeZone }).format(new Date(value))
const title = (tool?: string) => tool && te(`outcomeUi.actions.${tool}`) ? t(`outcomeUi.actions.${tool}`) : t('outcomeUi.externalChange')
const target = (entity: ReceiptsView['record']['data'][number]['entities'][number]) => {
  const owners: Record<string, { name: string, key: string }> = { workout: { name: 'open_workout', key: 'workoutId' }, template: { name: 'open_template', key: 'templateId' }, program: { name: 'open_program', key: 'programId' }, schedule: { name: 'open_schedule', key: 'scheduleId' }, exercise: { name: 'open_exercise', key: 'exerciseId' }, aiMemory: { name: 'open_memory', key: 'memoryId' }, goal: { name: 'open_goal', key: 'goalId' }, goalPlan: { name: 'open_goal_plan', key: 'planId' } }
  if (!entity.id && entity.type !== 'user') return undefined
  const owner = owners[entity.type]
  return owner ? { name: owner.name, arguments: { [owner.key]: entity.id } } : entity.type === 'user' ? { name: 'open_context', arguments: {} } : undefined
}
const perform = async (id: string) => { const saved = await undo(id); if (saved) confirming.value = '' }
</script>
<template>
  <section
    class="pb-6"
    aria-labelledby="receipts-heading"
  >
    <h1
      id="receipts-heading"
      class="font-serif text-3xl"
    >
      {{ t('outcomeUi.receipts') }}
    </h1><p class="my-4 text-sm text-muted">
      {{ t('outcomeUi.receiptHint') }}
    </p><p v-if="!receipts.record.data.length">
      {{ t('outcomeUi.empty') }}
    </p><ol class="space-y-4">
      <li
        v-for="receipt in receipts.record.data"
        :key="receipt.id"
        class="rounded border border-surface-dark p-4"
      >
        <h2 class="font-serif text-xl">
          {{ title(receipt.tool) }}
        </h2><p
          v-if="receipt.summary && !receipt.tool"
          class="mt-2 whitespace-pre-wrap text-sm"
        >
          {{ receipt.summary }}
        </p><time
          :datetime="receipt.createdAt"
          class="mt-2 block text-sm text-muted"
        >{{ date(receipt.createdAt) }}</time><p
          v-if="receipt.undoneAt"
          class="mt-3 text-olive"
        >
          {{ t('outcomeUi.undone') }} · {{ date(receipt.undoneAt) }}
        </p><p
          v-else-if="!receipt.undoable"
          class="mt-3 text-sm text-muted"
        >
          {{ t('outcomeUi.cannotUndo') }}
        </p><div
          v-if="receipt.undoable && confirming === receipt.id"
          class="mt-4 rounded bg-surface p-3"
        >
          <p>{{ t('outcomeUi.confirmUndo') }}</p><div class="mt-3 flex flex-wrap gap-2">
            <button
              class="primary"
              type="button"
              :disabled="disabled"
              @click="perform(receipt.id)"
            >
              {{ t('outcomeUi.confirm') }}
            </button><button
              class="secondary"
              type="button"
              :disabled="disabled"
              @click="confirming = ''"
            >
              {{ t('outcomeUi.cancel') }}
            </button>
          </div>
        </div><button
          v-else-if="receipt.undoable"
          class="secondary mt-3"
          type="button"
          :disabled="disabled"
          @click="confirming = receipt.id"
        >
          {{ t('outcomeUi.undo') }}
        </button><div class="mt-3 flex flex-wrap gap-2">
          <template
            v-for="entity in receipt.entities"
            :key="`${entity.type}:${entity.id}`"
          >
            <button
              v-if="target(entity)"
              class="secondary"
              type="button"
              :disabled="disabled"
              @click="navigate(target(entity)!)"
            >
              {{ t('outcomeUi.viewRecord') }}
            </button>
          </template>
        </div>
      </li>
    </ol><OutcomePagination
      :disabled="disabled"
      :meta="receipts.record.meta"
      @page="navigate({ name: 'open_receipts', arguments: { page: $event, limit: receipts.record.meta.limit } }, true)"
    />
  </section>
</template>
