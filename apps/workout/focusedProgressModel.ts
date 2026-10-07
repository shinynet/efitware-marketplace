import { z } from 'zod'
import { loadShapeSchema, presentationSchema, prSchema, setSchema } from './model.ts'
import { progressViewSchema, repRecordSchema } from './progressModel.ts'
import { bodyMetricIdSchema, bodyMetricObservationSchema, loadSchema, totalSchema } from './measurement.ts'
const id = z.string().regex(/^[a-f0-9]{24}$/i)
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const presentation = presentationSchema.extend({ timeZone: z.string() })
export const bodyMetricViewSchema = z.object({ view: z.literal('body-metric'), record: z.object({ key: bodyMetricIdSchema, from: day, to: day }), related: z.object({ observations: z.object({ data: z.array(bodyMetricObservationSchema), meta: z.object({ page: z.number(), limit: z.number(), total: z.number() }) }) }), presentation })
export const exerciseProgressViewSchema = z.object({ view: z.literal('exercise-progress'), record: z.object({ id, name: z.string(), modality: z.string(), addedLoadOptions: z.array(z.string()).optional(), i18n: z.record(z.string(), z.object({ name: z.string().optional() })).optional() }), related: z.object({
  stats: z.object({ loadShape: loadShapeSchema.optional(), repRecords: z.array(repRecordSchema).optional(), sessions: z.number(), prCount: z.number(), unlockAt: z.number(), progressionEligible: z.boolean().optional(), topSet: z.object({ weight: loadSchema, reps: z.number(), date: day }).optional(), lastRpe: z.object({ value: z.number(), date: day }).optional() }),
  progression: progressViewSchema.shape.related.shape.progression.extend({ metadata: z.object({ range: z.enum(['4w', '8w', '12w', '1y']), rangeStart: day, today: day, timezone: z.string(), readAt: z.string() }) }),
  history: z.array(z.object({ workoutId: id, date: day, workoutTitle: z.string(), instanceId: z.string(), exerciseName: z.string(), modality: z.string(), sets: z.array(setSchema) })),
  records: z.array(z.object({ workoutId: id, date: day, exerciseId: id, exerciseName: z.string(), instanceId: z.string(), setId: z.string(), modality: z.string(), loadShape: loadShapeSchema.optional(), weight: loadSchema.nullable(), reps: z.number().nullable(), prs: z.array(prSchema), estimatedOneRm: totalSchema.optional() })),
  collection: z.enum(['history', 'records']), page: z.number().int().positive(), limit: z.number().int().positive()
}), presentation })
export type BodyMetricView = z.infer<typeof bodyMetricViewSchema>
export type ExerciseProgressView = z.infer<typeof exerciseProgressViewSchema>
export const focusedProgressViewSchema = z.discriminatedUnion('view', [bodyMetricViewSchema, exerciseProgressViewSchema])
export type FocusedProgressView = z.infer<typeof focusedProgressViewSchema>
