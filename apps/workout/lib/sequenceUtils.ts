import type { ViewActivity as Activity, ViewSet as WorkoutSet } from '../model'

export type ExerciseSequenceItem = { type: 'set', set: WorkoutSet } | { type: 'activity', activity: Activity }

/** Preserve product slot clamping and stable activity order. */
export const interleavedExerciseSequence = (sets: WorkoutSet[], activities: Activity[]): ExerciseSequenceItem[] => {
  if (sets.length === 0) return activities.map(activity => ({ type: 'activity' as const, activity }))
  const bySlot = new Map<number, Activity[]>()
  for (const activity of activities) {
    const slot = Math.min(Math.max(activity.order, 1), sets.length)
    const bucket = bySlot.get(slot)
    if (bucket) bucket.push(activity)
    else bySlot.set(slot, [activity])
  }
  return sets.flatMap((set, index) => [
    { type: 'set' as const, set },
    ...(bySlot.get(index + 1) ?? []).map(activity => ({ type: 'activity' as const, activity }))
  ])
}

