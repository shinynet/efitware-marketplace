import { readFileSync } from 'node:fs'
import { Ajv } from 'ajv'
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { createSSRApp, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'
import fixtures from './compat-fixtures.json'
import ProgressView from '../apps/workout/ProgressView.vue'
import ExerciseProgressView from '../apps/workout/ExerciseProgressView.vue'
import { presentedPrAwards, progressViewSchema } from '../apps/workout/progressModel'
import { exerciseProgressViewSchema } from '../apps/workout/focusedProgressModel'
import { messages } from '../apps/workout/messages'

/**
 * Personal-record award kinds (EF-1469, application EF-1467/EF-1468). `fixtures.prAwards` copies the
 * application's representative get_progress recentPrs and get_personal_records payloads verbatim; the
 * application checks the same JSON against its output schemas and this release's consumer schemas.
 */
const awards = fixtures.prAwards
const contract = fixtures.measurementContract
const clone = <T>(value: T): T => structuredClone(value)
/** A row without the named fields, as an application older than EF-1468 sends it. */
const omit = (row: object, ...keys: string[]) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)))
const projection = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', target: 'draft-07' })
const ajv = (schema: z.ZodType) => new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(projection(schema))
const validateProgress = ajv(progressViewSchema)
const validateExercise = ajv(exerciseProgressViewSchema)

/** open_progress carries get_progress's recentPrs as record.recentPrs (app `server/services/mcpProgress.ts`). */
const progressWith = (recentPrs: unknown[]) => {
  const view = clone(contract.openProgress) as Record<string, unknown> & { record: Record<string, unknown> }
  view.record.recentPrs = recentPrs
  return view
}
/** open_exercise_progress carries get_personal_records rows as related.records, on the records collection. */
const exerciseWith = (records: unknown[]) => {
  const view = clone(contract.openExerciseProgress) as Record<string, unknown> & { related: Record<string, unknown> }
  view.related.records = records
  view.related.collection = 'records'
  return view
}
const [bench, squat] = awards.getPersonalRecords.data
/**
 * The same awards in a metric account, in the application's metric shape: loads on the 0.25 kg grid, the
 * estimate a whole kilogram. Epley over 77.5 kg × 8 is 98.17, read as 98 kg.
 */
const heaviestKg = { value: 85.25, unit: 'kg' }, liftedKg = { value: 77.5, unit: 'kg' }, estimateKg = { value: 98, unit: 'kg' }
const recentPrsKg = awards.getProgressRecentPrs.recentPrs.map(pr => pr.type === 'weight' ? { ...clone(pr), weight: heaviestKg } : { ...clone(pr), weight: liftedKg, estimatedOneRm: estimateKg })
const recordsKg = [
  { ...clone(bench!), weight: heaviestKg, prs: [{ type: 'weight', weight: heaviestKg, reps: 6 }] },
  { ...clone(squat!), weight: liftedKg, prs: [{ type: 'oneRm', weight: liftedKg, reps: 8 }], estimatedOneRm: estimateKg }
]
/** A records row whose stored markers were written before the application's refresh (EF-1470). */
const legacyRow = (prs: unknown[], patch: Record<string, unknown> = {}) => ({ ...clone(bench!), setId: `legacy-${JSON.stringify(prs).length}`, prs, ...patch })

const renderHtml = async (component: Component, props: Record<string, unknown>, locale: 'en' | 'de' = 'en') => {
  const app = createSSRApp(component, { disabled: false, navigate: () => undefined, followUp: async () => 'accepted', ...props })
  app.use(createI18n({ legacy: false, locale, fallbackLocale: 'en', messages }))
  return renderToString(app)
}
const flatten = (html: string) => html.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const render = async (component: Component, props: Record<string, unknown>, locale: 'en' | 'de' = 'en') => flatten(await renderHtml(component, props, locale))
const showProgress = (recentPrs: unknown[], locale: 'en' | 'de' = 'en') => render(ProgressView, { progress: progressViewSchema.parse(progressWith(recentPrs)) }, locale)
const showRecords = (records: unknown[], locale: 'en' | 'de' = 'en') => render(ExerciseProgressView, { exercise: exerciseProgressViewSchema.parse(exerciseWith(records)) }, locale)
/** The rendered records collection (English), after its note: the page heading and charts before it are dropped. */
const recordsSection = (text: string) => {
  const note = messages.en.progressUi.actualsNote
  return text.slice(text.indexOf(note) + note.length)
}
/** The rendered records cards (English), each from its date to its button. */
const recordCards = (text: string) => recordsSection(text).split('View workout').slice(0, -1)
/** The rendered recent-PR section (English), from its heading to the read note after it. */
const recentSection = (text: string) => text.slice(text.indexOf(messages.en.progressUi.recentPrs), text.indexOf(messages.en.progressUi.readNote))

