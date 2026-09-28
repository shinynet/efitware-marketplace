<script setup lang="ts">
/**
 * One calendar session mark (EF-1474). Shapes differ without colour: done is a filled dot, planned a ring, missed a
 * muted ring with a diagonal slash, ended a muted ring with a short bar. In progress keeps the product's filled
 * terracotta dot. With a label the mark is an image with that name; without one it is decorative beside visible text.
 */
import type { CalendarMarkKind } from './planningModel'
const { kind, label = '' } = defineProps<{ kind: CalendarMarkKind, label?: string }>()
</script>
<template>
  <span
    class="inline-flex size-3 shrink-0 items-center justify-center"
    :class="{ 'text-olive': kind === 'completed', 'text-terracotta': kind === 'in_progress', 'text-ink': kind === 'planned', 'text-muted': kind === 'missed' || kind === 'ended' }"
    :data-mark="kind"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    :title="label || undefined"
  >
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        v-if="kind === 'completed' || kind === 'in_progress'"
        cx="6"
        cy="6"
        r="4.5"
        fill="currentColor"
      />
      <circle
        v-else
        cx="6"
        cy="6"
        r="4.25"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <line
        v-if="kind === 'missed'"
        x1="2.5"
        y1="9.5"
        x2="9.5"
        y2="2.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <line
        v-if="kind === 'ended'"
        x1="3.75"
        y1="6"
        x2="8.25"
        y2="6"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
  </span>
</template>
