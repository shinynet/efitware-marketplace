<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Tracking, ViewSet } from './model'
import { displayMeasure, formatMeasure, parseInput, storageValue, type ActualField } from './presentation'
import type { UnitSystem } from './lib/units'

const { set, number, tracking = undefined, system, disabled, save } = defineProps<{
  set: ViewSet
  number: number
  tracking?: Tracking
  system: UnitSystem
  disabled: boolean
  save: (patch: Record<string, number | boolean | null>) => Promise<boolean | undefined> | undefined
}>()
const emit = defineEmits<{ dirty: [value: boolean] }>()
const { t, locale } = useI18n()
const invalid = ref(false)
const draft = reactive<Partial<Record<ActualField, { text: string, unit?: string, locale: string }>>>({})
watch(() => Object.values(draft).some(value => value !== undefined), value => emit('dirty', value), { immediate: true })
onUnmounted(() => emit('dirty', false))
const fields = computed(() => (['weight', 'reps', 'duration', 'distance'] as const).filter((field) => {
  const flag = { weight: 'tracksWeight', reps: 'tracksReps', duration: 'tracksTime', distance: 'tracksDistance' } as const
  return tracking?.[flag[field]] || set[field] !== undefined
}))
const numberText = (value: number) => new Intl.NumberFormat(locale.value, { useGrouping: false, maximumFractionDigits: 2 }).format(value)
const display = (field: ActualField) => displayMeasure(field, set[field] ?? 0, system)
const valueText = (field: ActualField) => draft[field]?.text ?? (set[field] === undefined ? '' : numberText(display(field).value))
const edit = (field: ActualField, text: string) => {
  draft[field] = { text, unit: draft[field]?.unit ?? display(field).unit, locale: locale.value }
}
const fieldLabel = (field: ActualField) => {
  const unit = draft[field]?.unit ?? display(field).unit
  if (!unit) return t(field)
  const label = new Intl.NumberFormat(locale.value, { style: 'unit', unit, unitDisplay: 'short' }).formatToParts(0).find(part => part.type === 'unit')?.value ?? unit
  return t({ weight: 'unitsWeight', duration: 'unitsDuration', distance: 'unitsDistance', reps: 'reps' }[field], { unit: label })
}
const target = computed(() => {
  const parts: string[] = []
  if (set.plannedReps) {
    const { min, max } = set.plannedReps
    parts.push(t('repTarget', { value: max === min ? numberText(min) : t('range', { min: numberText(min), max: numberText(max) }) }))
  }
  for (const field of ['weight', 'duration', 'distance'] as const) {
    const key = { weight: 'plannedWeight', duration: 'plannedDuration', distance: 'plannedDistance' } as const
    const value = set[key[field]]
    if (value !== undefined) parts.push(formatMeasure(field, value, system, locale.value))
  }
  return new Intl.ListFormat(locale.value, { style: 'short', type: 'unit' }).format(parts) || t('noTarget')
})
// A readback also acknowledges a save retried outside this row. Other drafts survive.
watch(() => set, () => {
  for (const field of fields.value) {
    const text = draft[field]
    if (text === undefined) continue
    try {
      const parsed = parseInput(text.text, text.locale)
      const actual = set[field]
      if ((parsed === null && actual === undefined) || (parsed !== null && actual !== undefined && Math.abs(storageValue(field, parsed, text.unit) - actual) < 0.0000001)) draft[field] = undefined
    } catch {
      // Keep incomplete or invalid input for the user to correct.
    }
  }
})

const submit = async (completed: boolean) => {
  invalid.value = false
  const patch: Record<string, number | boolean | null> = { completed }
  try {
    for (const field of fields.value) {
      const text = draft[field]
      if (text === undefined) continue
      const parsed = parseInput(text.text, text.locale)
      if (field === 'reps' && parsed !== null && !Number.isInteger(parsed)) throw new Error('INVALID_REPS')
      patch[field] = parsed === null ? null : storageValue(field, parsed, text.unit)
    }
    const submitted = { ...draft }
    if (await save(patch)) {
      for (const field of fields.value) {
        if (draft[field] === submitted[field]) draft[field] = undefined
      }
    }
  } catch { invalid.value = true }
}
</script>

<template>
  <fieldset
    class="set-row"
    :class="{ 'set-complete': set.completed }"
    :disabled="disabled || tracking?.unavailable"
  >
    <legend class="flex items-center gap-2 font-semibold">
      <span
        v-if="set.completed"
        aria-hidden="true"
        class="text-olive"
      >✓</span>
      {{ t('set', { number: numberText(number) }) }}
    </legend>
    <p class="mt-1 text-sm text-muted">
      <span class="font-medium">{{ t('prescription') }}:</span> {{ target }}
    </p>
    <p
      v-if="Object.values(draft).some(value => value !== undefined)"
      class="mt-2 text-xs text-gold-ink"
    >
      {{ t('unsaved') }}
    </p>
    <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <label
        v-for="field in fields"
        :key="field"
        class="min-w-0 text-xs text-muted"
      >
        {{ fieldLabel(field) }}
        <input
          :value="valueText(field)"
          :aria-label="`${t('set', { number })} — ${fieldLabel(field)}`"
          :aria-invalid="invalid || undefined"
          inputmode="decimal"
          autocomplete="off"
          :placeholder="t('blank')"
          class="mt-1 w-full"
          @input="edit(field, ($event.target as HTMLInputElement).value)"
        >
      </label>
    </div>
    <p
      v-if="invalid"
      role="alert"
      class="mt-2 text-sm"
    >
      {{ t('invalid') }}
    </p>
    <p
      v-if="set.comments"
      class="mt-2 whitespace-pre-wrap text-sm text-muted"
    >
      {{ set.comments }}
    </p>
    <footer class="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs text-muted">
        <span v-if="set.restTarget !== undefined">{{ t('rest', { value: formatMeasure('duration', set.restTarget, system, locale) }) }}</span>
        <span
          v-if="set.rirTarget !== undefined"
          class="ml-2"
        >{{ t('rir', { value: numberText(set.rirTarget) }) }}</span>
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="set.completed"
          type="button"
          class="secondary"
          @click="submit(false)"
        >
          {{ t('reopen') }}
        </button>
        <button
          type="button"
          class="primary"
          @click="submit(true)"
        >
          {{ t(set.completed ? 'save' : 'done') }}
        </button>
      </div>
    </footer>
  </fieldset>
</template>
