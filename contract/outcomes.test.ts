import { readFileSync } from 'node:fs'
import { Ajv } from 'ajv'
import { z } from 'zod'
import { expect, it } from 'vitest'
import { statusViewSchema, integrationViewSchema, receiptsViewSchema, reviewViewSchema, shareViewSchema } from '../apps/workout/outcomeModel'
import coverage from './view-coverage.json'

it('publishes open outcome projections and distinguishes direct controls from AI-mediated edits', () => {
  for (const [name, projection] of Object.entries({ status: statusViewSchema, integration: integrationViewSchema, receipts: receiptsViewSchema, 'workout-review': reviewViewSchema, share: shareViewSchema })) {
    const schema = z.toJSONSchema(projection, { io: 'input', target: 'draft-07' })
    expect(JSON.parse(readFileSync(`contract/${name}-view.schema.json`, 'utf8'))).toEqual(schema)
    expect(JSON.stringify(schema)).not.toContain('"additionalProperties":false')
    new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(schema)
  }
  expect(coverage.tools.undo_action.interaction).toBe('direct-and-host')
  expect(coverage.tools.create_custom_exercise.interaction).toBe('host')
  expect(Object.values(coverage.tools).every(tool => tool.delivery === 'implemented' && tool.interaction)).toBe(true)
})

it('requires exact commentary revisions and safe receipt shape without coercion', () => {
  const input = { view: 'workout-review', record: { id: 'a'.repeat(24), title: 'Bench', date: '2026-09-10', status: 'completed', extra: true }, related: { reflections: { workoutId: 'a'.repeat(24), coach: null, external: null, revision: null }, decisions: { data: [], meta: { page: 1, limit: 20, total: 0 } } }, presentation: { locale: 'en', unitSystem: null, theme: null, skin: null, timeZone: 'America/Denver' } }
  const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(z.toJSONSchema(reviewViewSchema, { io: 'input', target: 'draft-07' }))
  const before = structuredClone(input)
  expect(validate(input)).toBe(true)
  expect(input).toEqual(before)
  expect(validate({ ...input, related: { ...input.related, reflections: { ...input.related.reflections, revision: 'old' } } })).toBe(false)
  expect(validate({ ...input, presentation: { ...input.presentation, unitSystem: 'unknown' } })).toBe(false)
})
