import { presentedPrAwards, type ProgressView } from './progressModel'

type RecentPr = ProgressView['record']['recentPrs'][number]

/** Group the existing recent feed's actions, keeping each award's own source performance. */
export const recentRecordGroups = (recent: readonly RecentPr[]) => {
  const items = recent.flatMap(pr => {
    const awards = pr.type ? presentedPrAwards([{ ...pr, type: pr.type }], pr.loadShape) : []
    // An older producer's unclassified row is still a recorded observation.
    return pr.type && !awards.length ? [] : [{ pr, awards }]
  })
  const groups = new Map<string, { key: string, source: RecentPr, items: typeof items }>()
  for (const item of items) {
    const key = `${item.pr.workoutId}:${item.pr.exerciseId}`
    const group = groups.get(key)
    if (group) group.items.push(item)
    else groups.set(key, { key, source: item.pr, items: [item] })
  }
  return [...groups.values()]
}