describe('personal-record award kinds (EF-1469)', () => {
  it('publishes the committed progress and exercise-progress projections', () => {
    expect(JSON.parse(readFileSync(new URL('./progress-view.schema.json', import.meta.url), 'utf8'))).toEqual(projection(progressViewSchema))
    expect(JSON.parse(readFileSync(new URL('./exercise-progress-view.schema.json', import.meta.url), 'utf8'))).toEqual(projection(exerciseProgressViewSchema))
  })

  it('accepts the application fixtures in both consumer schemas without changing them', () => {
    for (const [name, validate, schema, view] of [
      ['open_progress', validateProgress, progressViewSchema, progressWith(awards.getProgressRecentPrs.recentPrs)],
      ['open_exercise_progress', validateExercise, exerciseProgressViewSchema, exerciseWith(awards.getPersonalRecords.data)]
    ] as const) {
      const before = clone(view)
      expect(validate(view), `${name} ${JSON.stringify(validate.errors)}`).toBe(true)
      expect(schema.safeParse(view).success, name).toBe(true)
      expect(view, name).toEqual(before)
    }
    const parsed = progressViewSchema.parse(progressWith(awards.getProgressRecentPrs.recentPrs)).record.recentPrs
    expect(parsed.map(pr => [pr.type, pr.estimatedOneRm])).toEqual([['weight', undefined], ['oneRm', { value: 215, unit: 'lb' }]])
    expect(exerciseProgressViewSchema.parse(exerciseWith(awards.getPersonalRecords.data)).related.records[1]!.estimatedOneRm).toEqual({ value: 215, unit: 'lb' })
  })

  it('still accepts an application that sends no kind or estimate', () => {
    const recent = awards.getProgressRecentPrs.recentPrs.map(pr => omit(pr, 'type', 'estimatedOneRm'))
    const records = awards.getPersonalRecords.data.map(row => omit(row, 'estimatedOneRm'))
    expect(validateProgress(progressWith(recent)), JSON.stringify(validateProgress.errors)).toBe(true)
    expect(validateExercise(exerciseWith(records)), JSON.stringify(validateExercise.errors)).toBe(true)
    expect(validateProgress(contract.openProgress)).toBe(true)
    expect(validateExercise(contract.openExerciseProgress)).toBe(true)
  })

  it('refuses an unknown kind and an estimate that is not a whole-unit measurement', () => {
    const [heaviest, oneRm] = awards.getProgressRecentPrs.recentPrs
    for (const bad of [{ ...heaviest, type: 'volume' }, { ...heaviest, type: 'first' }, { ...oneRm, estimatedOneRm: 215 }, { ...oneRm, estimatedOneRm: { value: 215.5, unit: 'lb' } }, { ...oneRm, estimatedOneRm: { value: 215, unit: 'stone' } }]) {
      expect(validateProgress(progressWith([bad])), JSON.stringify(bad)).toBe(false)
    }
    for (const bad of [{ ...squat, estimatedOneRm: 215 }, { ...squat, estimatedOneRm: { value: 97.5, unit: 'kg' } }]) {
      expect(validateExercise(exerciseWith([bad])), JSON.stringify(bad)).toBe(false)
    }
  })

  it('reads a set\'s markers the way the application presents them', () => {
    const load = { value: 100, unit: 'kg' }
    expect(presentedPrAwards([{ type: 'weight', weight: load, reps: 6 }])[0]?.type).toBe('weight')
    expect(presentedPrAwards([{ type: 'oneRm', weight: load, reps: 6 }, { type: 'weight', weight: load, reps: 6 }])[0]?.type).toBe('weight')
    expect(presentedPrAwards([{ type: 'oneRm', weight: load, reps: 12 }])[0]?.type).toBe('oneRm')
    expect(presentedPrAwards([{ type: 'volume', weight: load, reps: 6 }])).toEqual([])
    expect(presentedPrAwards([{ type: 'volume', weight: load, reps: 6, first: true }])).toEqual([])
    expect(presentedPrAwards([{ type: 'oneRm', weight: load, reps: 15 }])).toEqual([])
    expect(presentedPrAwards([{ type: 'oneRm', weight: load }])).toEqual([])
    expect(presentedPrAwards([{ type: 'weight', weight: load }, { type: 'oneRm', weight: load, reps: 8 }])[0]?.type).toBe('oneRm')
    expect(presentedPrAwards([{ type: 'volume', weight: load, reps: 6 }, { type: 'oneRm', weight: load, reps: 8 }])[0]?.type).toBe('oneRm')
    expect(presentedPrAwards([])).toEqual([])
    expect(presentedPrAwards(undefined)).toEqual([])
    const bodyWeight = { type: 'reps', weight: { value: 0, unit: 'kg' }, reps: 12 }
    const addedWeight = { type: 'weight', weight: load, reps: 9 }
    const addedReps = { type: 'reps', weight: load, reps: 9 }
    expect(presentedPrAwards([bodyWeight], 'added')).toEqual([bodyWeight])
    expect(presentedPrAwards([addedWeight, addedReps], 'added')).toEqual([addedWeight, addedReps])
    expect(presentedPrAwards([addedWeight, addedReps])).toEqual([addedWeight, addedReps])
    expect(presentedPrAwards([addedWeight, addedReps], 'external')).toEqual([addedWeight])
    for (const invalid of [0, -1, NaN, Infinity]) expect(presentedPrAwards([{ ...addedWeight, reps: invalid }], 'added')).toEqual([])
    expect(presentedPrAwards([{ type: 'oneRm', weight: load, reps: 9 }], 'added')).toEqual([])
    expect(presentedPrAwards([{ type: 'weight', weight: { value: 0, unit: 'kg' }, reps: 9 }], 'added')).toEqual([])
    for (const invalid of [-1, NaN, Infinity]) expect(presentedPrAwards([{ ...bodyWeight, weight: { value: invalid, unit: 'kg' } }], 'added')).toEqual([])

  })

  it('ProgressView names both kinds and states the estimate with the set it came from', async () => {
    const text = await showProgress(awards.getProgressRecentPrs.recentPrs)
    expect(text).toContain('Barbell Bench Press Heaviest 187.5 lb · 6 reps')
    expect(text).toContain('Back Squat Est. 1RM ~215 lb · from 170 lb × 8')
    expect(text).not.toContain('170 lb · 8 reps')
    expect(text).toContain('Latest six awards in this window, grouped by exercise and workout.')
    expect(text).toContain('Personal record awards')
    expect(text).not.toContain('record markers')
  })

  it('ProgressView shows a row from an application without kinds as before, without a kind', async () => {
    const recent = awards.getProgressRecentPrs.recentPrs.map(pr => omit(pr, 'type', 'estimatedOneRm'))
    const text = await showProgress(recent)
    expect(text).toContain('Barbell Bench Press 187.5 lb · 6 reps')
    expect(text).toContain('Back Squat 170 lb · 8 reps')
    expect(text).not.toMatch(/Heaviest|Est\. 1RM|~/)
  })

  it('ExerciseProgressView names both kinds on records rows and the estimate with its set', async () => {
    const cards = recordCards(await showRecords(awards.getPersonalRecords.data))
    expect(cards).toHaveLength(2)
    expect(cards[0]).toContain('6 reps · 187.5 lb Heaviest')
    expect(cards[0]).not.toContain('Est. 1RM')
    expect(cards[1]).toContain('8 reps · 170 lb Est. 1RM ~215 lb · from 170 lb × 8')
    expect(cards[1]).not.toContain('Heaviest')
  })

  it('ExerciseProgressView leaves out rows whose markers present no award', async () => {
    const volume = { type: 'volume', weight: bench!.weight, reps: 6 }
    const legacy = [
      legacyRow([volume], { date: '2026-09-11', setId: 'legacy-volume' }),
      legacyRow([{ ...volume, first: true }], { date: '2026-09-12', setId: 'legacy-first' }),
      legacyRow([{ type: 'oneRm', weight: bench!.weight, reps: 15 }], { date: '2026-09-13', setId: 'legacy-15-reps', reps: 15 }),
      legacyRow([{ type: 'weight', weight: bench!.weight }], { date: '2026-09-14', setId: 'legacy-no-reps' })
    ]
    const text = await showRecords([...legacy, legacyRow([volume, { type: 'weight', weight: bench!.weight, reps: 6 }], { date: '2026-09-15', setId: 'legacy-with-award' })])
    const cards = recordCards(text)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toContain('Tue, Sep 15, 2026 6 reps · 187.5 lb Heaviest')
    expect(cards[0]).not.toMatch(/volume|Volume/)
    const section = recordsSection(text)
    for (const day of ['Sep 11', 'Sep 12', 'Sep 13', 'Sep 14']) expect(section).not.toContain(day)
    expect(section).not.toContain('15 reps')
    expect(section).not.toContain(messages.en.emptyCollection)
  })

  it('ExerciseProgressView shows the empty state for a page of only legacy rows and keeps paging', async () => {
    const volume = { type: 'volume', weight: bench!.weight, reps: 6 }
    const html = await renderHtml(ExerciseProgressView, { exercise: exerciseProgressViewSchema.parse(exerciseWith([
      legacyRow([volume], { setId: 'legacy-volume' }),
      legacyRow([{ type: 'oneRm', weight: bench!.weight, reps: 15 }], { setId: 'legacy-15-reps', reps: 15 })
    ])) })
    const text = flatten(html)
    expect(text).toContain(messages.en.emptyCollection)
    expect(recordCards(text)).toHaveLength(0)
    expect(recordsSection(text)).not.toMatch(/Heaviest|Est\. 1RM|15 reps|Sep 24/)
    // The server's page holds rows, so Next stays available: the application decides where the pages end.
    const next = html.match(/<button[^>]*>\s*Next\s*<\/button>/)?.[0]
    expect(next).toBeDefined()
    expect(next).not.toMatch(/disabled/)
  })

  it('an Est. 1RM row without an estimate names its kind only', async () => {
    const cards = recordCards(await showRecords([omit(squat!, 'estimatedOneRm')]))
    expect(cards[0]).toContain('8 reps · 170 lb Est. 1RM')
    expect(cards[0]).not.toMatch(/~|from/)
  })

  it('accepts and renders the metric awards in both views as given', async () => {
    const metricProgress = progressWith(recentPrsKg)
    const metricRecords = exerciseWith(recordsKg)
    expect(validateProgress(metricProgress), JSON.stringify(validateProgress.errors)).toBe(true)
    expect(validateExercise(metricRecords), JSON.stringify(validateExercise.errors)).toBe(true)
    const progress = await showProgress(recentPrsKg)
    expect(progress).toContain('Barbell Bench Press Heaviest 85.25 kg · 6 reps')
    expect(progress).toContain('Back Squat Est. 1RM ~98 kg · from 77.5 kg × 8')
    const cards = recordCards(await showRecords(recordsKg))
    expect(cards).toHaveLength(2)
    expect(cards[0]).toContain('6 reps · 85.25 kg Heaviest')
    expect(cards[1]).toContain('8 reps · 77.5 kg Est. 1RM ~98 kg · from 77.5 kg × 8')
    for (const text of [recentSection(progress), ...cards]) expect(text).not.toMatch(/\blb\b/)
  })

  it('renders the metric awards in German', async () => {
    const progress = await showProgress(recentPrsKg, 'de')
    expect(progress).toContain('Höchstgewicht 85,25 kg · 6 Wdh.')
    expect(progress).toContain('Gesch. 1RM ~98 kg · aus 77,5 kg × 8')
    const records = await showRecords(recordsKg, 'de')
    expect(records).toContain('6 Wdh. · 85,25 kg Höchstgewicht')
    expect(records).toContain('8 Wdh. · 77,5 kg Gesch. 1RM ~98 kg · aus 77,5 kg × 8')
  })

  it('localizes the kinds, the estimate and the award copy in German', async () => {
    const progress = await showProgress(awards.getProgressRecentPrs.recentPrs, 'de')
    expect(progress).toContain('Höchstgewicht 187,5 lb · 6 Wdh.')
    expect(progress).toContain('Gesch. 1RM ~215 lb · aus 170 lb × 8')
    expect(progress).toContain('Die letzten sechs Auszeichnungen in diesem Zeitraum, nach Übung und Training gruppiert.')
    expect(progress).toContain('Auszeichnungen für persönliche Rekorde')
    const records = await showRecords(awards.getPersonalRecords.data, 'de')
    expect(records).toContain('Höchstgewicht')
    expect(records).toContain('Gesch. 1RM ~215 lb · aus 170 lb × 8')
  })

  it('carries the same award labels in both locales and no volume label', () => {
    for (const locale of ['en', 'de'] as const) {
      expect(Object.keys(messages[locale].progressUi.prType)).toEqual(['weight', 'oneRm', 'reps'])
    }
    expect(messages.en.progressUi.prType).toEqual({ weight: 'Heaviest', oneRm: 'Est. 1RM', reps: 'Rep record' })
    expect(messages.de.progressUi.prType).toEqual({ weight: 'Höchstgewicht', oneRm: 'Gesch. 1RM', reps: 'Wiederholungsrekord' })
  })
})
