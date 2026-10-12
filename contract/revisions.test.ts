import { expect, it } from 'vitest'
import fixtures from './compat-fixtures.json'
import { workoutSchema } from '../apps/workout/model'
import { goalPlanViewSchema } from '../apps/workout/goalModel'
import { reviewViewSchema } from '../apps/workout/outcomeModel'

it.each([1, 2])('preserves opaque workout revision version %i', (version) => {
  const workout = { id: 'a'.repeat(24), title: 'Training', date: '2026-10-12', status: 'completed', exercises: [], revision: `workout:${version}:${'b'.repeat(64)}` }
  expect(workoutSchema.parse(workout).revision).toBe(workout.revision)
})

it.each([1, 2])('preserves opaque plan revision version %i', (version) => {
  const fixture = fixtures.goalViews.find(item => item.view === 'goal-plan' && item.valid)!
  const plan = { ...structuredClone(fixture.input), record: { ...fixture.input.record, revision: `goalplan:${version}:${'c'.repeat(64)}` } }
  expect(goalPlanViewSchema.parse(plan).record.revision).toBe(plan.record.revision)
})

it.each([1, 2])('preserves opaque commentary revision version %i', (version) => {
  const workout = { id: 'a'.repeat(24), title: 'Training', date: '2026-10-12', status: 'completed' }
  const review = {
    view: 'workout-review', record: { id: workout.id, title: workout.title, date: workout.date, status: workout.status },
    related: { reflections: { workoutId: workout.id, coach: null, external: { content: 'Controlled tempo', createdAt: '2026-10-12T00:00:00Z', updatedAt: '2026-10-12T00:00:00Z', externalMcp: { clientId: 'fixture-client' } }, revision: `commentary:${version}:${'d'.repeat(64)}` }, decisions: { data: [], meta: { page: 1, limit: 20, total: 0 } } },
    presentation: { locale: 'en', unitSystem: 'metric', theme: 'light', skin: null, timeZone: 'UTC' }
  }
  expect(reviewViewSchema.parse(review).related.reflections.revision).toBe(review.related.reflections.revision)
})

it.each([`workout:3:${'a'.repeat(64)}`, `profile:2:${'a'.repeat(64)}`, `workout:2:${'a'.repeat(63)}`])('refuses unsupported, wrong-kind or malformed workout revision %s', (revision) => {
  expect(workoutSchema.safeParse({ id: 'a'.repeat(24), title: 'Training', date: '2026-10-12', status: 'planned', exercises: [], revision }).success).toBe(false)
})
