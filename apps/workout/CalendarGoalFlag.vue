<script setup lang="ts">
/**
 * A goal's target-date flag (EF-1889): a pole and pennant in terracotta, a shape no session mark (CalendarMark.vue)
 * uses, so a goal day never reads as a session. With a label the flag is an image with that name; without one it is
 * decorative beside visible text.
 */
const { label = '' } = defineProps<{ label?: string }>()
</script>
<template>
  <span
    class="inline-flex size-3.5 shrink-0 items-center justify-center text-terracotta"
    data-goal-flag
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    :title="label || undefined"
  >
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <line
        x1="3.5"
        y1="1.75"
        x2="3.5"
        y2="12.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <path
        d="M4.25 2.25 L11.5 4.5 L4.25 6.75 Z"
        fill="currentColor"
      />
    </svg>
  </span>
</template>
