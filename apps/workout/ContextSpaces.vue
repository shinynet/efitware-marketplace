<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ContextView } from './contextModel'
import HostFollowUp from './HostFollowUp.vue'
import type { createWorkoutConnection } from './workoutConnection'
const { context, canWrite, makeDefault, sendFollowUp } = defineProps<{ context: ContextView, canWrite: boolean, makeDefault: (id: string) => unknown, sendFollowUp: ReturnType<typeof createWorkoutConnection>['sendFollowUp'] }>()
const { t, te } = useI18n()
const equipment = (id: string) => context.record.customEquipment.find(item => item.id === id)?.name ?? (te(`contextVocabulary.equipment.${id}`) ? t(`contextVocabulary.equipment.${id}`) : id)
</script>
<template>
  <ul class="space-y-4">
    <li
      v-for="space in context.record.trainingSpaces"
      :key="space.id"
      class="rounded border border-surface-dark p-4"
    >
      <h3 class="font-serif text-2xl">
        {{ space.name }}
      </h3><p
        v-if="space.isDefault"
        class="mt-1 text-sm text-gold-ink"
      >
        {{ t('contextUi.defaultSpace') }}
      </p><p
        v-if="space.access === 'unconfigured'"
        class="mt-3 text-muted"
      >
        {{ t('contextUi.unconfigured') }}
      </p><p
        v-else-if="!space.equipment.items.length && !space.equipment.custom.length"
        class="mt-3 text-muted"
      >
        {{ t('contextUi.emptyInventory') }}
      </p><ul
        v-else
        class="my-3 list-inside list-disc"
      >
        <li
          v-for="item in space.equipment.items"
          :key="item"
        >
          {{ equipment(item) }}
        </li><li
          v-for="item in space.equipment.custom"
          :key="item"
        >
          {{ item }}
        </li>
      </ul><p
        v-if="space.notes"
        class="my-3 whitespace-pre-wrap"
      >
        {{ space.notes }}
      </p><button
        v-if="!space.isDefault"
        type="button"
        :disabled="!canWrite"
        class="my-3 rounded border border-surface-dark p-3 disabled:opacity-40"
        @click="makeDefault(space.id)"
      >
        {{ t('contextUi.makeDefault') }}
      </button><HostFollowUp
        :disabled="!canWrite"
        :label="'contextUi.askEdit'"
        :request="t('contextUi.followUp', { kind: t('contextUi.spaces'), id: space.id })"
        :send="sendFollowUp"
      />
    </li>
  </ul>
</template>
