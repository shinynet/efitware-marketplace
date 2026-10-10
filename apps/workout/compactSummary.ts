import type { TrainingView } from './templateModel'
import type { ReceiptsView } from './outcomeModel'
import type { ViewExercise, ViewSet } from './model'
import type { UnitSystem } from './lib/units'
import { formatMeasure } from './presentation'
import { accountBodyMetricUnit, accountLoadUnit, bodyMetricLabelKey, bodyMetricPageKey, formatBodyMetric, formatLoad, formatTotal, seriesUnit, sumLoads, type Total } from './measurement'
import { summarizeRecurrence } from './recurrencePresentation'
import { exerciseProgressLoadShape, hasExternalEstimate, prescriptionLoad, progressLoad } from './addedLoadPresentation'
import { workoutSections } from './lib/sections'
import { workoutLibraryPath, type LibraryCover } from './workoutLibraryModel'
import { fitLabel, fitLines, minutesLabel, spaceLabel, vocabularyLabel, type LibraryTranslator } from './workoutLibraryPresentation'

/** Translate with optional interpolation values; mirrors vue-i18n's `t`. */
export type Translate = (key: string, values?: Record<string, string | number>) => string
export interface CompactFact { label: string, value: string }
export interface CompactBars { label: string, values: number[], start: string, end: string }
export interface CompactSummary {
  /** Small uppercase context line above the title. */
  eyebrow: string
  title: string
  /** At most three label/value pairs shown at a glance. */
  facts: CompactFact[]
  /** Optional single highlighted row (for example the next set to log). */
  detail?: CompactFact
  /** Optional small bar chart of a bounded series. */
  bars?: CompactBars
  /** A Library item's cover thumbnail, beside the title (app EF-1609). */
  cover?: LibraryCover
  /** Path on app.efitware.com opened by the header link (absolute URLs pass through). */
  path: string
}
interface Options { locale: string, system: UnitSystem, t: Translate, te?: (key: string) => boolean }

