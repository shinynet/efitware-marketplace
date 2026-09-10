import { z } from 'zod'
import { presentationSchema } from './model.ts'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const id = z.string().regex(/^[a-f0-9]{24}$/i)
const n = z.number()
const count = n.int().nonnegative()
const point = z.object({ date: day, value: n, isPr: z.boolean().optional() })
const meta = z.object({ total: count, page: count.positive(), limit: count.positive() })
const localizedName = z.record(z.string(), z.object({ name: z.string().optional() })).optional()
export const progressViewSchema = z.object({
  view: z.literal('progress'),
  record: z.object({
    asOf: day, rangeStart: day, range: z.enum(['4w', '8w', '12w', '1y']), unlockSessions: count, progressionCount: count,
    metrics: z.array(z.object({ key: z.string(), kind: z.enum(['count', 'decimal']), value: n, unitKey: z.string().nullable(), tone: z.enum(['positive', 'steady']), delta: n.optional(), deltaKind: z.enum(['percent', 'count', 'decimal']) })),
    weeklyVolume: z.array(z.object({ weekStart: day, volumeKg: n, inProgress: z.boolean().optional() })),
    consistency: z.object({ heatmap: z.array(z.object({ weekStart: day, sets: count })), sessionsDone: count, sessionsPlanned: count, streakWeeks: count }),
    balance: z.object({ muscles: z.array(z.object({ muscle: z.string(), sets: count })), movements: z.array(z.object({ movement: z.string(), share: n })) }),
    body: z.object({ weightKg: n.nullable(), goalWeightKg: n.nullable(), bodyFatPercent: n.nullable(), weightSeries: z.array(point), bodyFatSeries: z.array(point), measurements: z.array(z.object({ key: z.string(), valueCm: n, series: z.array(point) })) }),
    cardio: z.object({ restingHr: n.nullable(), restingHrSeries: z.array(point), zone2Minutes: n, zone2DeltaMinutes: n.optional(), bestEfforts: z.array(z.object({ key: z.string(), kind: z.enum(['time', 'distance', 'power']), date: day, seconds: n.optional(), distanceMeters: n.optional(), watts: n.optional() })) }),
    modalitySplit: z.array(z.object({ modality: z.string(), share: n })),
    recentPrs: z.array(z.object({ id: z.string(), workoutId: id, exerciseId: id, setId: z.string(), modality: z.string(), exerciseName: z.string(), i18n: localizedName, date: day, reps: n.optional(), weightKg: n.optional(), durationSeconds: n.optional() })),
    metadata: z.object({ today: day, timezone: z.string(), readAt: z.string(), readConsistency: z.string() })
  }),
  related: z.object({
    section: z.enum(['overview', 'strength', 'body', 'cardio', 'goals']),
    progression: z.object({ data: z.array(z.object({ id, name: z.string(), i18n: localizedName, modality: z.string(), bestSetReps: n, bestSetWeightKg: n, sessionDates: z.array(day), series: z.array(point), unlocked: z.boolean() })), meta }),
    goals: z.object({ data: z.array(z.object({ id, name: z.string(), status: z.enum(['active', 'achieved', 'abandoned']), targetMeasure: z.string().optional(), targetDate: day.optional(), checkInCount: count, latestCheckIn: z.object({ date: day, value: z.string().optional(), note: z.string().optional() }).optional() })), meta })
  }),
  presentation: presentationSchema.extend({ timeZone: z.string() })
})
export type ProgressView = z.infer<typeof progressViewSchema>
export type SeriesPoint = z.infer<typeof point>

/** Calendar days have uniform spacing even across daylight-saving changes. */
export const chartGeometry = (points: SeriesPoint[], bars = false) => {
  if (!points.length) return { points: [], low: 0, high: 0 }
  const times = points.map(point => Date.parse(`${point.date}T12:00:00Z`))
  const first = Math.min(...times), last = Math.max(...times)
  const low = bars ? Math.min(0, ...points.map(point => point.value)) : Math.min(...points.map(point => point.value))
  const high = Math.max(...points.map(point => point.value))
  return { low, high, points: points.map((point, index) => ({ ...point, x: first === last ? 300 : 24 + (times[index]! - first) / (last - first) * 552, y: high === low ? (bars ? 160 : 90) : 160 - (point.value - low) / (high - low) * 140 })) }
}
