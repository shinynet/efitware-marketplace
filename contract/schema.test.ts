import fixtures from './compat-fixtures.json'
import { readFileSync } from 'node:fs'
import { Ajv } from 'ajv'
import { z } from 'zod'
import { expect, it } from 'vitest'
import { templateViewSchema, parseTrainingView } from '../apps/workout/templateModel'
import { viewSchema } from '../apps/workout/model'

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
