import { z } from 'zod'
import { loadSchema } from './measurement.ts'
import { executionGroupsSchema } from './executionGroups.ts'

// Validate the fields this embedded view consumes; preserve all canonical set actuals.
// Loads are measurement objects in the account's unit (measurement.ts); a bare number is refused.
const measure = z.number().finite().nonnegative().optional()
const load = loadSchema.optional()
/** The catalogue load meaning; added loads exclude body mass. */
export const loadShapeSchema = z.enum(['external', 'added', 'none'])
export type LoadShape = z.infer<typeof loadShapeSchema>

/** A personal-record marker on a completed set: its `weight` is the set's load. */
export const prSchema = z.object({ type: z.enum(['weight', 'oneRm', 'volume', 'reps']), weight: loadSchema, reps: z.number().optional(), first: z.boolean().optional() })
export const setSchema = z.object({
  id: z.string(), category: z.enum(['warmup', 'working', 'dropset', 'backoff', 'topset', 'amrap', 'interval', 'recovery', 'cooldown']), completed: z.boolean(), comments: z.string().optional(),
  weight: load, reps: measure, duration: measure, distance: measure,
  plannedWeight: load, plannedDuration: measure, plannedDistance: measure,
  plannedReps: z.object({ min: z.number(), max: z.number() }).optional(),
  restTarget: measure, rirTarget: measure, plannedAmrap: z.boolean().optional(), plannedRpe: measure, tempo: z.string().optional(), side: z.enum(['left', 'right', 'both']).optional(),
  prs: z.array(prSchema).optional()
})
export const activitySchema = z.object({
  id: z.string(), kind: z.enum(['rest', 'water_break', 'stretching', 'warmup', 'cooldown', 'custom']), title: z.string(), detail: z.string().optional(), notes: z.string().optional(),
  durationTarget: measure, durationActual: measure, completed: z.boolean(), order: z.number(),
  section: z.enum(['warmup', 'main', 'cooldown']).optional()
})
export const exerciseSchema = z.object({
  id: z.string(), exerciseId: z.string(), exerciseName: z.string(),
  modality: z.enum(['resistance', 'cardio', 'mobility']), order: z.number(),
  section: z.enum(['warmup', 'main', 'cooldown']).optional(), comments: z.string().optional(),
  sets: z.array(setSchema), activities: z.array(activitySchema).optional()
})
export const workoutSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i), title: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['planned', 'in_progress', 'completed', 'skipped', 'abandoned']),
  description: z.string().optional(), revision: z.string().regex(/^workout:1:[a-f0-9]{64}$/),
  exercises: z.array(exerciseSchema), activities: z.array(activitySchema).optional(),
  executionGroups: executionGroupsSchema.optional()
})
export const trackingSchema = z.object({
  id: z.string(), loadShape: loadShapeSchema.optional(), unavailable: z.boolean().optional(), nameDe: z.string().optional(),
  tracksWeight: z.boolean().optional(), tracksReps: z.boolean().optional(),
  tracksTime: z.boolean().optional(), tracksDistance: z.boolean().optional()
})
export const presentationSchema = z.object({
    locale: z.string().nullable(), unitSystem: z.enum(['metric', 'imperial']).nullable(),
    theme: z.enum(['system', 'light', 'dark']).nullable(), skin: z.enum(['calm', 'cyanotype', 'camellia']).nullable()
})
export const viewSchema = z.object({ workout: workoutSchema, exercises: z.array(trackingSchema), presentation: presentationSchema })
export type WorkoutView = z.infer<typeof viewSchema>
export type ViewSet = z.infer<typeof setSchema>
export type ViewExercise = z.infer<typeof exerciseSchema>
export type ViewActivity = z.infer<typeof activitySchema>
export type Tracking = z.infer<typeof trackingSchema>
