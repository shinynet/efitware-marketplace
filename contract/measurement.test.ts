import { Ajv } from 'ajv'
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { createSSRApp, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'
import fixtures from './compat-fixtures.json'
import { messages } from '../apps/workout/messages'
import { viewSchema } from '../apps/workout/model'
import { templateViewSchema } from '../apps/workout/templateModel'
import { progressViewSchema } from '../apps/workout/progressModel'
import { bodyMetricViewSchema, exerciseProgressViewSchema } from '../apps/workout/focusedProgressModel'
import { contextViewSchema } from '../apps/workout/contextModel'
import { bodyMetricIds, formatBodyMetric, formatLoad, formatTotal } from '../apps/workout/measurement'
import { inputLoadUnit, sentValue } from '../apps/workout/presentation'
import { compactSummary } from '../apps/workout/compactSummary'
import { parseTrainingView } from '../apps/workout/templateModel'
import WorkoutSetRow from '../apps/workout/WorkoutSetRow.vue'
import TemplateView from '../apps/workout/TemplateView.vue'
import ProgressView from '../apps/workout/ProgressView.vue'
import ProgressMeasurements from '../apps/workout/ProgressMeasurements.vue'
import ExerciseProgressView from '../apps/workout/ExerciseProgressView.vue'
import BodyMetricView from '../apps/workout/BodyMetricView.vue'
import ContextBody from '../apps/workout/ContextBody.vue'

/**
 * The MCP measurement contract (EF-1447). `fixtures.measurementContract` holds representative application
 * responses in the new shapes; the application verifies its real responses against duplicates of them.
 */
const contract = fixtures.measurementContract
const clone = <T>(value: T): T => structuredClone(value)
const ajv = (schema: z.ZodType) => new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(z.toJSONSchema(schema, { io: 'input', target: 'draft-07' }))
const validators = {
  workout: ajv(viewSchema), template: ajv(templateViewSchema), progress: ajv(progressViewSchema),
  exerciseProgress: ajv(exerciseProgressViewSchema), bodyMetric: ajv(bodyMetricViewSchema), context: ajv(contextViewSchema)
}
const cases = [
  ['open_workout imperial', validators.workout, viewSchema, contract.openWorkout.imperial],
  ['open_workout metric', validators.workout, viewSchema, contract.openWorkout.metric],
  ['open_exercise_progress', validators.exerciseProgress, exerciseProgressViewSchema, contract.openExerciseProgress],
  ['open_progress', validators.progress, progressViewSchema, contract.openProgress],
  ['open_context', validators.context, contextViewSchema, contract.openContext],
  ...contract.openBodyMetric.map(view => [`open_body_metric ${view.record.key} ${view.presentation.unitSystem}`, validators.bodyMetric, bodyMetricViewSchema, view] as const)
] as const

const render = async (component: Component, props: Record<string, unknown>, locale: 'en' | 'de' = 'en') => {
  const app = createSSRApp(component, { disabled: false, busy: false, navigate: () => undefined, followUp: async () => 'accepted', ...props })
  app.use(createI18n({ legacy: false, locale, fallbackLocale: 'en', messages }))
  return (await renderToString(app)).replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}
const rowProps = (view: typeof contract.openWorkout.imperial, index: number) => {
  const parsed = viewSchema.parse(view)
  return { set: parsed.workout.exercises[0]!.sets[index]!, number: index + 1, tracking: parsed.exercises[0], system: parsed.presentation.unitSystem, save: () => undefined }
}
/** Minimal `t` over the real message tree, as in compact.test.ts. */
const translator = (locale: 'en' | 'de') => (key: string, values: Record<string, string | number> = {}) =>
  (key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages[locale]) as string).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]))
const text = (value: string, locale = 'en') => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value))

