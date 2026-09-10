import { z } from 'zod'
import { presentationSchema } from './model.ts'
const id = z.string().regex(/^[a-f0-9]{24}$/i)
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const meta = z.object({ total: z.number().int().nonnegative(), page: z.number().int().positive(), limit: z.number().int().positive() })
const presentation = presentationSchema.extend({ timeZone: z.string() })
const goal = z.object({ id, name: z.string(), status: z.enum(['active', 'achieved', 'abandoned']), targetDate: day.optional(), targetMeasure: z.string().optional(), nextCheckInDate: day.optional(), programIds: z.array(id) })
const checkIn = z.object({ id, goalId: id, date: day, value: z.string().optional(), note: z.string().optional() })
const planStatus = z.enum(['active', 'paused', 'completed', 'archived'])
const management = z.enum(['coach', 'manual'])
export const goalViewSchema = z.object({ view: z.literal('goal'), record: goal.extend({ revision: z.string().regex(/^goal:1:[a-f0-9]{64}$/) }), related: z.object({
  programs: z.array(z.object({ id, name: z.string(), description: z.string().optional(), status: z.enum(['active', 'archived']) })),
  checkInCount: z.number().int().nonnegative(), latestCheckIn: checkIn.optional(), coachPlan: z.object({ id, status: planStatus, managementMode: management.optional() }).optional(),
  checkIns: z.object({ data: z.array(checkIn), meta }), today: day
}), presentation })
const revisionEvidence = z.object({ reason: z.enum(['check_in', 'goal_changed', 'program_detached', 'weekly', 'milestone']).optional(), fromVersion: z.number(), toVersion: z.number(), linkedProgram: z.boolean(), replacedCount: z.number(), skippedCount: z.number() })
const versionSummary = z.object({ id, version: z.number().int().positive(), state: z.enum(['published', 'superseded']), authoredBy: z.enum(['coach', 'user']), externalMcp: z.object({ clientId: z.string() }).optional(), feasibility: z.enum(['reasonable', 'ambitious', 'not_credible', 'insufficient_data']), rationale: z.string(), changedSummary: z.array(z.string()), revisionEvidence: revisionEvidence.optional(), createdAt: z.string() })
const version = versionSummary.extend({ phases: z.array(z.object({ id: z.string().min(1).max(40), name: z.string(), objective: z.string(), startDate: day, endDate: day, programId: id.optional(), programName: z.string().optional(), reviewDate: day.optional(), milestones: z.array(z.object({ id: z.string().min(1).max(40), description: z.string(), date: day.optional() })) })) })
export const goalPlanViewSchema = z.object({ view: z.literal('goal-plan'), record: z.object({ id, goalId: id, managementMode: management, status: planStatus, createdBy: z.enum(['coach', 'user']), revision: z.string().regex(/^goalplan:1:[a-f0-9]{64}$/) }), related: z.object({
  goal, activeVersion: version, displayedVersion: version, history: z.array(versionSummary), historyMeta: meta, aiPaused: z.boolean(), today: day,
  noChangeReviews: z.array(z.object({ id, reason: z.enum(['check_in', 'goal_changed', 'program_detached', 'weekly', 'milestone']), reviewedAt: z.string(), evidence: z.string(), evidenceFacts: z.object({ completedSessions: z.number(), attributedSessions: z.number(), prCount: z.number(), checkInCount: z.number(), commitmentCount: z.number() }).optional() }))
}), presentation })
export type GoalView = z.infer<typeof goalViewSchema>
export type GoalPlanView = z.infer<typeof goalPlanViewSchema>
export type GoalTrainingView = GoalView | GoalPlanView
export const goalTrainingViewSchema = z.discriminatedUnion('view', [goalViewSchema, goalPlanViewSchema])
