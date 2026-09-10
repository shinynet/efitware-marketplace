import { z } from 'zod'

// Validate the fields this embedded view consumes; preserve all canonical set actuals.
const measure = z.number().finite().nonnegative().optional()
export const setSchema = z.object({
  id: z.string(), category: z.enum(['warmup', 'working', 'dropset', 'backoff', 'topset', 'amrap', 'interval', 'recovery', 'cooldown']), completed: z.boolean(), comments: z.string().optional(),
  weight: measure, reps: measure, duration: measure, distance: measure,
  plannedWeight: measure, plannedDuration: measure, plannedDistance: measure,
  plannedReps: z.object({ min: z.number(), max: z.number() }).optional(),
  restTarget: measure, rirTarget: measure
})
const activitySchema = z.object({
  id: z.string(), kind: z.enum(['rest', 'water_break', 'stretching', 'warmup', 'cooldown', 'custom']), title: z.string(), detail: z.string().optional(), notes: z.string().optional(),
  durationTarget: measure, durationActual: measure, completed: z.boolean(), order: z.number(),
  section: z.enum(['warmup', 'main', 'cooldown']).optional()
})
const exerciseSchema = z.object({
  id: z.string(), exerciseId: z.string(), exerciseName: z.string(),
  modality: z.enum(['resistance', 'cardio', 'mobility']), order: z.number(),
  section: z.enum(['warmup', 'main', 'cooldown']).optional(), comments: z.string().optional(),
  sets: z.array(setSchema), activities: z.array(activitySchema).optional()
})
export const workoutSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i), title: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['planned', 'in_progress', 'completed', 'skipped', 'abandoned']),
  description: z.string().optional(), revision: z.string().regex(/^workout:1:[a-f0-9]{64}$/),
  exercises: z.array(exerciseSchema), activities: z.array(activitySchema).optional()
})
const trackingSchema = z.object({
  id: z.string(), unavailable: z.boolean().optional(), nameDe: z.string().optional(),
  tracksWeight: z.boolean().optional(), tracksReps: z.boolean().optional(),
  tracksTime: z.boolean().optional(), tracksDistance: z.boolean().optional()
})
export const viewSchema = z.object({
  workout: workoutSchema, exercises: z.array(trackingSchema),
  presentation: z.object({
    locale: z.string().nullable(), unitSystem: z.enum(['metric', 'imperial']).nullable(),
    theme: z.enum(['system', 'light', 'dark']).nullable(), skin: z.enum(['calm', 'cyanotype', 'camellia']).nullable()
  })
})
export type WorkoutView = z.infer<typeof viewSchema>
export type ViewSet = z.infer<typeof setSchema>
export type ViewExercise = z.infer<typeof exerciseSchema>
export type ViewActivity = z.infer<typeof activitySchema>
export type Tracking = z.infer<typeof trackingSchema>
