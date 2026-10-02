import { Ajv } from 'ajv'
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { createSSRApp, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'
import fixtures from './compat-fixtures.json'
import TemplateView from '../apps/workout/TemplateView.vue'
import ExecutionGroupBlock from '../apps/workout/ExecutionGroupBlock.vue'
import { viewSchema } from '../apps/workout/model'
import { parseTrainingView, templateViewSchema, type TemplateView as TemplateViewModel } from '../apps/workout/templateModel'
import { groupEditPath, groupOpenedBy, presentExecutionGroup } from '../apps/workout/executionGroups'
import { compactSummary } from '../apps/workout/compactSummary'
import { messages } from '../apps/workout/messages'

/**
 * Superset/circuit groups (app EF-1552). `fixtures.executionGroups` holds the
 * grouped open_workout and open_template payloads the application emits: a
 * two-round superset whose rest is the record's own Activities — a 90 s rest
 * after each Seated row set, an explicit 0 s rest after the last Overhead
 * press set, and a water break sharing the final slot.
 */
const grouped = fixtures.executionGroups
const clone = <T>(value: T): T => structuredClone(value)
const ajv = (schema: z.ZodType) => new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false })
  .compile(z.toJSONSchema(schema, { io: 'input', target: 'draft-07' }))

const render = async (component: Component, props: Record<string, unknown>, locale: 'en' | 'de' = 'en') => {
  const app = createSSRApp(component, props)
  app.use(createI18n({ legacy: false, locale, fallbackLocale: 'en', messages }))
  return renderToString(app)
}
const text = (html: string) => html.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('execution-group schemas', () => {
  it('admits the grouped workout and template payloads and keeps the projections open', () => {
    expect(ajv(viewSchema)(grouped.openWorkout)).toBe(true)
    expect(ajv(templateViewSchema)(grouped.openTemplate)).toBe(true)
    const extra = clone(grouped.openWorkout) as { workout: { executionGroups: Array<Record<string, unknown>> } }
    extra.workout.executionGroups[0]!.futureGroupField = 'preserved'
    expect(ajv(viewSchema)(extra)).toBe(true)
    expect(parseTrainingView(grouped.openTemplate)).toMatchObject({ view: 'template', record: { executionGroups: grouped.openTemplate.record.executionGroups } })
  })

  it('rejects a group the application could never persist', () => {
    const withGroup = (group: Record<string, unknown>) => {
      const view = clone(grouped.openWorkout) as { workout: { executionGroups: unknown[] } }
      view.workout.executionGroups = [{ ...grouped.openWorkout.workout.executionGroups[0], ...group }]
      return view
    }
    const validate = ajv(viewSchema)
    expect(validate(withGroup({ kind: 'giant-set' }))).toBe(false)
    expect(validate(withGroup({ members: [{ workoutExerciseId: 'we-press', setIds: ['s-p1'] }] }))).toBe(false)
    expect(validate(withGroup({ members: [{ workoutExerciseId: 'we-press', setIds: [] }, { workoutExerciseId: 'we-row', setIds: ['s-r1'] }] }))).toBe(false)
  })
})

describe('presentExecutionGroup', () => {
  const { workout } = grouped.openWorkout
  const group = workout.executionGroups[0]!

  it('runs each round member by member with the Activities saved after each selected set', () => {
    const presented = presentExecutionGroup(group as never, workout.exercises as never)!
    expect(presented.members.map(member => member.exerciseName)).toEqual(['Overhead press', 'Seated row'])
    expect(presented.rounds.map(turns => turns.map(turn => [turn.exercise.exerciseName, turn.setNumber, turn.activities.map(activity => [activity.kind, activity.durationTarget ?? null])]))).toEqual([
      [['Overhead press', 2, []], ['Seated row', 1, [['rest', 90]]]],
      // explicit 0 s rest kept; the final round rest and the water break share one slot, in array order
      [['Overhead press', 3, [['rest', 0]]], ['Seated row', 2, [['rest', 90], ['water_break', null]]]]
    ])
  })

  it('opens on its first member only, and shows nothing for a reference the record does not hold', () => {
    expect(groupOpenedBy(workout.executionGroups as never, 'we-press')?.id).toBe('eg-upper')
    expect(groupOpenedBy(workout.executionGroups as never, 'we-row')).toBeUndefined()
    expect(presentExecutionGroup({ ...group, members: [group.members[0]!, { workoutExerciseId: 'we-gone', setIds: ['s-x'] }] } as never, workout.exercises as never)).toBeUndefined()
    expect(presentExecutionGroup({ ...group, members: [group.members[0]!, { workoutExerciseId: 'we-row', setIds: ['s-r1', 's-gone'] }] } as never, workout.exercises as never)).toBeUndefined()
  })
})

describe('the grouped template card', () => {
  const props = (template: unknown) => ({
    template: parseTrainingView(template) as TemplateViewModel, disabled: false, openApp: () => undefined,
    navigate: async () => undefined, create: () => undefined, followUp: async () => 'accepted' as const
  })

  it('labels the superset, its rounds, member order and the saved rests, and keeps every member row', async () => {
    const html = text(await render(TemplateView, props(grouped.openTemplate)))
    expect(html).toContain('Superset')
    expect(html).toContain('2 rounds')
    expect(html).toMatch(/Exercise order\s+Overhead press\s+Seated row/)
    expect(html).toMatch(/Round 1\s+Overhead press · set 2\s+Seated row · set 1\s+Rest 1\.5 min\s+Round 2\s+Overhead press · set 3\s+Rest 0 sec\s+Seated row · set 2\s+Rest 1\.5 min\s+Water break/)
    // the members' own prescriptions still render in full: nothing is flattened away
    expect(html.match(/Set 1/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('Set 3')
    expect(html).toContain('Change grouping in eFitware')
  })

  it('renders in German and nothing extra for a sequential template', async () => {
    expect(text(await render(TemplateView, props({ ...grouped.openTemplate, presentation: { ...grouped.openTemplate.presentation, locale: 'de' } }), 'de'))).toMatch(/Supersatz\s+2 Runden/)
    const record: Record<string, unknown> = clone(grouped.openTemplate.record)
    delete record.executionGroups
    const html = text(await render(TemplateView, props({ ...grouped.openTemplate, record })))
    expect(html).not.toContain('Superset')
    expect(html).not.toContain('Change grouping in eFitware')
  })

  it('offers grouping edits only as a link to the record\'s own application page', async () => {
    const presented = presentExecutionGroup(grouped.openWorkout.workout.executionGroups[0] as never, grouped.openWorkout.workout.exercises as never)!
    const html = await render(ExecutionGroupBlock, { presented, nameOf: (exercise: { exerciseName: string }) => exercise.exerciseName, open: () => undefined })
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('type="button"')
    expect(html).not.toMatch(/<input|<select|<textarea/)
    const t = (key: string) => key
    const workoutView = parseTrainingView(grouped.openWorkout)
    const templateView = parseTrainingView(grouped.openTemplate)
    const summaryPath = (view: ReturnType<typeof parseTrainingView>) => compactSummary(view, { locale: 'en', system: 'imperial', t, te: () => true }).path
    const { workout } = grouped.openWorkout
    expect(groupEditPath({ kind: 'workout', id: workout.id, date: workout.date })).toBe(summaryPath(workoutView))
    expect(groupEditPath({ kind: 'template', id: grouped.openTemplate.record.id })).toBe(summaryPath(templateView))
  })
})
