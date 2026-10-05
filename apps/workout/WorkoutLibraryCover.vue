<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LibraryCover } from './workoutLibraryModel'

/**
 * A Library item's 4:3 cover thumbnail (app EF-1609). Explicit width and
 * height keep a loading image from shifting the layout. Without a `cover`,
 * or once the image fails to load (a host that blocks the media origin
 * included), nothing renders and no space is reserved: the result lays out
 * as it did before covers, never as a broken or empty image.
 */
const { cover = undefined, lazy = false } = defineProps<{ cover?: LibraryCover, lazy?: boolean }>()
const failed = ref(false)
watch(() => cover?.thumbnail.url, () => { failed.value = false })
</script>

<template>
  <div
    v-if="cover && !failed"
    class="aspect-[4/3] overflow-hidden rounded bg-surface-dark"
    data-library-cover
  >
    <img
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
