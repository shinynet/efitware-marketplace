import { z } from 'zod'
import { loadShapeSchema, presentationSchema, type LoadShape } from './model.ts'
import { bodyFatPointSchema, bodyFatSchema, bodyWeightPointSchema, bodyWeightSchema, circumferenceIdSchema, circumferencePointSchema, circumferenceSchema, estimatePointSchema, heartRatePointSchema, heartRateSchema, loadSchema, totalSchema } from './measurement.ts'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const id = z.string().regex(/^[a-f0-9]{24}$/i)
const n = z.number()
const count = n.int().nonnegative()
/** A chart point as the chart reads it; every published series carries its unit beside `value` (measurement.ts). */
export interface SeriesPoint { date: string, value: number, isPr?: boolean }
const metricShape = { kind: z.enum(['count', 'decimal']), unitKey: z.string().nullable(), tone: z.enum(['positive', 'steady']), delta: n.optional(), deltaKind: z.enum(['percent', 'count', 'decimal']) }
/** Training volume is a whole-unit total; every other headline metric is a plain number. */
const metric = z.union([
  z.object({ key: z.literal('volume'), value: totalSchema, ...metricShape }),
  z.object({ key: z.string().regex(/^(?!volume$)/), value: n, ...metricShape })
])
/** Stored award kinds; added loads may earn both weight and rep awards. */
export const prAwardTypeSchema = z.enum(['weight', 'oneRm', 'reps'])
export type PrAwardType = z.infer<typeof prAwardTypeSchema>
/** Recent dated rep awards use the account's load measurement, including known body weight at zero. */
export const repRecordSchema = z.object({ date: day, reps: n.int().positive(), weight: loadSchema })
const meta = z.object({ total: count, page: count.positive(), limit: count.positive() })
const localizedName = z.record(z.string(), z.object({ name: z.string().optional() })).optional()
export const progressViewSchema = z.object({
  view: z.literal('progress'),
  record: z.object({
    asOf: day, rangeStart: day, range: z.enum(['4w', '8w', '12w', '1y']), unlockSessions: count, progressionCount: count,
    metrics: z.array(metric),
    weeklyVolume: z.array(z.object({ weekStart: day, volume: totalSchema, inProgress: z.boolean().optional() })),
    consistency: z.object({ heatmap: z.array(z.object({ weekStart: day, sets: count })), sessionsDone: count, sessionsPlanned: count, streakWeeks: count }),
    balance: z.object({ muscles: z.array(z.object({ muscle: z.string(), sets: count })), movements: z.array(z.object({ movement: z.string(), share: n })) }),
    body: z.object({ weight: bodyWeightSchema.nullable(), goalWeight: bodyWeightSchema.nullable(), bodyFat: bodyFatSchema.nullable(), weightSeries: z.array(bodyWeightPointSchema), bodyFatSeries: z.array(bodyFatPointSchema), measurements: z.array(z.object({ key: circumferenceIdSchema, value: circumferenceSchema, series: z.array(circumferencePointSchema) })) }),
    cardio: z.object({ restingHr: heartRateSchema.nullable(), restingHrSeries: z.array(heartRatePointSchema), zone2Minutes: n, zone2DeltaMinutes: n.optional(), bestEfforts: z.array(z.object({ key: z.string(), kind: z.enum(['time', 'distance', 'power']), date: day, seconds: n.optional(), distanceMeters: n.optional(), watts: n.optional() })) }),
    modalitySplit: z.array(z.object({ modality: z.string(), share: n })),
    recentPrs: z.array(z.object({ id: z.string(), workoutId: id, exerciseId: id, setId: z.string(), modality: z.string(), exerciseName: z.string(), i18n: localizedName, date: day, loadShape: loadShapeSchema.optional(), type: prAwardTypeSchema.optional(), reps: n.optional(), weight: loadSchema.optional(), estimatedOneRm: totalSchema.optional(), durationSeconds: n.optional() })),
    metadata: z.object({ today: day, timezone: z.string(), readAt: z.string(), readConsistency: z.string() })
  }),
  related: z.object({
    section: z.enum(['overview', 'strength', 'body', 'cardio', 'goals']),
    progression: z.object({ data: z.array(z.object({ id, name: z.string(), i18n: localizedName, modality: z.string(), loadShape: loadShapeSchema.optional(), repRecords: z.array(repRecordSchema).optional(), bestSetReps: n, bestSetWeight: loadSchema, sessionDates: z.array(day), eligibleProgressionDays: count.optional(), series: z.array(estimatePointSchema), unlocked: z.boolean() })), meta }),
    goals: z.object({ data: z.array(z.object({ id, name: z.string(), status: z.enum(['active', 'achieved', 'abandoned']), targetMeasure: z.string().optional(), targetDate: day.optional(), checkInCount: count, latestCheckIn: z.object({ date: day, value: z.string().optional(), note: z.string().optional() }).optional() })), meta })
  }),
  presentation: presentationSchema.extend({ timeZone: z.string() })
})
export type ProgressView = z.infer<typeof progressViewSchema>