describe('measurement contract fixtures', () => {
  it('pass the published consumer schemas without changing input bytes', () => {
    for (const [name, validate, schema, input] of cases) {
      const before = clone(input)
      expect(validate(input), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true)
      expect(input, name).toEqual(before)
      expect(() => schema.parse(input), name).not.toThrow()
      expect(() => parseTrainingView(input), name).not.toThrow()
    }
  })

  it('cover every unit-free body-metric identifier and both unit systems', () => {
    expect(new Set(contract.openBodyMetric.map(view => view.record.key))).toEqual(new Set(bodyMetricIds))
    expect(bodyMetricIds).toEqual(['weight', 'neck', 'shoulders', 'chest', 'waist', 'hips', 'biceps', 'forearms', 'thighs', 'calves', 'body_fat', 'resting_heart_rate'])
    const units = (system: string) => new Set(contract.openBodyMetric.filter(view => view.presentation.unitSystem === system).flatMap(view => view.related.observations.data.map(entry => `${entry.key}:${entry.value.unit}`)))
    expect([...units('imperial')].filter(entry => /:(lb|in)$/.test(entry))).toHaveLength(10)
    expect(units('metric')).toEqual(new Set(['weight:kg', 'waist:cm']))
    expect(contract.openWorkout.imperial.workout.exercises[0]!.sets[0]!.weight).toEqual({ value: 187.5, unit: 'lb' })
    expect(contract.openWorkout.metric.workout.exercises[0]!.sets[0]!.weight).toEqual({ value: 85.25, unit: 'kg' })
  })
})

describe('the precision table', () => {
  it('renders loads on their grid with at most one decimal for lb and two for kg', () => {
    expect(formatLoad({ value: 187.5, unit: 'lb' }, 'en')).toBe('187.5 lb')
    expect(formatLoad({ value: 185, unit: 'lb' }, 'en')).toBe('185 lb')
    expect(formatLoad({ value: 85.25, unit: 'kg' }, 'en')).toBe('85.25 kg')
    expect(formatLoad({ value: 85.25, unit: 'kg' }, 'de')).toBe('85,25 kg')
    expect(formatLoad({ value: 85.5, unit: 'kg' }, 'en')).toBe('85.5 kg')
  })
  it('renders totals and estimates in whole units', () => {
    expect(formatTotal({ value: 12346, unit: 'lb' }, 'en')).toBe('12,346 lb')
    expect(formatTotal({ value: 5600, unit: 'kg' }, 'de')).toBe('5.600 kg')
  })
  it('renders body measurements unsnapped at one decimal, heart rate whole', () => {
    const bpm = (value: string) => `${value} bpm`
    expect(formatBodyMetric({ value: 180.44, unit: 'lb' }, 'en', bpm)).toBe('180.4 lb')
    expect(formatBodyMetric({ value: 180.3, unit: 'lb' }, 'en', bpm)).toBe('180.3 lb')
    expect(formatBodyMetric({ value: 32.46, unit: 'in' }, 'en', bpm)).toBe('32.5 in')
    expect(formatBodyMetric({ value: 82.55, unit: 'cm' }, 'de', bpm)).toBe('82,6 cm')
    expect(formatBodyMetric({ value: 18.5, unit: 'percent' }, 'en', bpm)).toBe('18.5%')
    expect(formatBodyMetric({ value: 58, unit: 'bpm' }, 'en', bpm)).toBe('58 bpm')
  })
})

