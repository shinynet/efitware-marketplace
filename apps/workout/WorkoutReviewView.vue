<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ReviewView } from './outcomeModel'
import OutcomePagination from './OutcomePagination.vue'
import HostFollowUp from './HostFollowUp.vue'
import type { createWorkoutConnection } from './workoutConnection'
const { review, disabled, navigate, save, remove, followUp } = defineProps<{ review: ReviewView, disabled: boolean, navigate: ReturnType<typeof createWorkoutConnection>['navigate'], save: (content: string) => Promise<unknown> | undefined, remove: () => Promise<unknown> | undefined, followUp: ReturnType<typeof createWorkoutConnection>['sendFollowUp'] }>()
const emit = defineEmits<{ dirty: [value: boolean] }>()
const { t, locale } = useI18n()
const baseline = ref(review.related.reflections.external?.content ?? '')
const draft = ref(baseline.value)
const dirty = computed(() => draft.value !== baseline.value)
const confirmRemove = ref(false)
watch(dirty, value => emit('dirty', value), { immediate: true })
watch(() => review.related.reflections.external?.content ?? '', content => { if (!dirty.value || draft.value === content) draft.value = content; baseline.value = content })
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short', timeZone: review.presentation.timeZone }).format(new Date(value))
const submit = async () => { if (disabled || !draft.value.trim()) return; draft.value = draft.value.trim(); await save(draft.value) }
const removeSaved = async () => { if (await remove()) confirmRemove.value = false }
</script>
<template>
  <article
    class="pb-6"
    aria-labelledby="review-heading"
  >
    <p class="text-sm text-gold-ink">
      {{ t('outcomeUi.workoutReview') }}
    </p><h1
      id="review-heading"
      class="mt-2 font-serif text-3xl"
    >
      {{ review.record.title }}
    </h1><button
      class="secondary mt-4"
      type="button"
      :disabled="disabled || dirty"
      @click="navigate({ name: 'open_workout', arguments: { workoutId: review.record.id } })"
    >
      {{ t('outcomeUi.viewRecord') }}
    </button>
    <section class="my-6 rounded bg-surface p-4">
      <h2 class="font-serif text-2xl">
        {{ t('outcomeUi.coachReflection') }}
      </h2><template v-if="review.related.reflections.coach">
        <p class="mt-3 whitespace-pre-wrap leading-relaxed">
          {{ review.related.reflections.coach.content }}
        </p><time
          :datetime="review.related.reflections.coach.generatedAt"
          class="mt-3 block text-xs text-muted"
        >{{ date(review.related.reflections.coach.generatedAt) }}</time>
      </template><p
        v-else
        class="mt-3 text-sm text-muted"
      >
        {{ t('outcomeUi.noReflection') }}
      </p>
    </section>
    <section class="my-6">
      <h2 class="font-serif text-2xl">
        {{ t('outcomeUi.externalCommentary') }}
      </h2><template v-if="review.related.reflections.external">
        <p class="mt-3 whitespace-pre-wrap leading-relaxed">
          {{ review.related.reflections.external.content }}
        </p><time
          :datetime="review.related.reflections.external.updatedAt"
          class="mt-3 block text-xs text-muted"
        >{{ date(review.related.reflections.external.updatedAt) }}</time>
      </template><p
        v-else
        class="mt-3 text-sm text-muted"
      >
        {{ t('outcomeUi.noReflection') }}
      </p>
      <template v-if="review.record.status === 'completed'">
        <label
          class="mt-5 block font-semibold"
          for="external-commentary"
        >{{ t('outcomeUi.editCommentary') }}</label><textarea
          id="external-commentary"
          v-model="draft"
          :disabled="disabled"
          maxlength="2000"
          rows="6"
          class="mt-2 w-full rounded border border-muted bg-bg p-3"
        /><p
          v-if="dirty"
          role="status"
          class="mt-2 text-sm text-gold-ink"
        >
          {{ t('outcomeUi.commentaryDraft') }}
        </p><button
          class="primary mt-3"
          type="button"
          :disabled="disabled || !dirty || !draft.trim()"
          @click="submit"
        >
          {{ t('outcomeUi.saveCommentary') }}
        </button>
      </template>
      <div
        v-if="review.related.reflections.external"
        class="mt-4"
      >
        <div
          v-if="confirmRemove"
          class="rounded bg-surface p-3"
        >
          <p>{{ t('outcomeUi.confirmDeleteCommentary') }}</p><div class="mt-3 flex flex-wrap gap-2">
            <button
              class="secondary"
              type="button"
              :disabled="disabled"
              @click="removeSaved"
            >
              {{ t('outcomeUi.confirmRemove') }}
            </button><button
              class="secondary"
              type="button"
              :disabled="disabled"
              @click="confirmRemove = false"
            >
              {{ t('outcomeUi.cancel') }}
            </button>
          </div>
        </div><button
          v-else
          class="secondary"
          type="button"
          :disabled="disabled"
          @click="confirmRemove = true"
        >
          {{ t('outcomeUi.deleteCommentary') }}
        </button>
      </div>
      <HostFollowUp
        v-if="review.record.status === 'completed'"
        :disabled="disabled"
        label="outcomeUi.askReview"
        :request="t('outcomeUi.reviewRequest', { id: review.record.id })"
        :send="followUp"
      />
    </section>
    <section>
      <h2 class="font-serif text-2xl">
        {{ t('outcomeUi.decisionHistory') }}
      </h2><p
        v-if="!review.related.decisions.data.length"
        class="my-4 text-sm text-muted"
      >
        {{ t('outcomeUi.empty') }}
      </p><ol class="mt-4 space-y-4">
        <li
          v-for="decision in review.related.decisions.data"
          :key="decision.id"
          class="rounded border border-surface-dark p-4"
        >
          <h3 class="font-serif text-xl">
            {{ decision.headline }}
          </h3><p class="my-2 text-xs text-muted">
            {{ t(`outcomeUi.${decision.state}`) }} · <time :datetime="decision.createdAt">{{ date(decision.createdAt) }}</time>
          </p><p class="whitespace-pre-wrap">
            {{ decision.explanation }}
          </p><dl
            v-if="decision.factors.length"
            class="mt-4 space-y-3"
          >
            <div
              v-for="(factor, index) in decision.factors"
              :key="index"
            >
              <dt class="font-semibold">
                {{ factor.label }}
              </dt><dd
                v-if="factor.detail"
                class="mt-1 text-sm"
              >
                {{ factor.detail }}
              </dd>
            </div>
          </dl><ul
            v-if="decision.changes.length"
            class="mt-3 list-inside list-disc"
          >
            <li
              v-for="(change, index) in decision.changes"
              :key="index"
            >
              {{ change.summary }}
            </li>
          </ul><section
            v-if="decision.limitations.length"
            class="mt-4 text-sm text-muted"
          >
            <h4 class="font-semibold">
              {{ t('outcomeUi.limitations') }}
            </h4><ul class="mt-2 list-inside list-disc">
              <li
                v-for="(limitation, index) in decision.limitations"
                :key="index"
              >
                {{ limitation }}
              </li>
            </ul>
          </section>
        </li>
      </ol><OutcomePagination
        :disabled="disabled || dirty"
        :meta="review.related.decisions.meta"
        @page="navigate({ name: 'open_workout_review', arguments: { workoutId: review.record.id, page: $event, limit: review.related.decisions.meta.limit } }, true)"
      />
    </section>
  </article>
</template>
