import { z } from 'zod'
import { presentationSchema } from './model.ts'

const id = z.string().regex(/^[a-f0-9]{24}$/i)
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const revision = (type: string) => z.string().regex(new RegExp(`^${type}:1:[a-f0-9]{64}$`))
const meta = z.object({ total: z.number().int().nonnegative(), page: z.number().int().positive(), limit: z.number().int().positive() })
const presentation = presentationSchema.extend({ timeZone: z.string() })
const status = z.enum(['planned', 'in_progress', 'completed', 'skipped', 'abandoned'])
const schedule = z.object({ id, name: z.string(), templateId: id, templateName: z.string().optional(), recurrence: z.string(), startDate: day, endDate: day, enabled: z.boolean(), programId: id.optional(), programName: z.string().optional(), nextOccurrence: day.optional() })
const workout = z.object({ id, title: z.string(), date: day, status })
export const programViewSchema = z.object({
  view: z.literal('program'),
  record: z.object({ id, name: z.string(), description: z.string().optional(), status: z.enum(['active', 'archived']), revision: revision('program') }),
  related: z.object({
    schedules: z.array(schedule), schedulesMeta: meta, attachedWorkouts: z.array(workout), attachedWorkoutsMeta: meta,
    recentWorkouts: z.array(workout), recentWorkoutsMeta: meta, workoutCount: z.number().int().nonnegative(),
    span: z.object({ startDate: day, endDate: day }).optional(), supportsGoal: z.object({ id, name: z.string() }).optional(),
    today: day, page: z.number().int().positive(), limit: z.number().int().positive(), collection: z.enum(['schedules', 'attachedWorkouts', 'recentWorkouts'])
  }), presentation
})
export const scheduleViewSchema = z.object({ view: z.literal('schedule'), record: schedule.extend({ revision: revision('schedule') }), related: z.object({ today: day }), presentation })
export const calendarViewSchema = z.object({
  view: z.literal('calendar'),
  record: z.object({ from: day, to: day, date: day,
    days: z.array(z.object({ date: day, status: z.enum(['completed', 'incomplete', 'in_progress']).nullable(), sessionCount: z.number().int().nonnegative(), completedSessionCount: z.number().int().nonnegative(), summary: z.object({ title: z.string(), status, programName: z.string().optional() }).optional() })),
    agenda: z.object({ date: day, items: z.array(z.object({ id: z.string(), name: z.string(), status, time: z.string(), scheduleId: id.optional() })) }).nullable()
  }), related: z.object({}), presentation
})
export type ProgramView = z.infer<typeof programViewSchema>
export type ScheduleView = z.infer<typeof scheduleViewSchema>
export type CalendarView = z.infer<typeof calendarViewSchema>
export type PlanningView = ProgramView | ScheduleView | CalendarView
export const planningViewSchema = z.discriminatedUnion('view', [programViewSchema, scheduleViewSchema, calendarViewSchema])

/** Calendar days never cross a zone; only real instants use the account's zone. */
export const formatDay = (date: string, locale: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
export const shiftDay = (date: string, offset: number) => new Date(Date.parse(`${date}T12:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
export const rangeDays = (from: string, to: string) => {
  const days = []
  for (let date = from; date <= to && days.length < 42; date = shiftDay(date, 1)) days.push(date)
  return days
}
