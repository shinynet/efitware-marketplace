import fixtures from './compat-fixtures.json'
import { readFileSync } from 'node:fs'
import { Ajv } from 'ajv'
import { z } from 'zod'
import { expect, it } from 'vitest'
import { templateViewSchema, parseTrainingView } from '../apps/workout/templateModel'
import { viewSchema } from '../apps/workout/model'
import { goalViewSchema } from '../apps/workout/goalModel'
import { programViewSchema, scheduleViewSchema } from '../apps/workout/planningModel'

it.each([1, 2])('accepts opaque revision version %i across the four narrative resource cards', (version) => {
  const id = 'a'.repeat(24), day = '2026-10-13'
  const presentation = { locale: 'en', unitSystem: 'metric', theme: null, skin: null, timeZone: 'UTC' }
  const meta = { total: 0, page: 1, limit: 10 }
  const views = [
    { schema: templateViewSchema, input: { view: 'template', record: { id, name: 'Training', revision: `template:${version}:${'a'.repeat(64)}`, exercises: [] }, related: { exercises: [] }, presentation } },
    { schema: goalViewSchema, input: { view: 'goal', record: { id, name: 'Consistency', status: 'active', programIds: [], revision: `goal:${version}:${'a'.repeat(64)}` }, related: { programs: [], checkInCount: 0, checkIns: { data: [], meta }, today: day }, presentation } },
    { schema: programViewSchema, input: { view: 'program', record: { id, name: 'Block', status: 'active', revision: `program:${version}:${'a'.repeat(64)}` }, related: { schedules: [], schedulesMeta: meta, attachedWorkouts: [], attachedWorkoutsMeta: meta, recentWorkouts: [], recentWorkoutsMeta: meta, workoutCount: 0, today: day, page: 1, limit: 10, collection: 'schedules' }, presentation } },
    { schema: scheduleViewSchema, input: { view: 'schedule', record: { id, name: 'Mondays', templateId: id, recurrence: 'FREQ=WEEKLY;BYDAY=MO', startDate: day, endDate: '2026-12-31', enabled: true, revision: `schedule:${version}:${'a'.repeat(64)}` }, related: { today: day }, presentation } }
  ]
  for (const { schema, input } of views) {
    const before = structuredClone(input)
    const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(z.toJSONSchema(schema, { io: 'input', target: 'draft-07' }))
    expect(validate(input), JSON.stringify(validate.errors)).toBe(true)
    expect(input).toEqual(before)
    expect(() => parseTrainingView(input)).not.toThrow()
    expect(validate({ ...input, record: { ...input.record, revision: input.record.revision.replace(`:${version}:`, ':3:') } })).toBe(false)
  }
})

it('publishes the open draft-07 input projection without modifying product data', () => {
  const schema = z.toJSONSchema(viewSchema, { io: 'input', target: 'draft-07' })
  expect(JSON.parse(readFileSync(new URL('./workout-view.schema.json', import.meta.url), 'utf8'))).toEqual(schema)
  expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#')
  expect(JSON.stringify(schema)).not.toContain('"additionalProperties":false')
  const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(schema)
  const view = {
    workout: { id: 'a'.repeat(24), title: 'Training', date: '2026-09-09', status: 'planned', revision: `workout:1:${'a'.repeat(64)}`, exercises: [], productOnly: 'retained' },
    exercises: [], presentation: { locale: 'en', unitSystem: 'metric', theme: null, skin: null }
  }
  const before = structuredClone(view)
  expect(validate(view)).toBe(true)
  expect(view).toEqual(before)
  const missing: Record<string, unknown> = { ...view.workout }
  delete missing.revision
  expect(validate({ ...view, workout: missing })).toBe(false)
  expect(validate({ ...view, presentation: { ...view.presentation, unitSystem: 'unknown' } })).toBe(false)
})

it('validates planned templates without session actuals and rejects missing revision or unknown views', () => {
  const schema = z.toJSONSchema(templateViewSchema, { io: 'input', target: 'draft-07' })
  expect(JSON.parse(readFileSync(new URL('./template-view.schema.json', import.meta.url), 'utf8'))).toEqual(schema)
  expect(JSON.stringify(schema)).not.toContain('"additionalProperties":false')
  const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(schema)
  const view = { view: 'template', record: { id: 'a'.repeat(24), name: 'Soloflex', revision: `template:1:${'a'.repeat(64)}`, exercises: [], productField: 'retained' }, related: { exercises: [] }, presentation: { locale: 'de', unitSystem: 'metric', theme: null, skin: null } }
  expect(validate(view)).toBe(true)
  expect(view.record.productField).toBe('retained')
  expect(validate({ ...view, record: { ...view.record, revision: undefined } })).toBe(false)
  expect(() => parseTrainingView({ ...view, view: 'unknown' })).toThrow()
})

it('runs the released template fixtures without changing input bytes', () => {
  const schema = z.toJSONSchema(templateViewSchema, { io: 'input', target: 'draft-07' })
  const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(schema)
  for (const fixture of fixtures.templateViews) {
    const before = structuredClone(fixture.input)
    expect(validate(fixture.input), fixture.name).toBe(fixture.valid)
    expect(fixture.input).toEqual(before)
  }
})

it('preserves the full template prescription including effort, tempo and side', () => {
  const input = { view: 'template', record: { id: 'a'.repeat(24), name: 'Training', revision: `template:1:${'a'.repeat(64)}`, exercises: [{ id: 'we-one', exerciseId: 'b'.repeat(24), exerciseName: 'Row', modality: 'resistance', order: 0, sets: [{ id: 's-one', category: 'amrap', plannedAmrap: true, plannedRpe: 7, tempo: '3-1-1-0', side: 'left' }] }] }, related: { exercises: [] }, presentation: { locale: 'en', unitSystem: 'metric', theme: null, skin: null } }
  expect(templateViewSchema.parse(input).record.exercises[0]!.sets[0]).toMatchObject({ plannedAmrap: true, plannedRpe: 7, tempo: '3-1-1-0', side: 'left' })
})
