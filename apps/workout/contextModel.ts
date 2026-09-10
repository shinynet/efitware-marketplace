import { z } from 'zod'
import { presentationSchema } from './model.ts'
const id = z.string().regex(/^[a-f0-9]{24}$/i)
const meta = z.object({ page: z.number().int().positive(), limit: z.number().int().positive(), total: z.number().int().nonnegative() })
const presentation = presentationSchema.extend({ timeZone: z.string() })
const localized = z.object({ name: z.string(), summary: z.string().nullable(), description: z.string().nullable().optional(), instructions: z.array(z.string()).optional() })
export const libraryExerciseSchema = z.object({ id, name: z.string(), modality: z.enum(['resistance', 'cardio', 'mobility']), summary: z.string().optional(), description: z.string().optional(), instructions: z.array(z.string()).optional(), i18n: z.object({ de: localized }).optional(), equipmentRequired: z.array(z.string()).optional(), primaryMuscles: z.array(z.string()).optional(), isCustom: z.boolean().optional(), isFavorite: z.boolean().optional(), isHidden: z.boolean().optional(), archived: z.boolean(), setupInstructions: z.array(z.string()).optional(), formCues: z.array(z.string()).optional(), commonMistakes: z.array(z.string()).optional(), breathingPattern: z.string().optional(), safetyNotes: z.string().optional(), contraindications: z.array(z.string()).optional(), tracksWeight: z.boolean().optional(), tracksReps: z.boolean().optional(), tracksTime: z.boolean().optional(), tracksDistance: z.boolean().optional(), tracksHr: z.boolean().optional(), tracksPace: z.boolean().optional(), tracksCadence: z.boolean().optional(), tracksPower: z.boolean().optional(), tracksElevation: z.boolean().optional() })
const equipment = z.object({ id: z.string(), name: z.string(), trainingInterests: z.array(z.string()) })
const memory = z.object({ id, content: z.string().max(500), source: z.enum(['ai', 'user']), externalMcp: z.object({ clientId: z.string() }).optional(), createdAt: z.string(), updatedAt: z.string() })
export const libraryViewSchema = z.object({ view: z.literal('library'), record: z.object({ query: z.object({ q: z.string().optional(), show: z.enum(['all', 'favorites', 'custom', 'hidden']), modality: z.enum(['resistance', 'cardio', 'mobility']).optional(), page: z.number(), limit: z.number() }) }), related: z.object({ exercises: z.object({ data: z.array(libraryExerciseSchema), meta }) }), presentation })
export const exerciseViewSchema = z.object({ view: z.literal('exercise'), record: libraryExerciseSchema, related: z.object({ customEquipment: z.array(equipment) }), presentation })
export const contextViewSchema = z.object({ view: z.literal('context'), record: z.object({
  profile: z.object({ preferredName: z.string().nullable(), heightCm: z.number().nullable(), weightKg: z.number().nullable(), trainingGoals: z.array(z.string()), trainingInterests: z.array(z.string()), sportEventContext: z.string(), focusAreas: z.array(z.string()), motivation: z.string(), experience: z.string().nullable(), daysPerWeek: z.number().nullable(), availableDays: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])), minutesPerSession: z.number().nullable(), goalWeightKg: z.number().nullable(), bodyFatPercent: z.number().nullable(), restingHeartRate: z.number().nullable(), measurements: z.record(z.string(), z.number().nullable()) }),
  health: z.object({ limitations: z.array(z.string()), healthNotes: z.string() }), customEquipment: z.array(equipment),
  trainingSpaces: z.array(z.object({ id: z.string(), name: z.string(), access: z.enum(['unconfigured', 'selected']), equipment: z.object({ items: z.array(z.string()), custom: z.array(z.string()) }), notes: z.string(), isDefault: z.boolean() })),
  preferences: presentationSchema.extend({ weekStart: z.enum(['sunday', 'monday']).nullable() }),
  context: z.object({ today: z.string(), timezone: z.string(), unitSystem: z.enum(['metric', 'imperial']), weekStart: z.enum(['sunday', 'monday']), locale: z.string() })
}), related: z.object({ section: z.enum(['profile', 'health', 'equipment', 'spaces', 'preferences', 'memories']), memories: z.object({ data: z.array(memory), meta }) }), presentation })
export const memoryViewSchema = z.object({ view: z.literal('memory'), record: memory.extend({ revision: z.string().regex(/^memory:1:[a-f0-9]{64}$/) }), related: z.object({}), presentation })
export type LibraryView = z.infer<typeof libraryViewSchema>
export type ExerciseView = z.infer<typeof exerciseViewSchema>
export type ContextView = z.infer<typeof contextViewSchema>
export type MemoryView = z.infer<typeof memoryViewSchema>
export const contextTrainingViewSchema = z.discriminatedUnion('view', [libraryViewSchema, exerciseViewSchema, contextViewSchema, memoryViewSchema])
export type ContextTrainingView = z.infer<typeof contextTrainingViewSchema>
export const exerciseName = (exercise: z.infer<typeof libraryExerciseSchema>, locale: string) => locale.startsWith('de') ? exercise.i18n?.de.name ?? exercise.name : exercise.name
