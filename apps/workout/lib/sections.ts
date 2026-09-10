import type { ViewActivity, ViewExercise } from '../model'

/** Group the product's stable root sequence into its three visible sections. */
export const workoutSections = (exercises: ViewExercise[], activities: ViewActivity[]) =>
  (['warmup', 'main', 'cooldown'] as const).map(section => ({
    section,
    items: [
      ...exercises.map(exercise => ({ type: 'exercise' as const, data: exercise })),
      ...activities.map(activity => ({ type: 'activity' as const, data: activity }))
    ].filter(item => (item.data.section ?? 'main') === section).sort((a, b) => a.data.order - b.data.order)
  })).filter(section => section.items.length)
