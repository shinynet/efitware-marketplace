<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GoalPlanView } from './goalModel'
import { formatDay } from './planningModel'
import HostFollowUp from './HostFollowUp.vue'
import type { createWorkoutConnection } from './workoutConnection'
const { plan, disabled, navigate, update, followUp } = defineProps<{
  plan: GoalPlanView, disabled: boolean,
  navigate: ReturnType<typeof createWorkoutConnection>['navigate'], update: ReturnType<typeof createWorkoutConnection>['updateGoalPlan'], followUp: ReturnType<typeof createWorkoutConnection>['sendFollowUp']
}>()
const { t, locale } = useI18n()
const displayed = computed(() => plan.related.displayedVersion)
const current = computed(() => displayed.value.id === plan.related.activeVersion.id)
const manual = computed(() => plan.record.managementMode === 'manual')
const meta = computed(() => plan.related.historyMeta)
const n = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const dateTime = (instant: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short', timeZone: plan.presentation.timeZone }).format(new Date(instant))
const open = (versionId: string, page = meta.value.page) => navigate({ name: 'open_goal_plan', arguments: { planId: plan.record.id, today: plan.related.today, page, limit: meta.value.limit, versionId } }, true)
const author = (version: GoalPlanView['related']['displayedVersion'] | GoalPlanView['related']['history'][number]) => t(version.externalMcp ? 'externalAuthorship' : version.authoredBy === 'coach' ? 'coachAuthorship' : 'userAuthorship')
const phaseState = (start: string, end: string) => t(end < plan.related.today ? 'phasePast' : start > plan.related.today ? 'phaseFuture' : 'phaseCurrent')
</script>
<template>
  <article>
    <header class="mb-6">
      <p class="text-xs font-semibold uppercase tracking-widest text-gold-ink">
        {{ t('goalPlan') }}
      </p>
      <h1 class="mt-2 font-serif text-3xl sm:text-4xl">
        {{ plan.related.goal.name }}
      </h1>
      <p class="mt-2 text-sm text-muted">
        {{ t(`planStatus.${plan.record.status}`) }} · {{ t(manual ? 'manualManagement' : 'coachManagement') }}
      </p>
      <p
        v-if="!manual && plan.related.aiPaused"
        class="mt-3 text-sm"
      >
        {{ t('coachPaused') }}
      </p>
      <button
        type="button"
        class="secondary mt-4"
        :disabled
        @click="navigate({ name: 'open_goal', arguments: { goalId: plan.record.goalId, today: plan.related.today } })"
      >
        {{ t('viewGoal') }}
      </button>
    </header>
    <section
      class="mb-6 rounded bg-surface p-4"
      aria-labelledby="plan-version-title"
    >
      <h2
        id="plan-version-title"
        class="font-serif text-2xl"
      >
        {{ t('planVersion', { number: n(displayed.version) }) }}
      </h2>
      <p class="mt-2 text-sm text-gold-ink">
        {{ t(current ? 'activeVersion' : 'historicalVersion') }}
      </p>
      <p class="mt-2 text-sm text-muted">
        {{ author(displayed) }} · <time :datetime="displayed.createdAt">{{ dateTime(displayed.createdAt) }}</time>
      </p>
      <p class="mt-3 font-semibold">
        {{ t(`feasibility.${displayed.feasibility}`) }}
      </p>
      <p class="mt-2 text-sm text-muted">
        {{ t('feasibilityNote') }}
      </p>
      <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
        {{ displayed.rationale }}
      </p>
      <div
        v-if="!current"
        class="mt-4 flex flex-wrap gap-2"
      >
        <button
          type="button"
          class="secondary"
          :disabled
          @click="open(plan.related.activeVersion.id)"
        >
          {{ t('viewActiveVersion') }}
        </button>
        <button
          v-if="manual"
          type="button"
          class="secondary"
          :disabled
          @click="update({ versionId: displayed.id })"
        >
          {{ t('activateVersion') }}
        </button>
      </div>
      <p
        v-if="!current && manual"
        class="mt-3 text-sm text-muted"
      >
        {{ t('activationNote') }}
      </p>
    </section>
    <section
      class="mb-6"
      aria-labelledby="plan-phases-title"
    >
      <h2
        id="plan-phases-title"
        class="mb-2 font-serif text-2xl"
      >
        {{ t('planPhases') }}
      </h2>
      <p class="mb-4 text-sm text-muted">
        {{ t('phaseDatesNote') }}
      </p>
      <ol class="space-y-4">
        <li
          v-for="(phase, index) in displayed.phases"
          :key="phase.id"
          class="border-l-2 border-gold-ink pl-4"
        >
          <p class="text-xs font-semibold uppercase tracking-widest text-gold-ink">
            {{ t('phaseNumber', { number: n(index + 1) }) }} · {{ phaseState(phase.startDate, phase.endDate) }}
          </p>
          <h3 class="mt-2 font-serif text-xl">
            {{ phase.name }}
          </h3>
          <p class="mt-2 text-sm text-muted">
            <time :datetime="phase.startDate">{{ formatDay(phase.startDate, locale) }}</time> {{ t('through') }} <time :datetime="phase.endDate">{{ formatDay(phase.endDate, locale) }}</time>
          </p>
          <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {{ phase.objective }}
          </p>
          <p
            v-if="phase.reviewDate"
            class="mt-2 text-sm text-muted"
          >
            {{ t('plannedReview') }} <time :datetime="phase.reviewDate">{{ formatDay(phase.reviewDate, locale) }}</time>
          </p>
          <h4
            v-if="phase.milestones.length"
            class="mt-4 font-semibold"
          >
            {{ t('milestones') }}
          </h4>
          <ul class="mt-2 list-disc space-y-2 pl-5">
            <li
              v-for="milestone in phase.milestones"
              :key="milestone.id"
              class="text-sm"
            >
              <p>{{ milestone.description }}</p><time
                v-if="milestone.date"
                :datetime="milestone.date"
                class="text-muted"
              >{{ formatDay(milestone.date, locale) }}</time>
            </li>
          </ul>
          <button
            v-if="phase.programId && phase.programName"
            type="button"
            class="secondary mt-4"
            :disabled
            @click="navigate({ name: 'open_program', arguments: { programId: phase.programId, today: plan.related.today } })"
          >
            {{ phase.programName }}
          </button>
          <p
            v-else-if="phase.programId"
            class="mt-4 text-sm text-muted"
          >
            {{ t('removedProgram') }}
          </p>
        </li>
      </ol>
    </section>
    <section
      class="mb-6"
      aria-labelledby="plan-history-title"
    >
      <h2
        id="plan-history-title"
        class="mb-3 font-serif text-2xl"
      >
        {{ t('versionHistory') }}
      </h2>
      <ol class="space-y-3">
        <li
          v-for="version in plan.related.history"
          :key="version.id"
          class="rounded border border-surface-dark p-4"
        >
          <button
            type="button"
            class="secondary"
            :aria-pressed="version.id === displayed.id"
            :disabled
            @click="open(version.id)"
          >
            {{ t('planVersion', { number: n(version.version) }) }}
          </button>
          <p class="mt-2 text-sm text-muted">
            {{ author(version) }} · <time :datetime="version.createdAt">{{ dateTime(version.createdAt) }}</time>
          </p>
          <p
            v-if="version.revisionEvidence"
            class="mt-2 text-sm"
          >
            {{ t('revisionEvidence', { replaced: n(version.revisionEvidence.replacedCount), skipped: n(version.revisionEvidence.skippedCount) }) }}
          </p>
          <ul
            v-else
            class="mt-2 space-y-1"
          >
            <li
              v-for="(line, index) in version.changedSummary"
              :key="index"
              class="text-sm"
            >
              {{ line }}
            </li>
          </ul>
        </li>
      </ol>
      <nav
        :aria-label="t('pagination')"
        class="mt-4 flex flex-wrap items-center justify-between gap-3"
      >
        <button
          type="button"
          class="secondary"
          :disabled="disabled || meta.page <= 1"
          @click="open(displayed.id, meta.page - 1)"
        >
          {{ t('previous') }}
        </button>
        <p class="text-sm">
          {{ t('pageOf', { page: n(meta.page), total: n(Math.max(1, Math.ceil(meta.total / meta.limit))) }) }}
        </p>
        <button
          type="button"
          class="secondary"
          :disabled="disabled || meta.page * meta.limit >= meta.total"
          @click="open(displayed.id, meta.page + 1)"
        >
          {{ t('next') }}
        </button>
      </nav>
      <details
        v-if="plan.related.noChangeReviews.length"
        class="mt-4"
      >
        <summary>{{ t('unchangedReviews') }}</summary><ol class="mt-3 space-y-3">
          <li
            v-for="review in plan.related.noChangeReviews"
            :key="review.id"
            class="text-sm"
          >
            <time
              :datetime="review.reviewedAt"
              class="text-muted"
            >{{ dateTime(review.reviewedAt) }}</time>
            <p class="mt-1">
              {{ review.evidenceFacts ? t('reviewEvidence', { sessions: n(review.evidenceFacts.completedSessions), goals: n(review.evidenceFacts.attributedSessions), prs: n(review.evidenceFacts.prCount), checkIns: n(review.evidenceFacts.checkInCount), commitments: n(review.evidenceFacts.commitmentCount) }) : review.evidence }}
            </p>
          </li>
        </ol>
      </details>
    </section>
    <section
      class="rounded bg-surface p-4"
      aria-labelledby="plan-actions-title"
    >
      <h2
        id="plan-actions-title"
        class="font-serif text-xl"
      >
        {{ t('managePlan') }}
      </h2><p class="mt-2 text-sm text-muted">
        {{ t(manual ? 'planStatusNote' : 'coachManagementNote') }}
      </p>
      <div
        v-if="manual"
        class="mt-3 flex flex-wrap gap-2"
      >
        <button
          v-for="status in (['active', 'paused', 'completed', 'archived'] as const).filter(status => status !== plan.record.status)"
          :key="status"
          type="button"
          class="secondary"
          :disabled
          @click="update({ status })"
        >
          {{ t(`setPlanStatus.${status}`) }}
        </button>
      </div>
      <host-follow-up
        :key="plan.record.id"
        :disabled
        :send="followUp"
        :request="t('planAdaptPrompt', { id: plan.record.id })"
      />
    </section>
  </article>
</template>