const APP_ORIGIN = 'https://app.efitware.com'
/** Fewer points than this read as blocks rather than a trend, so the chart is omitted. */
export const MIN_BARS = 4
export const appUrl = (path: string) => /^https?:\/\//.test(path) ? path : `${APP_ORIGIN}${path}`
export const shortDay = (date: string, locale: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
const monthDay = (date: string, locale: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
const number = (value: number, locale: string, digits = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
const clip = (text: string, max = 90) => text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
/** A headline metric's plain number; training volume is a measurement object instead. */
const plain = (value: number | Total | undefined) => typeof value === 'number' ? value : undefined
const dot = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' · ')

/** First incomplete set in the presented order (warm-up → main → cool-down, then order within each section), with its parent exercise. */
export const nextSet = (exercises: ViewExercise[]): { exercise: ViewExercise, set: ViewSet } | undefined => {
  for (const section of workoutSections(exercises, [])) {
    for (const item of section.items) {
      if (item.type !== 'exercise') continue
      const set = item.data.sets.find(candidate => !candidate.completed)
      if (set) return { exercise: item.data, set }
    }
  }
  return undefined
}
/**
 * Completed-set volume as a whole-unit total in the loads' own unit; only sets with recorded weight and
 * reps count. Undefined when nothing counts or the loads mix units: the card never converts a load.
 */
export const completedVolume = (exercises: ViewExercise[]): Total | undefined => {
  const entries = exercises.flatMap(exercise => exercise.sets).flatMap(set => set.completed && set.weight && set.weight.value > 0 && set.reps ? [{ load: set.weight, reps: set.reps }] : [])
  return entries.length ? sumLoads(entries) : undefined
}
const setTarget = (set: ViewSet, modality: ViewExercise['modality'], { locale, system, t }: Options) => {
  const parts: string[] = []
  const load = prescriptionLoad(set.plannedWeight, modality, undefined, locale, t)
  if (load) parts.push(load)
  if (set.plannedReps) parts.push(t('repTarget', { value: set.plannedReps.min === set.plannedReps.max ? number(set.plannedReps.min, locale, 0) : t('range', { min: number(set.plannedReps.min, locale, 0), max: number(set.plannedReps.max, locale, 0) }) }))
  if (set.plannedDuration !== undefined) parts.push(formatMeasure('duration', set.plannedDuration, system, locale))
  if (set.plannedDistance !== undefined) parts.push(formatMeasure('distance', set.plannedDistance, system, locale))
  if (set.plannedAmrap) parts.push(t('compact.amrap'))
  return parts.length ? parts.join(' × ') : t('noTarget')
}

/** The receipt the compact card displays, only when that exact action can still be undone. */
export const undoTarget = (view: ReceiptsView) => {
  const latest = view.record.data[0]
  return latest && latest.undoable && !latest.undoneAt ? latest : undefined
}

/** Pure at-a-glance projection of any training view; actions stay in the card component. */
export const compactSummary = (view: TrainingView, options: Options): CompactSummary => {
  const { locale, system, t } = options
  const fact = (label: string, value: string): CompactFact => ({ label, value })
  const count = (value: number) => number(value, locale, 0)
  switch (view.view) {
    case 'workout': {
      const { workout, exercises } = view.record
      const sets = workout.exercises.flatMap(exercise => exercise.sets)
      const done = sets.filter(set => set.completed).length
      const volume = completedVolume(workout.exercises)
      const next = nextSet(workout.exercises)
      const name = (exercise: ViewExercise) => locale === 'de' ? exercises.find(tracked => tracked.id === exercise.exerciseId)?.nameDe ?? exercise.exerciseName : exercise.exerciseName
      return {
        eyebrow: dot(t('compact.workout'), shortDay(workout.date, locale)), title: workout.title,
        facts: [fact(t('compact.setsDone'), t('compact.ofTotal', { done: count(done), total: count(sets.length) })), volume ? fact(t('compact.volume'), formatTotal(volume, locale)) : fact(t('compact.exercises'), count(workout.exercises.length)), fact(t('compact.status'), t(workout.status))],
        ...(next ? { detail: fact(t('compact.nextSet'), dot(name(next.exercise), setTarget(next.set, next.exercise.modality, options))) } : {}),
        path: `/workouts/${workout.date}/${workout.id}`
      }
    }
    case 'template': {
      const { record } = view
      const sets = record.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
      const activities = (record.activities?.length ?? 0) + record.exercises.reduce((sum, exercise) => sum + (exercise.activities?.length ?? 0), 0)
      return { eyebrow: t('reusableTemplate'), title: record.name, facts: [fact(t('compact.exercises'), count(record.exercises.length)), fact(t('compact.sets'), count(sets)), fact(t('compact.activities'), count(activities))], path: `/saved-workouts/${record.id}` }
    }
    case 'program': {
      const { record, related } = view
      return {
        eyebrow: dot(t('trainingProgram'), t(record.status)), title: record.name,
        facts: [fact(t('workoutCount'), count(related.workoutCount)), fact(t('schedules'), count(related.schedulesMeta.total)), related.supportsGoal ? fact(t('compact.goal'), related.supportsGoal.name) : fact(t('compact.span'), related.span ? `${monthDay(related.span.startDate, locale)} – ${monthDay(related.span.endDate, locale)}` : t('compact.none'))],
        path: `/programs/${record.id}`
      }
    }
    case 'schedule': {
      const { record } = view
      return {
        eyebrow: dot(t('recurringSchedule'), t(record.enabled ? 'scheduleEnabled' : 'schedulePaused')), title: record.name,
        facts: [fact(t('nextOccurrence'), record.nextOccurrence ? shortDay(record.nextOccurrence, locale) : t('noOccurrence')), fact(t('compact.recurrence'), summarizeRecurrence(record.recurrence, locale, t)), fact(t('compact.template'), record.templateName ?? t('compact.none'))],
        path: `/schedules/${record.id}/edit`
      }
    }
    case 'calendar': {
      // Counts only: a `completed` day status means completed is the highest bucket present, not that every session was done.
      const { record } = view
      const sessions = record.days.reduce((sum, day) => sum + day.sessionCount, 0)
      const completed = record.days.reduce((sum, day) => sum + day.completedSessionCount, 0)
      const trained = record.days.filter(day => day.completedSessionCount > 0).length
      const item = record.agenda?.items[0]
      return {
        eyebrow: dot(t('trainingCalendar'), `${monthDay(record.from, locale)} – ${monthDay(record.to, locale)}`), title: shortDay(record.date, locale),
        facts: [fact(t('compact.sessions'), count(sessions)), fact(t('completed'), count(completed)), fact(t('compact.daysTrained'), count(trained))],
        ...(item ? { detail: fact(t('compact.agenda'), dot(item.name, t(item.displayStatus))) } : {}),
        path: `/training/${record.date}`
      }
    }
    case 'goal': {
      const { record, related } = view
      const latest = related.latestCheckIn
      return {
        eyebrow: dot(t('compact.goal'), t(`goalStatus.${record.status}`)), title: record.name,
        facts: [fact(t('compact.targetDate'), record.targetDate ? monthDay(record.targetDate, locale) : t('compact.none')), fact(t('compact.daysLeft'), record.targetDate ? count(Math.max(0, daysBetween(related.today, record.targetDate))) : '—'), fact(t('compact.lastCheckIn'), latest ? dot(latest.value, monthDay(latest.date, locale)) : t('compact.none'))],
        path: `/goals/${record.id}`
      }
    }
    case 'goal-plan': {
      const { record, related } = view
      const version = related.displayedVersion
      const current = version.phases.find(phase => phase.startDate <= related.today && related.today <= phase.endDate)
      return {
        eyebrow: dot(t('compact.goalPlan'), t(`planStatus.${record.status}`)), title: related.goal.name,
        facts: [fact(t('compact.phases'), count(version.phases.length)), fact(t('compact.currentPhase'), current?.name ?? t('compact.none')), fact(t('compact.version'), count(version.version))],
        path: `/goals/${record.goalId}/plan`
      }
    }
    case 'progress': {
      const { record } = view
      const metric = (key: string) => record.metrics.find(entry => entry.key === key)
      const volume = metric('volume')
      const delta = volume?.delta !== undefined && volume.deltaKind === 'percent' ? volume.delta : undefined
      const title = delta === undefined ? t('progressUi.title') : t(delta >= 0 ? 'compact.volumeUp' : 'compact.volumeDown', { value: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(Math.abs(delta)) })
      const bars = record.weeklyVolume.map(week => week.volume.value)
      const total = volume && typeof volume.value === 'object' ? volume.value : { value: 0, unit: accountLoadUnit(system) }
      return {
        eyebrow: dot(t('compact.progress'), t(`progressUi.ranges.${record.range}`)), title,
        facts: [fact(t('compact.sessions'), count(plain(metric('sessions')?.value) ?? record.consistency.sessionsDone)), fact(t('compact.volume'), formatTotal(total, locale)), fact(t('compact.records'), count(plain(metric('prs')?.value) ?? record.recentPrs.length))],
        ...(bars.length >= MIN_BARS ? { bars: { label: t('compact.weeklyVolume'), values: bars, start: monthDay(record.weeklyVolume[0]!.weekStart, locale), end: monthDay(record.weeklyVolume.at(-1)!.weekStart, locale) } } : {}),
        path: '/progress'
      }
    }
    case 'exercise-progress': {
      const { record, related } = view
      const shape = exerciseProgressLoadShape(view)
      const added = shape === 'added'
      const series = hasExternalEstimate(shape) ? related.progression.data.find(entry => entry.id === record.id)?.series ?? [] : []
      const top = related.stats.topSet
      return {
        eyebrow: t('compact.exerciseProgress'), title: locale === 'de' ? record.i18n?.de?.name ?? record.name : record.name,
        facts: [fact(t('compact.sessions'), count(related.stats.sessions)), fact(t('compact.records'), count(related.stats.prCount)), ...(added ? top && top.weight.value > 0 ? [fact(t('progressUi.heaviestAdded'), progressLoad(top.weight, shape, locale, t))] : [] : [fact(t('compact.topSet'), top ? `${formatLoad(top.weight, locale)} × ${count(top.reps)}` : t('compact.none'))])],
        ...(series.length >= MIN_BARS ? { bars: { label: t('progressUi.estimated'), values: series.map(point => point.value.value), start: monthDay(series[0]!.date, locale), end: monthDay(series.at(-1)!.date, locale) } } : {}),
        path: `/progress/exercises/${record.id}`
      }
    }
    case 'body-metric': {
      const { record, related } = view
      const key = record.key
      const label = t(bodyMetricLabelKey(key))
      // Observations render as given, unsnapped at one decimal and never converted (measurement.ts).
      const unit = seriesUnit(related.observations.data, accountBodyMetricUnit(key, system))
      const format = (value: number) => formatBodyMetric({ value, unit }, locale, text => t('progressUi.bpm', { value: text }))
      const points = [...related.observations.data].sort((a, b) => a.date.localeCompare(b.date))
      const first = points[0], last = points.at(-1)
      const change = first && last && first !== last && first.value.unit === last.value.unit ? Math.round((last.value.value - first.value.value) * 10) / 10 : undefined
      return {
        eyebrow: dot(t('progressUi.body'), `${monthDay(record.from, locale)} – ${monthDay(record.to, locale)}`), title: last ? `${label}: ${format(last.value.value)}` : label,
        facts: [fact(t('compact.latest'), last ? monthDay(last.date, locale) : t('compact.none')), fact(t('compact.change'), change === undefined ? '—' : `${change > 0 ? '+' : change < 0 ? '−' : ''}${format(Math.abs(change))}`), fact(t('compact.observations'), count(related.observations.meta.total))],
        ...(points.length >= MIN_BARS ? { bars: { label, values: points.map(point => point.value.value), start: monthDay(first!.date, locale), end: monthDay(last!.date, locale) } } : {}),
        path: `/progress/body/${bodyMetricPageKey(key)}`
      }
    }
    case 'library': {
      const { record, related } = view
      const first = related.exercises.data.slice(0, 3).map(exercise => locale === 'de' ? exercise.i18n?.de.name ?? exercise.name : exercise.name)
      return {
        eyebrow: t('compact.library'), title: record.query.q ? t('compact.resultsFor', { query: record.query.q }) : t('compact.exerciseLibrary'),
        facts: [fact(t('compact.results'), count(related.exercises.meta.total)), fact(t('compact.modality'), record.query.modality ? t(`contextUi.${record.query.modality}`) : t('compact.all')), fact(t('compact.showing'), t(`contextUi.${record.query.show}`))],
        ...(first.length ? { detail: fact(t('compact.topMatches'), first.join(', ')) } : {}),
        path: '/exercises'
      }
    }
    case 'workout-library': {
      const { record } = view
      // the card's translator is vue-i18n's, so plural forms resolve at runtime
      const library: LibraryTranslator = { t: t as LibraryTranslator['t'], te: options.te ?? (() => false), locale }
      if (record.mode === 'browse') {
        const first = record.data.slice(0, 3).map(item => item.title)
        return {
          eyebrow: t('workoutLibraryUi.eyebrow'), title: t('workoutLibraryUi.browseTitle'),
          facts: [fact(t('workoutLibraryUi.results'), count(record.meta.total)), fact(t('workoutLibraryUi.space'), spaceLabel(library, record.trainingSpace)), fact(t('compact.showing'), record.query.format ? vocabularyLabel(library, 'format', record.query.format) : t('compact.all'))],
          ...(first.length ? { detail: fact(t('workoutLibraryUi.topMatches'), first.join(', ')) } : {}),
          path: workoutLibraryPath(record)
        }
      }
      const line = record.fit.state === 'needs-space' ? t('workoutLibraryUi.needsSpace', { space: spaceLabel(library, record.trainingSpace) }) : fitLines(library, record.fit)[0]
      return {
        eyebrow: t('workoutLibraryUi.itemEyebrow', { format: vocabularyLabel(library, 'format', record.format) }), title: record.title,
        facts: [fact(t('workoutLibraryUi.space'), spaceLabel(library, record.trainingSpace)), fact(t('workoutLibraryUi.fit'), fitLabel(library, record.fit)), fact(t('workoutLibraryUi.length'), minutesLabel(library, record.sessionMinutes))],
        ...(line ? { detail: fact(fitLabel(library, record.fit), clip(line)) } : {}),
        ...(record.cover ? { cover: record.cover } : {}),
        path: workoutLibraryPath(record)
      }
    }
    case 'exercise': {
      const { record } = view
      return {
        eyebrow: dot(t('compact.exercise'), t(`contextUi.${record.modality}`)), title: locale === 'de' ? record.i18n?.de.name ?? record.name : record.name,
        facts: [fact(t('contextUi.equipment'), record.equipmentRequired?.length ? record.equipmentRequired.map(item => view.related.customEquipment.find(entry => entry.id === item)?.name ?? (options.te?.(`contextVocabulary.equipment.${item}`) ? t(`contextVocabulary.equipment.${item}`) : item)).join(', ') : t('compact.none')), fact(t('compact.kind'), t(record.isCustom ? 'compact.custom' : 'compact.catalog')), fact(t('compact.favorite'), t(record.isFavorite ? 'compact.yes' : 'compact.no'))],
        path: `/exercises/${record.id}`
      }
    }
    case 'context': {
      const { profile } = view.record
      return {
        eyebrow: t('compact.context'), title: profile.preferredName ? t('compact.contextFor', { name: profile.preferredName }) : t('compact.contextTitle'),
        facts: [fact(t('compact.daysPerWeek'), profile.daysPerWeek === null ? '—' : count(profile.daysPerWeek)), fact(t('compact.minutesPerSession'), profile.minutesPerSession === null ? '—' : count(profile.minutesPerSession)), fact(t('compact.spaces'), count(view.record.trainingSpaces.length))],
        path: '/settings'
      }
    }
    case 'memory': {
      const { record } = view
      return { eyebrow: dot(t('compact.memory'), t(`compact.source.${record.source}`)), title: clip(record.content), facts: [fact(t('compact.updated'), monthDay(record.updatedAt.slice(0, 10), locale)), fact(t('compact.length'), t('compact.characters', { value: count(record.content.length) }))], path: '/settings/ai-connections' }
    }
    case 'status': {
      const { record, related } = view
      return {
        eyebrow: t('compact.account'), title: t(record.onboardingComplete ? 'compact.accountReady' : 'compact.accountOnboarding'),
        facts: [fact(t('compact.connections'), count(related.connections.meta.total)), fact(t('compact.exports'), count(related.exports.meta.total)), fact(t('compact.healthConsent'), t(record.healthDataConsentAccepted ? 'compact.yes' : 'compact.no'))],
        path: '/settings'
      }
    }
    case 'integration': {
      const { record, related } = view
      return {
        eyebrow: dot(t('compact.connection'), t(`outcomeUi.${record.status}`)), title: record.provider,
        facts: [fact(t('compact.lastSync'), record.lastSuccessfulSyncAt ? monthDay(record.lastSuccessfulSyncAt.slice(0, 10), locale) : t('outcomeUi.never')), fact(t('compact.syncRuns'), count(related.runs.meta.total)), fact(t('outcomeUi.error'), record.lastErrorCode ?? t('outcomeUi.noError'))],
        path: '/settings'
      }
    }
    case 'receipts': {
      const { record } = view
      const latest = record.data[0]
      const undoable = record.data.filter(row => row.undoable && !row.undoneAt).length
      return {
        eyebrow: t('compact.changes'), title: t('compact.changesTitle', { value: count(record.meta.total) }),
        facts: [fact(t('compact.undoable'), count(undoable)), fact(t('compact.latest'), latest ? monthDay(latest.createdAt.slice(0, 10), locale) : t('compact.none')), fact(t('compact.page'), count(record.meta.page))],
        ...(latest ? { detail: fact(t('compact.latestChange'), clip(latest.summary ?? latest.tool ?? latest.id, 70)) } : {}),
        path: '/settings/ai-connections'
      }
    }
    case 'workout-review': {
      const { record, related } = view
      return {
        eyebrow: dot(t('outcomeUi.workoutReview'), t(record.status)), title: record.title,
        facts: [fact(t('compact.date'), monthDay(record.date.slice(0, 10), locale)), fact(t('compact.commentary'), t(related.reflections.coach || related.reflections.external ? 'compact.yes' : 'compact.no')), fact(t('compact.decisions'), count(related.decisions.meta.total))],
        path: `/workouts/${record.date.slice(0, 10)}/${record.id}`
      }
    }
    case 'share': {
      const { record } = view
      return {
        eyebrow: dot(t('outcomeUi.share'), record.eyebrow), title: record.titleLines.join(' '),
        facts: [fact(t('compact.highlight'), [record.hero.value, record.hero.unit].filter(Boolean).join(' ')), ...record.facts.slice(0, 2).map(entry => fact(entry.label, entry.unit ? `${entry.value} ${entry.unit}` : entry.value))],
        path: record.landingUrl
      }
    }
  }
}
