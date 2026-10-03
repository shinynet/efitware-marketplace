import { z } from 'zod'

/**
 * Superset/circuit execution groups as the application persists them (app
 * EF-1552): `members` name THIS record's exercise instance ids and, per
 * member, one selected set id per round in round order. Round N runs every
 * member's Nth selected set in member order; a member's unselected sets run
 * before round 1. Rest is not part of a group: it is the ordinary Activity
 * anchored after the set it follows, so the card shows the rest the record
 * already holds at that position and never invents one.
 *
 * The schema is an open projection like every other view field: the
 * application validates the group rules, the card only reads them.
 */
export const executionGroupSchema = z.object({
  id: z.string(),
  kind: z.enum(['superset', 'circuit']),
  members: z.array(z.object({ workoutExerciseId: z.string(), setIds: z.array(z.string()).min(1).max(100) })).min(2).max(10)
})
export const executionGroupsSchema = z.array(executionGroupSchema).max(20)
export type ExecutionGroup = z.infer<typeof executionGroupSchema>

interface GroupExercise {
  id: string
  exerciseId: string
  exerciseName: string
  sets: ReadonlyArray<{ id: string }>
  activities?: ReadonlyArray<{ id: string, kind: string, title: string, order: number, durationTarget?: number }>
}

/** One member's turn in a round: its selected set and the Activities anchored after it, in array order. */
export interface GroupTurn {
  exercise: GroupExercise
  /** 1-based position of the selected set within its exercise, as the set rows number it. */
  setNumber: number
  activities: NonNullable<GroupExercise['activities']>
}

export interface PresentedGroup {
  group: ExecutionGroup
  members: GroupExercise[]
  /** `rounds[r][m]`: member m's turn in round r + 1. */
  rounds: GroupTurn[][]
}

/**
 * Activities anchored after `setNumber`, using the product's 1-based slot
 * clamped to the exercise's set count (the same rule `interleavedExerciseSequence`
 * applies), so a final rest and several blocks in one slot keep their order.
 */
const activitiesAfter = (exercise: GroupExercise, setNumber: number): NonNullable<GroupExercise['activities']> =>
  (exercise.activities ?? []).filter(activity => Math.min(Math.max(activity.order, 1), exercise.sets.length) === setNumber)

/**
 * The group's members and rounds over the record's own exercises, or
 * undefined when a reference does not resolve — the card then shows nothing
 * rather than a partial group, and the exercises still render in full.
 */
export const presentExecutionGroup = (group: ExecutionGroup, exercises: readonly GroupExercise[]): PresentedGroup | undefined => {
  const members = group.members.map(member => exercises.find(exercise => exercise.id === member.workoutExerciseId))
  if (members.some(member => member === undefined)) return undefined
  const resolved = members as GroupExercise[]
  const roundCount = group.members[0]!.setIds.length
  const rounds: GroupTurn[][] = []
  for (let round = 0; round < roundCount; round++) {
    const turns: GroupTurn[] = []
    for (const [index, member] of group.members.entries()) {
      const exercise = resolved[index]!
      const position = exercise.sets.findIndex(set => set.id === member.setIds[round])
      if (position === -1) return undefined
      turns.push({ exercise, setNumber: position + 1, activities: activitiesAfter(exercise, position + 1) })
    }
    rounds.push(turns)
  }
  return { group, members: resolved, rounds }
}

/** The group a member exercise opens, so the block renders once, right before its first member. */
export const groupOpenedBy = (groups: readonly ExecutionGroup[] | undefined, exerciseInstanceId: string): ExecutionGroup | undefined =>
  groups?.find(group => group.members[0]?.workoutExerciseId === exerciseInstanceId)

/**
 * The application page that edits a record's grouping — the card cannot, so
 * its grouping action opens the same page the card header links to.
 */
export const groupEditPath = (record: { kind: 'template', id: string } | { kind: 'workout', id: string, date: string }): string =>
  record.kind === 'template' ? `/saved-workouts/${record.id}` : `/workouts/${record.date}/${record.id}`