describe('cards render measurements as given in both unit systems', () => {
  it('open_workout: a 187.5 lb load stays "187.5 lb"; a 85.25 kg load stays "85.25 kg"', async () => {
    const imperial = await render(WorkoutSetRow, rowProps(contract.openWorkout.imperial, 0))
    expect(imperial).toContain('Target: 5 reps, 187.5 lb')
    expect(imperial).toContain('Weight (lb)')
    expect(await renderToString(createSSRApp(WorkoutSetRow, rowProps(contract.openWorkout.imperial, 0)).use(createI18n({ legacy: false, locale: 'en', messages })))).toContain('value="187.5"')
    const metric = await render(WorkoutSetRow, rowProps(contract.openWorkout.metric, 0), 'de')
    expect(metric).toContain('85,25 kg')
    expect(metric).toContain('Gewicht (kg)')
    for (const [view, locale, next, volume] of [[contract.openWorkout.imperial, 'en', 'Bench press · 185 lb × 5 reps', '938 lb'], [contract.openWorkout.metric, 'de', '85 kg', '426 kg']] as const) {
      const summary = compactSummary(parseTrainingView(view), { locale, system: view.presentation.unitSystem as 'metric' | 'imperial', t: translator(locale) })
      expect(summary.detail?.value).toContain(next)
      expect(summary.facts[1]!.value).toBe(volume)
    }
  })

  it('open_template: planned loads render as given', async () => {
    const view = templateViewSchema.parse({ view: 'template', record: { id: 'a'.repeat(24), name: 'Upper A', revision: `template:1:${'a'.repeat(64)}`, exercises: clone(contract.openWorkout.imperial.workout.exercises).map(exercise => ({ ...exercise, sets: exercise.sets.map(({ id, category, plannedWeight, plannedReps }) => ({ id, category, plannedWeight, plannedReps })) })) }, related: { exercises: [] }, presentation: contract.openWorkout.imperial.presentation })
    const output = await render(TemplateView, { template: view, create: () => undefined })
    expect(output).toContain('187.5 lb')
    expect(output).toContain('185 lb')
  })

  it('open_exercise_progress: the top set is a load; estimates are whole', async () => {
    const output = await render(ExerciseProgressView, { exercise: exerciseProgressViewSchema.parse(contract.openExerciseProgress) })
    expect(output).toContain('5 × 187.5 lb')
    expect(output).toContain('Sep 18, 2026 · 219 lb')
    expect(output).toContain('165 lb')
    expect(output).toContain('Value axis: 204 lb–219 lb')
    expect(output).not.toContain('188 lb')
    const records = await render(ExerciseProgressView, { exercise: exerciseProgressViewSchema.parse({ ...clone(contract.openExerciseProgress), related: { ...clone(contract.openExerciseProgress.related), collection: 'records' } }) })
    expect(records).toContain('5 reps · 187.5 lb')
  })

  it('open_progress: volume and estimates are whole, the top set and PRs keep load precision', async () => {
    const output = await render(ProgressView, { progress: progressViewSchema.parse(contract.openProgress) })
    expect(output).toContain('12,346 lb')
    expect(output).toContain('187.5 lb')
    const strength = await render(ProgressView, { progress: progressViewSchema.parse({ ...clone(contract.openProgress), related: { ...clone(contract.openProgress.related), section: 'strength' } }) })
    expect(strength).toContain('5 × 187.5 lb')
    expect(strength).toContain('219 lb')
    expect(output).toContain(`${text('3167')} lb`)
  })

  it('body and cardio: body measurements are one decimal and unsnapped; heart rate is whole', async () => {
    const view = clone(contract.openProgress)
    view.record.body.weight = { value: 180.44, unit: 'lb' }
    const body = await render(ProgressMeasurements, { progress: progressViewSchema.parse({ ...view, related: { ...view.related, section: 'body' } }) })
    for (const expected of ['180.4 lb', '175 lb', '18.5%', '32.5 in', '41.3 in', '181.2 lb', '32.8 in']) expect(body, expected).toContain(expected)
    expect(body).not.toContain('180.5 lb')
    const cardio = await render(ProgressMeasurements, { progress: progressViewSchema.parse({ ...view, related: { ...view.related, section: 'cardio' } }) })
    expect(cardio).toContain('58 bpm')
    const context = await render(ContextBody, { context: contextViewSchema.parse(contract.openContext) })
    for (const expected of ['180.4 lb', '175 lb', '18.5%', '58 bpm', '32.5 in', '41.3 in']) expect(context, expected).toContain(expected)
    for (const view of contract.openBodyMetric) {
      const output = await render(BodyMetricView, { metric: bodyMetricViewSchema.parse(view) })
      const last = view.related.observations.data.at(-1)!
      expect(output, view.record.key).toContain(formatBodyMetric(last.value, 'en', value => `${value} bpm`))
    }
  })
})

