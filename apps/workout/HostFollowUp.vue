<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { disabled, request, send } = defineProps<{ disabled: boolean, request: string, send: (prompt: string) => Promise<'accepted' | 'unavailable' | 'rejected' | 'uncertain'> }>()
const { t } = useI18n()
const prompt = ref('')
const state = ref('')
const sending = ref(false)
const copied = ref(false)
const clipboardAvailable = typeof navigator.clipboard?.writeText === 'function'
const copy = async () => {
  try { await navigator.clipboard.writeText(prompt.value); copied.value = true } catch { copied.value = false }
}
const ask = async () => {
  if (disabled || sending.value) return
  prompt.value = request
  sending.value = true
  state.value = ''
  copied.value = false
  try { state.value = await send(prompt.value) } finally { sending.value = false }
}
</script>
<template>
  <button
    type="button"
    class="secondary mt-3"
    :disabled="disabled || sending"
    @click="ask"
  >
    {{ t('askAdapt') }}
  </button>
  <p
    v-if="state === 'accepted'"
    role="status"
    class="mt-3 text-sm"
  >
    {{ t('followUpAccepted') }}
  </p>
  <aside
    v-else-if="state"
    role="status"
    class="mt-3"
  >
    <p class="text-sm">
      {{ t(state === 'uncertain' ? 'followUpUncertain' : 'followUpUnavailable') }}
    </p>
    <label class="mt-3 block text-sm">{{ t('followUpRequest') }}
      <textarea
        v-model="prompt"
        class="mt-2 block w-full rounded border border-muted bg-bg p-3 text-ink"
        rows="3"
      />
    </label>
    <button
      v-if="clipboardAvailable"
      type="button"
      class="secondary mt-2"
      @click="copy"
    >
      {{ t(copied ? 'copied' : 'copyRequest') }}
    </button>
  </aside>
</template>
