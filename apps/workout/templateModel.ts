import { contextTrainingViewSchema, type ContextTrainingView } from './contextModel.ts'
import { focusedProgressViewSchema, type FocusedProgressView } from './focusedProgressModel.ts'
import { progressViewSchema, type ProgressView } from './progressModel.ts'
import { goalTrainingViewSchema, type GoalTrainingView } from './goalModel.ts'
import { planningViewSchema, type PlanningView } from './planningModel.ts'
import { z } from 'zod'
import { activitySchema, exerciseSchema, presentationSchema, setSchema, trackingSchema, viewSchema } from './model.ts'

// Templates prescribe training; session actuals/completion are never required here.
export const plannedSetSchema = setSchema.omit({ completed: true, weight: true, reps: true, duration: true, distance: true })
export const plannedActivitySchema = activitySchema.omit({ completed: true, durationActual: true })
export const plannedExerciseSchema = exerciseSchema.extend({ sets: z.array(plannedSetSchema), activities: z.array(plannedActivitySchema).optional() })
export const templateViewSchema = z.object({
  view: z.literal('template'),
  record: z.object({
    id: z.string().regex(/^[a-f0-9]{24}$/i), name: z.string(), description: z.string().optional(), tags: z.array(z.string()).optional(),
    revision: z.string().regex(/^template:1:[a-f0-9]{64}$/),
    exercises: z.array(plannedExerciseSchema), activities: z.array(plannedActivitySchema).optional()
  }),
  related: z.object({ exercises: z.array(trackingSchema.extend({ description: z.string().optional(), instructions: z.array(z.string()).optional(), instructionsDe: z.array(z.string()).optional() })) }),
  presentation: presentationSchema
})
export type TemplateView = z.infer<typeof templateViewSchema>
export type TrainingView = ContextTrainingView | FocusedProgressView | ProgressView | GoalTrainingView | PlanningView | TemplateView | { view: 'workout', record: z.infer<typeof viewSchema> }
export const parseTrainingView = (input: unknown): TrainingView => {
  const context = contextTrainingViewSchema.safeParse(input)
  if (context.success) return context.data
  const focused = focusedProgressViewSchema.safeParse(input)
  if (focused.success) return focused.data
  const progress = progressViewSchema.safeParse(input)
  if (progress.success) return progress.data
  const goal = goalTrainingViewSchema.safeParse(input)
  if (goal.success) return goal.data
  const planning = planningViewSchema.safeParse(input)
  if (planning.success) return planning.data
  const template = templateViewSchema.safeParse(input)
  if (template.success) return template.data
  return { view: 'workout', record: viewSchema.parse(input) }
}
