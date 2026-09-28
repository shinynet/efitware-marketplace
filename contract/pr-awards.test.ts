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
import { presentedPrAward, progressViewSchema } from '../apps/workout/progressModel'
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
/** A records row whose stored markers were written before the application's refresh (EF-1470). */
const legacyRow = (prs: unknown[], patch: Record<string, unknown> = {}) => ({ ...clone(bench!), setId: `legacy-${JSON.stringify(prs).length}`, prs, ...patch })

const render = async (component: Component, props: Record<string, unknown>, locale: 'en' | 'de' = 'en') => {
  const app = createSSRApp(component, { disabled: false, navigate: () => undefined, followUp: async () => 'accepted', ...props })
  app.use(createI18n({ legacy: false, locale, fallbackLocale: 'en', messages }))
  return (await renderToString(app)).replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}
const showProgress = (recentPrs: unknown[], locale: 'en' | 'de' = 'en') => render(ProgressView, { progress: progressViewSchema.parse(progressWith(recentPrs)) }, locale)
const showRecords = (records: unknown[], locale: 'en' | 'de' = 'en') => render(ExerciseProgressView, { exercise: exerciseProgressViewSchema.parse(exerciseWith(records)) }, locale)
/** The rendered records cards (English), each from its date to its button; the page heading before them is dropped. */
const recordCards = (text: string) => {
  const note = messages.en.progressUi.actualsNote
  return text.slice(text.indexOf(note) + note.length).split('View workout').slice(0, -1)
}

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
    expect(presentedPrAward([{ type: 'weight', weight: load, reps: 6 }])?.type).toBe('weight')
    expect(presentedPrAward([{ type: 'oneRm', weight: load, reps: 6 }, { type: 'weight', weight: load, reps: 6 }])?.type).toBe('weight')
    expect(presentedPrAward([{ type: 'oneRm', weight: load, reps: 12 }])?.type).toBe('oneRm')
    expect(presentedPrAward([{ type: 'volume', weight: load, reps: 6 }])).toBeUndefined()
    expect(presentedPrAward([{ type: 'volume', weight: load, reps: 6, first: true }])).toBeUndefined()
    expect(presentedPrAward([{ type: 'oneRm', weight: load, reps: 15 }])).toBeUndefined()
    expect(presentedPrAward([{ type: 'oneRm', weight: load }])).toBeUndefined()
    expect(presentedPrAward([{ type: 'weight', weight: load }, { type: 'oneRm', weight: load, reps: 8 }])?.type).toBe('oneRm')
    expect(presentedPrAward([{ type: 'volume', weight: load, reps: 6 }, { type: 'oneRm', weight: load, reps: 8 }])?.type).toBe('oneRm')
    expect(presentedPrAward([])).toBeUndefined()
    expect(presentedPrAward(undefined)).toBeUndefined()
  })

  it('ProgressView names both kinds and states the estimate with the set it came from', async () => {
    const text = await showProgress(awards.getProgressRecentPrs.recentPrs)
    expect(text).toContain('Barbell Bench Press Heaviest 187.5 lb · 6 reps')
    expect(text).toContain('Back Squat Est. 1RM ~215 lb · from 170 lb × 8')
    expect(text).not.toContain('170 lb · 8 reps')
    expect(text).toContain('Latest six in this window. Each is one award: at most one per exercise per workout.')
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

  it('ExerciseProgressView shows a legacy volume marker as a row with no kind', async () => {
    const volume = { type: 'volume', weight: bench!.weight, reps: 6 }
    const cards = recordCards(await showRecords([
      legacyRow([volume]),
      legacyRow([{ ...volume, first: true }]),
      legacyRow([{ type: 'oneRm', weight: bench!.weight, reps: 15 }], { reps: 15 }),
      legacyRow([volume, { type: 'weight', weight: bench!.weight, reps: 6 }])
    ]))
    expect(cards).toHaveLength(4)
    for (const card of cards.slice(0, 3)) {
      expect(card).not.toMatch(/Heaviest|Est\. 1RM|volume|Volume|~/)
      expect(card).toMatch(/\d+ reps · 187\.5 lb $/)
    }
    expect(cards[3]).toContain('6 reps · 187.5 lb Heaviest')
    expect(cards[3]).not.toMatch(/volume|Volume/)
  })

  it('an Est. 1RM row without an estimate names its kind only', async () => {
    const cards = recordCards(await showRecords([omit(squat!, 'estimatedOneRm')]))
    expect(cards[0]).toContain('8 reps · 170 lb Est. 1RM')
    expect(cards[0]).not.toMatch(/~|from/)
  })

  it('localizes the kinds, the estimate and the award copy in German', async () => {
    const progress = await showProgress(awards.getProgressRecentPrs.recentPrs, 'de')
    expect(progress).toContain('Höchstgewicht 187,5 lb · 6 Wdh.')
    expect(progress).toContain('Gesch. 1RM ~215 lb · aus 170 lb × 8')
    expect(progress).toContain('Die letzten sechs in diesem Zeitraum. Jeder Eintrag ist eine Auszeichnung: höchstens eine pro Übung und Einheit.')
    expect(progress).toContain('Auszeichnungen für persönliche Rekorde')
    const records = await showRecords(awards.getPersonalRecords.data, 'de')
    expect(records).toContain('Höchstgewicht')
    expect(records).toContain('Gesch. 1RM ~215 lb · aus 170 lb × 8')
  })

  it('carries the same award labels in both locales and no volume label', () => {
    for (const locale of ['en', 'de'] as const) {
      expect(Object.keys(messages[locale].progressUi.prType)).toEqual(['weight', 'oneRm'])
    }
    expect(messages.en.progressUi.prType).toEqual({ weight: 'Heaviest', oneRm: 'Est. 1RM' })
    expect(messages.de.progressUi.prType).toEqual({ weight: 'Höchstgewicht', oneRm: 'Gesch. 1RM' })
  })
})
