<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LibraryCover } from './workoutLibraryModel'

/**
 * A Library item's 4:3 cover thumbnail (app EF-1609) in a fixed-aspect box,
 * so nothing shifts as it loads. Without a `cover`, or once the image fails
 * to load (a host that blocks the media origin included), the box stays a
 * plain placeholder: a broken image is never drawn.
 */
const { cover = undefined, lazy = false } = defineProps<{ cover?: LibraryCover, lazy?: boolean }>()
const failed = ref(false)
watch(() => cover?.thumbnail.url, () => { failed.value = false })
</script>

<template>
  <div
    class="aspect-[4/3] overflow-hidden rounded bg-surface-dark"
    :aria-hidden="cover && !failed ? undefined : 'true'"
    data-library-cover
  >
    <img
      v-if="cover && !failed"
      :src="cover.thumbnail.url"
      :alt="cover.thumbnail.alt"
      :width="cover.thumbnail.width"
      :height="cover.thumbnail.height"
      :loading="lazy ? 'lazy' : 'eager'"
      decoding="async"
      class="block h-full w-full object-cover"
      @error="failed = true"
    >
  </div>
</template>
