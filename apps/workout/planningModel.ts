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
/**
 * Calendar presentation contract (EF-1474). `missed` and `ended` are presentation states only: a session keeps its
 * lifecycle `status`, and the canonical workout schema in model.ts is unchanged. A past `planned` session or an
 * unsatisfied past occurrence displays `missed`; `skipped` and `abandoned` sessions fall in the day's `ended` bucket.
 */
export const calendarSessionDisplayStatus = z.enum([...status.options, 'missed'])
export const scheduledOccurrenceDisplayStatus = z.enum(['planned', 'missed'])
/** The day aggregate, in precedence order: the highest bucket present, never "every session". */
export const calendarDayStatus = z.enum(['in_progress', 'missed', 'planned', 'completed', 'ended'])
const count = z.number().int().nonnegative()
/**
 * One program's share of a day's sessions (application EF-1575): every contributing program once, in the day's
 * session order. `programName` is omitted when the program no longer resolves.
 */
export const calendarDayProgram = z.object({ programId: id, programName: z.string().optional(), sessionCount: z.number().int().min(1) })
export const calendarViewSchema = z.object({
  view: z.literal('calendar'),
  record: z.object({ from: day, to: day, date: day,
    days: z.array(z.object({ date: day, status: calendarDayStatus.nullable(),
      sessionCount: count, completedSessionCount: count, inProgressSessionCount: count, plannedSessionCount: count, missedSessionCount: count, endedSessionCount: count,
      summary: z.object({ title: z.string(), status, programName: z.string().optional(), programs: z.array(calendarDayProgram).min(1).optional() }).optional() })),
    agenda: z.object({ date: day, items: z.array(z.object({ id: z.string(), name: z.string(), status, displayStatus: calendarSessionDisplayStatus, time: z.string(), scheduleId: id.optional() })) }).nullable()
  }), related: z.object({}), presentation
})
export type CalendarSessionDisplayStatus = z.infer<typeof calendarSessionDisplayStatus>
export type ScheduledOccurrenceDisplayStatus = z.infer<typeof scheduledOccurrenceDisplayStatus>
export type CalendarDayStatus = z.infer<typeof calendarDayStatus>
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

/** One mark per session, drawn from the day's buckets in this order. */
export const calendarMarkKinds = ['completed', 'in_progress', 'planned', 'missed', 'ended'] as const
export type CalendarMarkKind = typeof calendarMarkKinds[number]
type CalendarDay = CalendarView['record']['days'][number]
const bucket = { completed: 'completedSessionCount', in_progress: 'inProgressSessionCount', planned: 'plannedSessionCount', missed: 'missedSessionCount', ended: 'endedSessionCount' } as const satisfies Record<CalendarMarkKind, keyof CalendarDay>
export const dayMarks = (day: CalendarDay | undefined): CalendarMarkKind[] => day ? calendarMarkKinds.flatMap(kind => Array.from({ length: day[bucket[kind]] }, () => kind)) : []
/** The mark a single agenda row wears: skipped and abandoned sessions are the day's ended bucket. */
export const sessionMark = (displayStatus: CalendarSessionDisplayStatus): CalendarMarkKind => displayStatus === 'skipped' || displayStatus === 'abandoned' ? 'ended' : displayStatus
/**
 * The programs a day's card names: every named entry of `programs` (a day two programs share names both, and a day a
 * manual session leads still names its program), else the scalar `programName` an application before EF-1575 sends.
 */
export const dayProgramNames = (summary: CalendarDay['summary']): string[] => {
  const named = summary?.programs?.flatMap(program => program.programName ? [program.programName] : []) ?? []
  return named.length ? named : summary?.programName ? [summary.programName] : []
}
