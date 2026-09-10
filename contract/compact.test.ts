import { expect, it } from 'vitest'
import fixtures from './compat-fixtures.json'
import { MIN_BARS, appUrl, compactSummary, completedVolumeKg, nextSet, undoTarget } from '../apps/workout/compactSummary'
import { parseTrainingView } from '../apps/workout/templateModel'
import { messages } from '../apps/workout/messages'

/** Minimal `t`: resolves dotted keys in the real message tree so missing keys fail loudly. */
const translator = (locale: 'en' | 'de') => {
  const lookup = (key: string) => key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages[locale])
  const t = (key: string, values: Record<string, string | number> = {}) => {
    const text = lookup(key)
    if (typeof text !== 'string') throw new Error(`Missing ${locale} message: ${key}`)
    return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`))
  }
  return { t, te: (key: string) => typeof lookup(key) === 'string' }
}
const presentation = { locale: 'en', unitSystem: 'metric', theme: null, skin: null, timeZone: 'UTC' }
const set = (id: string, completed: boolean, extra: Record<string, unknown> = {}) => ({ id, category: 'working', completed, ...extra })
const workout = {
  workout: { id: 'b'.repeat(24), title: 'Lower/push A', date: '2026-09-08', status: 'in_progress', revision: `workout:1:${'b'.repeat(64)}`, exercises: [
    { id: 'we2', exerciseId: 'e'.repeat(24), exerciseName: 'Bent-over row', modality: 'resistance', order: 1, sets: [set('s3', false, { plannedWeight: 60, plannedReps: { min: 8, max: 8 } })] },
    { id: 'we1', exerciseId: 'f'.repeat(24), exerciseName: 'Goblet squat', modality: 'resistance', order: 0, sets: [set('s1', true, { weight: 20, reps: 10 }), set('s2', true, { weight: 20, reps: 8 })] }
  ] },
  exercises: [{ id: 'e'.repeat(24), nameDe: 'Rudern vorgebeugt' }],
  presentation: { locale: 'en', unitSystem: 'metric', theme: null, skin: null }
}

it('summarises a workout with sets done, completed volume and the next set in workout order', () => {
  const view = parseTrainingView(workout)
  const en = compactSummary(view, { locale: 'en', system: 'metric', ...translator('en') })
  expect(en.eyebrow).toBe('Workout · Tue, Sep 8')
  expect(en.title).toBe('Lower/push A')
  expect(en.facts.map(fact => fact.value)).toEqual(['2 of 3', '360 kg', 'In progress'])
  expect(en.detail).toEqual({ label: 'Next set', value: 'Bent-over row · 60 kg × 8 reps' })
  expect(en.path).toBe(`/workouts/2026-09-08/${'b'.repeat(24)}`)
  expect(appUrl(en.path)).toBe(`https://app.efitware.com/workouts/2026-09-08/${'b'.repeat(24)}`)
  expect(appUrl('https://www.efitware.com/share/x')).toBe('https://www.efitware.com/share/x')
  const de = compactSummary(view, { locale: 'de', system: 'imperial', ...translator('de') })
  expect(de.detail?.value).toContain('Rudern vorgebeugt')
  expect(de.facts[1]!.value).toMatch(/lb/)
  expect(nextSet(workout.workout.exercises as never)?.set.id).toBe('s3')
  expect(completedVolumeKg(workout.workout.exercises as never)).toBe(360)
})

it('projects every fixture view into at most three facts with an app link, in both locales', () => {
  const views = [
    ...fixtures.goalViews.filter(fixture => fixture.valid).map(fixture => fixture.input),
    ...fixtures.templateViews.filter(fixture => fixture.valid).map(fixture => fixture.input),
    ...fixtures.bodyMetricViews
  ]
  expect(views.length).toBeGreaterThan(2)
  for (const input of views) {
    const view = parseTrainingView(input)
    for (const locale of ['en', 'de'] as const) {
      const summary = compactSummary(view, { locale, system: 'metric', ...translator(locale) })
      expect(summary.eyebrow).not.toBe('')
      expect(summary.title).not.toBe('')
      expect(summary.facts.length).toBeGreaterThan(0)
      expect(summary.facts.length).toBeLessThanOrEqual(3)
      for (const fact of summary.facts) expect(fact.value).not.toMatch(/undefined|NaN|\{\w+\}/)
      expect(summary.path).toMatch(/^\/[a-z]/)
    }
  }
})

