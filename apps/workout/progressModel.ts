import { z } from 'zod'
import { presentationSchema } from './model.ts'
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
/**
 * The two personal-record award kinds (EF-1467, EF-1468): `weight` is Heaviest, `oneRm` is Est. 1RM. A recent
 * PR names its kind and, for Est. 1RM, carries `estimatedOneRm`: the Epley estimate of the lifted set as a
 * whole-unit total. Both are optional so an application that predates EF-1468 still validates.
 */
export const prAwardTypeSchema = z.enum(['weight', 'oneRm'])
export type PrAwardType = z.infer<typeof prAwardTypeSchema>
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
    recentPrs: z.array(z.object({ id: z.string(), workoutId: id, exerciseId: id, setId: z.string(), modality: z.string(), exerciseName: z.string(), i18n: localizedName, date: day, type: prAwardTypeSchema.optional(), reps: n.optional(), weight: loadSchema.optional(), estimatedOneRm: totalSchema.optional(), durationSeconds: n.optional() })),
    metadata: z.object({ today: day, timezone: z.string(), readAt: z.string(), readConsistency: z.string() })
  }),
  related: z.object({
    section: z.enum(['overview', 'strength', 'body', 'cardio', 'goals']),
    progression: z.object({ data: z.array(z.object({ id, name: z.string(), i18n: localizedName, modality: z.string(), bestSetReps: n, bestSetWeight: loadSchema, sessionDates: z.array(day), eligibleProgressionDays: count.optional(), series: z.array(estimatePointSchema), unlocked: z.boolean() })), meta }),
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
 * The award a set's stored markers present, mirroring the application's `presentedPrAward`
 * (`shared/utils/personalRecords.ts`, EF-1468): Heaviest outranks Est. 1RM. Markers written under the old rules
 * persist until the application's one-off refresh (EF-1470), so this also decides what they show: a `volume`
 * marker is not an award, and a `oneRm` marker from a set outside 1 to 12 reps has no estimate to state.
 * Either presents nothing.
 */
export const presentedPrAward = <M extends { type: string, reps?: number | null }>(markers: readonly M[] | undefined): (M & { type: PrAwardType, reps: number }) | undefined => {
  const weight = markers?.find(marker => marker.type === 'weight' && marker.reps != null)
  if (weight) return weight as M & { type: PrAwardType, reps: number }
  const oneRm = markers?.find(marker => marker.type === 'oneRm' && marker.reps != null && marker.reps >= 1 && marker.reps <= ONE_RM_MAX_REPS)
  return oneRm as (M & { type: PrAwardType, reps: number }) | undefined
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
