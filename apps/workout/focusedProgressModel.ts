import { z } from 'zod'
import { presentationSchema, setSchema } from './model.ts'
import { progressViewSchema } from './progressModel.ts'
const id = z.string().regex(/^[a-f0-9]{24}$/i)
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const presentation = presentationSchema.extend({ timeZone: z.string() })
const metricKey = z.enum(['weight_kg', 'body_fat_percent', 'resting_heart_rate_bpm', 'neck_cm', 'shoulders_cm', 'chest_cm', 'waist_cm', 'hips_cm', 'biceps_cm', 'forearms_cm', 'thighs_cm', 'calves_cm'])
export const bodyMetricViewSchema = z.object({ view: z.literal('body-metric'), record: z.object({ key: metricKey, from: day, to: day }), related: z.object({ observations: z.object({ data: z.array(z.object({ key: metricKey, date: day, value: z.number() })), meta: z.object({ page: z.number(), limit: z.number(), total: z.number() }) }) }), presentation })
export const exerciseProgressViewSchema = z.object({ view: z.literal('exercise-progress'), record: z.object({ id, name: z.string(), modality: z.string(), i18n: z.record(z.string(), z.object({ name: z.string().optional() })).optional() }), related: z.object({
  stats: z.object({ sessions: z.number(), prCount: z.number(), unlockAt: z.number(), progressionEligible: z.boolean().optional(), topSet: z.object({ weightKg: z.number(), reps: z.number(), date: day }).optional(), lastRpe: z.object({ value: z.number(), date: day }).optional() }),
  progression: progressViewSchema.shape.related.shape.progression.extend({ metadata: z.object({ range: z.enum(['4w', '8w', '12w', '1y']), rangeStart: day, today: day, timezone: z.string(), readAt: z.string() }) }),
  history: z.array(z.object({ workoutId: id, date: day, workoutTitle: z.string(), instanceId: z.string(), exerciseName: z.string(), modality: z.string(), sets: z.array(setSchema) })),
  records: z.array(z.object({ workoutId: id, date: day, exerciseId: id, exerciseName: z.string(), instanceId: z.string(), setId: z.string(), modality: z.string(), weightKg: z.number().nullable(), reps: z.number().nullable(), prs: z.array(z.object({ type: z.enum(['weight', 'oneRm', 'volume']), weight: z.number(), reps: z.number().optional(), first: z.boolean().optional() })) })),
  collection: z.enum(['history', 'records']), page: z.number().int().positive(), limit: z.number().int().positive()
}), presentation })
export type BodyMetricView = z.infer<typeof bodyMetricViewSchema>
export type ExerciseProgressView = z.infer<typeof exerciseProgressViewSchema>
export const focusedProgressViewSchema = z.discriminatedUnion('view', [bodyMetricViewSchema, exerciseProgressViewSchema])
export type FocusedProgressView = z.infer<typeof focusedProgressViewSchema>