describe('the card never converts an already-converted measurement', () => {
  it('a { value: 85, unit: "kg" } load on an imperial payload renders "85 kg", never pounds', async () => {
    const view = clone(contract.openWorkout.imperial)
    view.workout.exercises[0]!.sets[0]!.weight = { value: 85, unit: 'kg' }
    view.workout.exercises[0]!.sets[0]!.plannedWeight = { value: 85, unit: 'kg' }
    const output = await render(WorkoutSetRow, rowProps(view, 0))
    expect(output).toContain('85 kg')
    expect(output).toContain('Weight (kg)')
    expect(output).not.toMatch(/187\.4|187\.39|lb/)
    const stats = clone(contract.openExerciseProgress)
    stats.related.stats.topSet.weight = { value: 85, unit: 'kg' }
    const progress = await render(ExerciseProgressView, { exercise: exerciseProgressViewSchema.parse(stats) })
    expect(progress).toContain('5 × 85 kg')
    const body = clone(contract.openBodyMetric[0]!)
    body.related.observations.data = body.related.observations.data.map(entry => ({ ...entry, value: { value: 82.2, unit: 'kg' } }))
    expect(await render(BodyMetricView, { metric: bodyMetricViewSchema.parse(body) })).toContain('82.2 kg')
  })

  it('sends a typed load as a measurement object in the unit it was shown in', () => {
    const imperial = viewSchema.parse(contract.openWorkout.imperial).workout.exercises[0]!.sets
    expect(inputLoadUnit(imperial[0]!, 'imperial')).toBe('lb')
    expect(inputLoadUnit({ plannedWeight: { value: 85, unit: 'kg' } }, 'imperial')).toBe('kg')
    expect(inputLoadUnit({}, 'imperial')).toBe('lb')
    expect(inputLoadUnit({}, 'metric')).toBe('kg')
    expect(sentValue('weight', 190, 'pound')).toEqual({ value: 190, unit: 'lb' })
    expect(sentValue('weight', 85, 'kilogram')).toEqual({ value: 85, unit: 'kg' })
    expect(sentValue('distance', 1.5, 'mile')).toBeCloseTo(2414.016, 6)
  })
})

