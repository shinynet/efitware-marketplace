<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { meta, disabled } = defineProps<{ meta: { page: number, limit: number, total: number }, disabled: boolean }>()
const emit = defineEmits<{ page: [value: number] }>()
const { t, locale } = useI18n()
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
</script>
<template>
  <nav
    :aria-label="t('contextUi.page', { page: number(meta.page), total: number(meta.total) })"
    class="my-5 flex flex-wrap justify-between gap-3"
  >
    <p class="w-full text-sm text-muted">
      {{ t('contextUi.page', { page: number(meta.page), total: number(meta.total) }) }}
    </p><button
      class="secondary"
      type="button"
      :disabled="disabled || meta.page <= 1"
      @click="emit('page', meta.page - 1)"
    >
      {{ t('contextUi.previous') }}
    </button><button
      class="secondary"
      type="button"
      :disabled="disabled || meta.page * meta.limit >= meta.total"
      @click="emit('page', meta.page + 1)"
    >
      {{ t('contextUi.next') }}
    </button>
  </nav>
</template>
