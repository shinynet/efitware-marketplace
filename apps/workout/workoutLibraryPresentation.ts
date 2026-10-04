import type { LibraryFit, LibraryItem, WorkoutLibraryView } from './workoutLibraryModel'

/** The translator the card and its compact summary share (vue-i18n's `t`/`te`). */
export interface LibraryTranslator {
  t: (key: string, params?: Record<string, unknown> | number, plural?: number) => string
  te: (key: string) => boolean
  locale: string
}

const integer = (locale: string, value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)

/** "20 min", or "17–20 min" across a Program's sessions. */
export const minutesLabel = ({ t, locale }: LibraryTranslator, range: LibraryItem['sessionMinutes']): string => range.min === range.max
  ? t('workoutLibraryUi.minutes', { minutes: integer(locale, range.max) })
  : t('workoutLibraryUi.minutesRange', { min: integer(locale, range.min), max: integer(locale, range.max) })

export const fitLabel = ({ t }: LibraryTranslator, fit: LibraryFit): string =>
  fit.state === 'needs-space' ? t('workoutLibraryUi.needsSetup') : t(`workoutLibraryVocabulary.fit.${fit.state === 'adaptable' ? 'adaptable' : fit.state}`)

/** A vocabulary label (`format`, `focus`, …), or the raw value when the card predates it. */
export const vocabularyLabel = ({ t, te }: LibraryTranslator, group: string, value: string): string =>
  te(`workoutLibraryVocabulary.${group}.${value}`) ? t(`workoutLibraryVocabulary.${group}.${value}`) : value

export const equipmentLabel = ({ t, te }: LibraryTranslator, slug: string): string =>
  te(`contextVocabulary.equipment.${slug}`) ? t(`contextVocabulary.equipment.${slug}`) : slug.replaceAll('_', ' ')

export const spaceLabel = ({ t }: LibraryTranslator, space: WorkoutLibraryView['record']['trainingSpace']): string =>
  space.name.trim() || t('workoutLibraryUi.defaultSpace')

const list = (locale: string, values: string[]) => new Intl.ListFormat(locale, { type: 'conjunction' }).format(values)

/**
 * The fit in sentences: each swap with its cause, or why the item cannot run.
 * Search results carry swaps without names; the item and preview name them.
 */
export const fitLines = (translator: LibraryTranslator, fit: LibraryFit): string[] => {
  const { t, locale } = translator
  if (fit.state === 'exact') return [t('workoutLibraryUi.exactNote')]
  if (fit.state === 'needs-space') return []
  if (fit.state === 'adaptable') {
    if (fit.swaps.every(swap => !swap.name)) return [t('workoutLibraryUi.swapCount', { n: fit.swaps.length }, fit.swaps.length)]
    return fit.swaps.map((swap) => {
      const exercise = swap.name ?? t('workoutLibraryUi.anExercise')
      if (swap.cause === 'equipment') return t('workoutLibraryUi.swapEquipment', { exercise, equipment: list(locale, swap.missingEquipment.map(slug => equipmentLabel(translator, slug))) })
      return t(swap.cause === 'personal' ? 'workoutLibraryUi.swapPersonal' : 'workoutLibraryUi.swapLimitations', { exercise })
    })
  }
  if (fit.reason === 'equipment') return [t('workoutLibraryUi.unavailableEquipment', { equipment: list(locale, (fit.missingEquipment ?? []).map(slug => equipmentLabel(translator, slug))) })]
  if (fit.reason === 'days') return [t('workoutLibraryUi.unavailableDays', { n: fit.requiredDays ?? 0 }, fit.requiredDays ?? 0)]
  if (fit.reason === 'limitations') {
    const names = fit.exercises.flatMap(exercise => exercise.name ? [exercise.name] : [])
    return [t('workoutLibraryUi.unavailableLimitations', { exercises: names.length ? list(locale, names) : t('workoutLibraryUi.anExercise').toLowerCase() })]
  }
  return [t(fit.reason === 'personal' ? 'workoutLibraryUi.unavailablePersonal' : 'workoutLibraryUi.unavailableCatalog')]
}