describe('schemas refuse bare numbers and off-contract measurements', () => {
  type Mutation = [string, keyof typeof validators, unknown, (view: never) => void]
  const workout = contract.openWorkout.imperial, stats = contract.openExerciseProgress, progress = contract.openProgress
  const firstSet = (view: typeof workout) => view.workout.exercises[0]!.sets[0]! as Record<string, unknown>
  const mutations: Mutation[] = [
    ['bare set weight', 'workout', workout, (view: typeof workout) => { firstSet(view).weight = 187.5 }],
    ['bare planned weight', 'workout', workout, (view: typeof workout) => { firstSet(view).plannedWeight = 85 }],
    ['bare PR marker weight', 'workout', workout, (view: typeof workout) => { (firstSet(view).prs as Array<Record<string, unknown>>)[0]!.weight = 85 }],
    ['off-grid pound load', 'workout', workout, (view: typeof workout) => { firstSet(view).weight = { value: 187.4, unit: 'lb' } }],
    ['off-grid kilogram load', 'workout', workout, (view: typeof workout) => { firstSet(view).weight = { value: 85.3, unit: 'kg' } }],
    ['unknown load unit', 'workout', workout, (view: typeof workout) => { firstSet(view).weight = { value: 85, unit: 'kgs' } }],
    ['legacy weightUnit-only load', 'workout', workout, (view: typeof workout) => { firstSet(view).weight = { value: 85 } }],
    ['bare top set', 'exerciseProgress', stats, (view: typeof stats) => { (view.related.stats.topSet as Record<string, unknown>).weight = 85 }],
    ['legacy top-set weightKg', 'exerciseProgress', stats, (view: typeof stats) => { const top = view.related.stats.topSet as Record<string, unknown>; top.weightKg = 85; delete top.weight }],
    ['bare record weight', 'exerciseProgress', stats, (view: typeof stats) => { (view.related.records[0] as Record<string, unknown>).weight = 85 }],
    ['bare history set weight', 'exerciseProgress', stats, (view: typeof stats) => { (view.related.history[0]!.sets[0] as Record<string, unknown>).weight = 85 }],
    ['bare best set', 'exerciseProgress', stats, (view: typeof stats) => { (view.related.progression.data[0] as Record<string, unknown>).bestSetWeight = 85 }],
    ['fractional estimate', 'exerciseProgress', stats, (view: typeof stats) => { view.related.progression.data[0]!.series[0]!.value.value = 204.6 }],
    ['bare estimate point', 'exerciseProgress', stats, (view: typeof stats) => { (view.related.progression.data[0]!.series[0] as Record<string, unknown>).value = 204 }],
    ['flat estimate point', 'exerciseProgress', stats, (view: typeof stats) => { view.related.progression.data[0]!.series[0] = { date: '2026-09-01', value: 204, unit: 'lb' } as never }],
    ['bare body-weight point', 'progress', progress, (view: typeof progress) => { (view.record.body.weightSeries[0] as Record<string, unknown>).value = 181.2 }],
    ['bare volume metric', 'progress', progress, (view: typeof progress) => { (view.record.metrics[1] as Record<string, unknown>).value = 5600 }],
    ['fractional volume', 'progress', progress, (view: typeof progress) => { view.record.weeklyVolume[0]!.volume.value = 2810.4 }],
    ['legacy volumeKg', 'progress', progress, (view: typeof progress) => { view.record.weeklyVolume = [{ weekStart: '2026-08-31', volumeKg: 1274 }] as never }],
    ['bare recent PR', 'progress', progress, (view: typeof progress) => { (view.record.recentPrs[0] as Record<string, unknown>).weight = 85 }],
    ['bare body weight', 'progress', progress, (view: typeof progress) => { (view.record.body as Record<string, unknown>).weight = 81.8 }],
    ['wrong-dimension body weight', 'progress', progress, (view: typeof progress) => { view.record.body.weight = { value: 71, unit: 'in' } }],
    ['bare resting heart rate', 'progress', progress, (view: typeof progress) => { (view.record.cardio as Record<string, unknown>).restingHr = 58 }],
    ['fractional heart rate', 'progress', progress, (view: typeof progress) => { view.record.cardio.restingHr.value = 58.5 }],
    ['legacy measurement valueCm', 'progress', progress, (view: typeof progress) => { view.record.body.measurements = [{ key: 'waist', valueCm: 82.6, series: [] }] as never }],
    ['bare context weight', 'context', contract.openContext, (view: typeof contract.openContext) => { (view.record.profile as Record<string, unknown>).weight = 81.8 }],
    ['legacy context measurement key', 'context', contract.openContext, (view: typeof contract.openContext) => { (view.record.profile.measurements as Record<string, unknown>).waist_cm = { value: 82.6, unit: 'cm' } }]
  ]
  for (const [name, target, input, mutate] of mutations) {
    it(`rejects ${name}`, () => {
      const view = clone(input)
      mutate(view as never)
      expect(validators[target](view), name).toBe(false)
    })
  }

  it('rejects legacy suffixed body-metric keys, bare observations and mismatched units', () => {
    const view = contract.openBodyMetric[0]!
    const observation = view.related.observations.data[0]!
    const variants = [
      { ...view, record: { ...view.record, key: 'weight_kg' } },
      { ...view, related: { observations: { ...view.related.observations, data: [{ ...observation, key: 'weight_kg' }] } } },
      { ...view, related: { observations: { ...view.related.observations, data: [{ key: 'weight', date: observation.date, value: 82 }] } } },
      { ...view, related: { observations: { ...view.related.observations, data: [{ key: 'weight', date: observation.date, value: 82, unit: 'kg' }] } } },
      { ...view, related: { observations: { ...view.related.observations, data: [{ ...observation, value: { value: 82, unit: 'cm' } }] } } },
      { ...view, related: { observations: { ...view.related.observations, data: [{ key: 'body_fat', date: observation.date, value: { value: 18, unit: 'lb' } }] } } },
      { ...view, related: { observations: { ...view.related.observations, data: [{ key: 'waist', date: observation.date, value: { value: 32, unit: 'kg' } }] } } }
    ]
    for (const variant of variants) {
      expect(validators.bodyMetric(variant), JSON.stringify(variant.related)).toBe(false)
      expect(bodyMetricViewSchema.safeParse(variant).success).toBe(false)
    }
    expect(viewSchema.safeParse({ ...workout, workout: { ...workout.workout, exercises: [{ ...workout.workout.exercises[0], sets: [{ ...workout.workout.exercises[0]!.sets[0], weight: 187.5 }] }] } }).success).toBe(false)
  })
})
