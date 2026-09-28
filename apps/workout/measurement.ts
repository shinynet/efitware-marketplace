import { z } from 'zod'

/**
 * The MCP measurement contract (EF-1447, app plan "Imperial accounts" §1 and §6).
 *
 * Every weight and body measurement the card reads is a measurement object, `{ value, unit }`, already in
 * the account's unit. The card renders `value` with `unit` exactly as given and never converts it:
 * `presentation.unitSystem` is only a hint for the unit of a value the user types into an empty field.
 *
 * - Loads (a set's `weight`/`plannedWeight`, PR weights, top sets) sit on their unit's grid: half a pound
 *   or 0.25 kg. Rendered with at most one decimal for lb and two for kg ("187.5 lb", "85.25 kg").
 * - Totals and estimates (volume, estimated one-rep maximum) are whole units, rendered whole.
 * - Body metrics use unit-free identifiers and one unit dimension each, rendered unsnapped at one decimal;
 *   bpm is whole.
 *
 * A dated point (a chart point or a body-metric observation) carries its measurement object as `value`.
 * Bare numbers are never accepted where a measurement is expected.
 */

const weightUnit = z.enum(['lb', 'kg'])
const nonNegative = z.number().nonnegative()

/** A load on its unit's grid: half a pound, or 0.25 kg. */
export const loadSchema = z.discriminatedUnion('unit', [
  z.object({ value: nonNegative.multipleOf(0.5), unit: z.literal('lb') }),
  z.object({ value: nonNegative.multipleOf(0.25), unit: z.literal('kg') })
])
/** A total or an estimate (volume, estimated one-rep maximum): whole units. */
export const totalSchema = z.object({ value: z.number().int().nonnegative(), unit: weightUnit })

export const circumferenceIds = ['neck', 'shoulders', 'chest', 'waist', 'hips', 'biceps', 'forearms', 'thighs', 'calves'] as const
/** Unit-free body-metric identifiers, in the application's order. */
export const bodyMetricIds = ['weight', ...circumferenceIds, 'body_fat', 'resting_heart_rate'] as const
export const circumferenceIdSchema = z.enum(circumferenceIds)
export const bodyMetricIdSchema = z.enum(bodyMetricIds)
export type BodyMetricId = typeof bodyMetricIds[number]

export const bodyWeightSchema = z.object({ value: nonNegative, unit: weightUnit })
export const circumferenceSchema = z.object({ value: nonNegative, unit: z.enum(['cm', 'in']) })
export const bodyFatSchema = z.object({ value: nonNegative, unit: z.literal('percent') })
export const heartRateSchema = z.object({ value: z.number().int().nonnegative(), unit: z.literal('bpm') })

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
/** One observation of one body metric; its unit must belong to that metric's dimension. */
export const bodyMetricObservationSchema = z.union([
  z.object({ key: z.literal('weight'), date: day, value: bodyWeightSchema }),
  z.object({ key: circumferenceIdSchema, date: day, value: circumferenceSchema }),
  z.object({ key: z.literal('body_fat'), date: day, value: bodyFatSchema }),
  z.object({ key: z.literal('resting_heart_rate'), date: day, value: heartRateSchema })
])
/** Dated chart points: a day and its measurement object; `isPr` marks a record-setting session. */
export const estimatePointSchema = z.object({ date: day, value: totalSchema, isPr: z.boolean().optional() })
export const bodyWeightPointSchema = z.object({ date: day, value: bodyWeightSchema })
export const circumferencePointSchema = z.object({ date: day, value: circumferenceSchema })
export const bodyFatPointSchema = z.object({ date: day, value: bodyFatSchema })
export const heartRatePointSchema = z.object({ date: day, value: heartRateSchema })

export type Load = z.infer<typeof loadSchema>
export type Total = z.infer<typeof totalSchema>
export type LoadUnit = z.infer<typeof weightUnit>
export interface Measurement { value: number, unit: string }

const intlUnit: Record<string, string> = { lb: 'pound', kg: 'kilogram', cm: 'centimeter', in: 'inch' }
const withUnit = (value: number, unit: string, locale: string, digits: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits, style: 'unit', unit: intlUnit[unit] ?? unit, unitDisplay: 'short' }).format(value)

/** A load as given: "187.5 lb", "85.25 kg". */
export const formatLoad = (load: Measurement, locale: string) => withUnit(load.value, load.unit, locale, load.unit === 'lb' ? 1 : 2)
/** A total or an estimate as given, in whole units: "12,346 lb". */
export const formatTotal = (total: Measurement, locale: string) => withUnit(total.value, total.unit, locale, 0)
/**
 * A body measurement as given, unsnapped at one decimal; heart rate is whole. `bpm` renders the localized
 * beats-per-minute phrase from the already formatted number.
 */
export const formatBodyMetric = (measurement: Measurement, locale: string, bpm: (value: string) => string) => {
  if (measurement.unit === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(measurement.value / 100)
  if (measurement.unit === 'bpm') return bpm(new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(measurement.value))
  return withUnit(measurement.value, measurement.unit, locale, 1)
}
/** The Intl unit behind a measurement unit, for input labels. */
export const intlUnitOf = (unit: string) => intlUnit[unit] ?? unit
/** The unit a value typed into an empty weight field is sent in: the account's, from the presentation hint. */
export const accountLoadUnit = (system: 'metric' | 'imperial'): LoadUnit => system === 'imperial' ? 'lb' : 'kg'

/** The message key naming a body metric (`progressUi.*`). */
export const bodyMetricLabelKey = (key: BodyMetricId) => key === 'weight' ? 'progressUi.weight' : key === 'body_fat' ? 'progressUi.fat' : key === 'resting_heart_rate' ? 'progressUi.restingHr' : `progressUi.measurement.${key}`
/** The application's page for a metric is addressed by its storage key; only links use it. */
export const bodyMetricPageKey = (key: BodyMetricId) => key === 'weight' ? 'weight_kg' : key === 'body_fat' ? 'body_fat_percent' : key === 'resting_heart_rate' ? 'resting_heart_rate_bpm' : `${key}_cm`

/**
 * Sum `value × reps` over loads that share one unit. Loads in mixed units have no single total without a
 * conversion the card never makes, so the result is undefined.
 */
export const sumLoads = (entries: Array<{ load: Measurement, reps: number }>): Total | undefined => {
  const units = new Set(entries.map(entry => entry.load.unit))
  if (units.size !== 1) return undefined
  const unit = [...units][0] as LoadUnit
  return { value: Math.round(entries.reduce((sum, entry) => sum + entry.load.value * entry.reps, 0)), unit }
}

/** The unit a chart series is drawn in: its points' own unit (a series is published in one unit). */
export const seriesUnit = (points: ReadonlyArray<{ value: Measurement }>, fallback: string) => points[0]?.value.unit ?? fallback
/** Dated measurements as the chart draws them: the day and the number, in the series' unit. */
export const chartPoints = (points: ReadonlyArray<{ date: string, value: Measurement }>) => points.map(point => ({ date: point.date, value: point.value.value }))
/** The unit the account reads a body metric in; only an empty series is labelled with it. */
export const accountBodyMetricUnit = (key: BodyMetricId, system: 'metric' | 'imperial') => key === 'weight' ? accountLoadUnit(system) : key === 'body_fat' ? 'percent' : key === 'resting_heart_rate' ? 'bpm' : system === 'imperial' ? 'in' : 'cm'
