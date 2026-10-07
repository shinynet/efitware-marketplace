import type { LoadShape } from './model'
import type { ExerciseProgressView } from './focusedProgressModel'
import type { Translate } from './compactSummary'
import { formatLoad, type Measurement } from './measurement'

/** Public load semantics, never an exercise-name or numeric-weight guess. */
export const exerciseProgressLoadShape = (exercise: ExerciseProgressView): LoadShape | undefined =>
  exercise.related.stats.loadShape
  ?? exercise.related.progression.data.find(entry => entry.id === exercise.record.id)?.loadShape
  ?? (exercise.record.addedLoadOptions?.length ? 'added' : undefined)

/** A recorded load as supplied by the producer; zero added load is body weight. */
export const progressLoad = (weight: Measurement | null | undefined, shape: LoadShape | undefined, locale: string, t: Translate): string => {
  if (weight == null) return t('progressUi.unavailable')
  if (shape !== 'added') return formatLoad(weight, locale)
  return weight.value === 0 ? t('progressUi.bodyWeight') : t('progressUi.positiveAdded', { weight: formatLoad(weight, locale) })
}

/** Known body-weight work has no estimated external-implement maximum. */
export const hasExternalEstimate = (shape: LoadShape | undefined): boolean => shape !== 'added' && shape !== 'none'