/**
 * Days counted toward the estimate unlock. The application's `eligibleProgressionDays`
 * (EF-1466) counts only days with a set of 12 reps or fewer; before it emits that field,
 * every session day counted. `sessionDates` stays every session day either way.
 */
export const unlockProgressDays = (entry: { sessionDates: string[], eligibleProgressionDays?: number }) => entry.eligibleProgressionDays ?? entry.sessionDates.length

/** Sets above this many reps never produce an estimated one-rep maximum (EF-1466). */
export const ONE_RM_MAX_REPS = 12

/**
 * Stored awards mirror the app's plural presentation contract. Added sets may
 * retain both positive added-weight and rep awards; they never show an estimate.
 * Ordinary lifting retains Heaviest over Est. 1RM, and legacy volume is ignored.
 */
export const presentedPrAwards = <M extends { type: string, reps?: number | null, weight?: { value: number } }>(markers: readonly M[] | undefined, loadShape?: LoadShape): (M & { type: PrAwardType, reps: number })[] => {
  type Award = M & { type: PrAwardType, reps: number }
  const weight = markers?.find(marker => marker.type === 'weight' && marker.reps != null)
  const reps = markers?.find(marker => marker.type === 'reps' && marker.reps != null && marker.reps >= 1 && Number.isFinite(marker.reps) && marker.weight != null && Number.isFinite(marker.weight.value) && marker.weight.value >= 0)
  if (loadShape === 'added' || (loadShape === undefined && reps)) {
    return [weight && weight.reps != null && Number.isFinite(weight.reps) && weight.reps >= 1 && weight.weight != null && Number.isFinite(weight.weight.value) && weight.weight.value > 0 ? weight : undefined, reps].filter((marker): marker is M => marker !== undefined) as Award[]
  }
  if (weight) return [weight as Award]
  const oneRm = markers?.find(marker => marker.type === 'oneRm' && marker.reps != null && marker.reps >= 1 && marker.reps <= ONE_RM_MAX_REPS)
  return oneRm ? [oneRm as Award] : []
}

/** Calendar days have uniform spacing even across daylight-saving changes. */
export const chartGeometry = (points: SeriesPoint[], bars = false) => {
  if (!points.length) return { points: [], low: 0, high: 0 }
  const times = points.map(point => Date.parse(`${point.date}T12:00:00Z`))
  const first = Math.min(...times), last = Math.max(...times)
  const low = bars ? Math.min(0, ...points.map(point => point.value)) : Math.min(...points.map(point => point.value))
  const high = Math.max(...points.map(point => point.value))
  return { low, high, points: points.map((point, index) => ({ ...point, x: first === last ? 300 : 24 + (times[index]! - first) / (last - first) * 552, y: high === low ? (bars ? 160 : 90) : 160 - (point.value - low) / (high - low) * 140 })) }
}
