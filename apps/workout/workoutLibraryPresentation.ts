import { prescriptionSummary, type LibraryFit, type LibraryItem, type LibrarySession, type PlannedSet, type SetGroup, type WorkoutLibraryView } from './workoutLibraryModel'

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

/** Focus then style, in authored order: an item's one-line character, listed as the application's Library card lists it (`compactList`). */
export const tagLine = (translator: LibraryTranslator, tags: Pick<LibraryItem['tags'], 'focus' | 'style'>): string =>
  new Intl.ListFormat(translator.locale, { type: 'unit', style: 'short' }).format([
    ...tags.focus.map(value => vocabularyLabel(translator, 'focus', value)),
    ...tags.style.map(value => vocabularyLabel(translator, 'style', value))
  ])

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

const groupLine = ({ t, te, locale }: LibraryTranslator, group: SetGroup, labelled: boolean): string => {
  const count = integer(locale, group.count)
  const number = (value: number) => new Intl.NumberFormat(locale).format(value)
  const reps = group.reps && (group.reps.min === group.reps.max ? number(group.reps.max) : `${number(group.reps.min)}–${number(group.reps.max)}`)
  const value = reps
    ? t('workoutLibraryUi.setsReps', { sets: count, reps })
    : group.seconds !== undefined ? t('workoutLibraryUi.setsSeconds', { sets: count, seconds: number(group.seconds) }) : t('workoutLibraryUi.sets', { n: count }, group.count)
  const kind = labelled && group.category !== 'working'
    ? te(`workoutLibraryUi.setKind.${group.category}`) ? t(`workoutLibraryUi.setKind.${group.category}`) : group.category
    : undefined
  return [value, kind, group.side && t(`workoutLibraryUi.setSide.${group.side}`)].filter(Boolean).join(' ')
}

/**
 * A slot's sets in one line: "3 × 8–12 reps + 1 warm-up", "2 × 20 s each
 * side", "6 × 30 s work · 5 × 60 s recovery + 1 warm-up + 1 cool-down".
 * Every distinct prescription stays visible; nothing is merged that differs.
 */
export const prescriptionLine = (translator: LibraryTranslator, sets: PlannedSet[]): string => {
  const { t, locale } = translator
  const summary = prescriptionSummary(sets)
  // a warm-up section's own sets are the summary: they carry a kind only beside a different one
  const labelled = new Set(summary.groups.map(group => group.category)).size > 1 || summary.groups.some(group => group.category !== 'warmup' && group.category !== 'cooldown')
  const extras = [
    ...(summary.warmup ? [t('workoutLibraryUi.warmups', { n: integer(locale, summary.warmup) }, summary.warmup)] : []),
    ...(summary.cooldown ? [t('workoutLibraryUi.cooldowns', { n: integer(locale, summary.cooldown) }, summary.cooldown)] : [])
  ]
  return [summary.groups.map(group => groupLine(translator, group, labelled)).join(' · '), ...extras].filter(Boolean).join(' ')
}

/** A planned circuit's clock, with the same localized wording as the application. */
export const timedFormatLabel = (translator: LibraryTranslator, format: NonNullable<NonNullable<LibrarySession['executionGroups']>[number]['format']>): string => {
  const { t, locale } = translator
  const count = (value: number) => integer(locale, value)
  const duration = (seconds: number) => seconds % 60 === 0
    ? t('workoutLibraryUi.minutes', { minutes: count(seconds / 60) })
    : `${count(Math.floor(seconds / 60))}:${new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(seconds % 60)}`
  switch (format.type) {
    case 'amrap': return t('workoutLibraryUi.groupFormat.amrap', { cap: duration(format.capSeconds) })
    case 'emom': return t('workoutLibraryUi.groupFormat.emom', { length: duration(format.minutes * 60) })
    case 'for-time': return t('workoutLibraryUi.groupFormat.forTime', { cap: duration(format.capSeconds) })
    case 'tabata': return t('workoutLibraryUi.groupFormat.tabata', { rounds: count(format.rounds), work: count(format.workSeconds), rest: count(format.restSeconds) })
  }
}