it('omits the bar chart below the minimum series length and keeps it bounded otherwise', () => {
  const metric = structuredClone(fixtures.bodyMetricViews[0]!)
  const short = compactSummary(parseTrainingView(metric), { locale: 'en', system: 'metric', ...translator('en') })
  expect(metric.related.observations.data.length).toBeLessThan(MIN_BARS)
  expect(short.bars).toBeUndefined()
  metric.related.observations.data = Array.from({ length: MIN_BARS }, (_, index) => ({ key: 'waist_cm', date: `2026-03-0${index + 1}`, value: 80 + index }))
  const long = compactSummary(parseTrainingView(metric), { locale: 'en', system: 'metric', ...translator('en') })
  expect(long.bars?.values).toEqual([80, 81, 82, 83])
  expect(long.bars?.start).toBe('Mar 1')
  expect(long.bars?.end).toBe('Mar 4')
  expect(long.facts[1]!.value).toBe('+3 cm')
})

it('renders a goal summary with target countdown and inline check-in evidence', () => {
  const goal = structuredClone(fixtures.goalViews.find(fixture => fixture.view === 'goal' && fixture.valid)!.input) as { record: Record<string, unknown>, related: Record<string, unknown> }
  goal.record.targetDate = '2026-12-01'
  goal.related.today = '2026-09-10'
  goal.related.latestCheckIn = { id: 'c'.repeat(24), goalId: goal.record.id, date: '2026-09-08', value: '72.5 kg × 5' }
  const summary = compactSummary(parseTrainingView({ ...goal, presentation }), { locale: 'en', system: 'metric', ...translator('en') })
  expect(summary.eyebrow).toBe('Goal · Active')
  expect(summary.facts).toEqual([{ label: 'Target date', value: 'Dec 1' }, { label: 'Days left', value: '82' }, { label: 'Last check-in', value: '72.5 kg × 5 · Sep 8' }])
  expect(summary.path).toBe(`/goals/${goal.record.id}`)
})

it('binds undo to the displayed receipt only and counts trained days from completed sessions', () => {
  const receipt = (id: string, undoable: boolean, undoneAt: string | null) => ({ id, tool: 'create_workout', entities: [], createdAt: '2026-09-10T10:00:00.000Z', undoneAt, undoable })
  const receipts = (data: ReturnType<typeof receipt>[]) => parseTrainingView({ view: 'receipts', record: { data, meta: { page: 1, limit: 20, total: data.length } }, related: {}, presentation }) as Extract<ReturnType<typeof parseTrainingView>, { view: 'receipts' }>
  expect(undoTarget(receipts([receipt('a'.repeat(24), false, null), receipt('b'.repeat(24), true, null)]))).toBeUndefined()
  expect(undoTarget(receipts([receipt('a'.repeat(24), true, '2026-09-10T11:00:00.000Z'), receipt('b'.repeat(24), true, null)]))).toBeUndefined()
  expect(undoTarget(receipts([receipt('c'.repeat(24), true, null), receipt('b'.repeat(24), true, null)]))?.id).toBe('c'.repeat(24))
  const calendar = parseTrainingView({ view: 'calendar', record: { from: '2026-09-07', to: '2026-09-13', date: '2026-09-08', days: [
    { date: '2026-09-07', status: 'completed', sessionCount: 2, completedSessionCount: 1 },
    { date: '2026-09-08', status: 'incomplete', sessionCount: 1, completedSessionCount: 0 },
    { date: '2026-09-09', status: null, sessionCount: 0, completedSessionCount: 0 }
  ], agenda: null }, related: {}, presentation })
  const summary = compactSummary(calendar, { locale: 'en', system: 'metric', ...translator('en') })
  expect(summary.facts).toEqual([{ label: 'Sessions', value: '3' }, { label: 'Completed', value: '1' }, { label: 'Days trained', value: '1' }])
})

it('labels the exercise progression series as an estimate', () => {
  const day = (index: number) => `2026-09-0${index + 1}`
  const view = parseTrainingView({ view: 'exercise-progress', record: { id: 'd'.repeat(24), name: 'Bench press', modality: 'resistance' }, related: {
    stats: { sessions: 4, prCount: 1, unlockAt: 3 },
    progression: { data: [{ id: 'd'.repeat(24), name: 'Bench press', modality: 'resistance', bestSetReps: 5, bestSetWeightKg: 80, sessionDates: [day(0)], series: [0, 1, 2, 3].map(index => ({ date: day(index), value: 90 + index })), unlocked: true }], meta: { total: 1, page: 1, limit: 10 }, metadata: { range: '4w', rangeStart: day(0), today: day(3), timezone: 'UTC', readAt: '2026-09-04T00:00:00.000Z' } },
    history: [], records: [], collection: 'history', page: 1, limit: 10
  }, presentation })
  for (const locale of ['en', 'de'] as const) {
    const summary = compactSummary(view, { locale, system: 'metric', ...translator(locale) })
    expect(summary.bars?.label).toBe(locale === 'en' ? 'Estimated one-rep maximum' : 'Geschätztes Einwiederholungsmaximum')
    expect(summary.bars?.values).toEqual([90, 91, 92, 93])
  }
})
