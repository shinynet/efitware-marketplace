import { Ajv } from 'ajv'
import { z } from 'zod'
import { expect, it } from 'vitest'
import fixtures from './compat-fixtures.json'
import { goalViewSchema, goalPlanViewSchema } from '../apps/workout/goalModel'

it('preserves goal targets and stable phase identities in open input projections', () => {
  for (const fixture of fixtures.goalViews) {
    const schema = fixture.view === 'goal' ? goalViewSchema : goalPlanViewSchema
    const projection = z.toJSONSchema(schema, { io: 'input', target: 'draft-07' })
    expect(JSON.stringify(projection)).not.toContain('"additionalProperties":false')
    const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(projection)
    const input = { ...structuredClone(fixture.input), futureProductField: true }
    expect(validate(input), JSON.stringify(validate.errors)).toBe(fixture.valid)
    expect(input.futureProductField).toBe(true)
    const invalid = { ...input, record: { ...input.record, revision: undefined } }
    expect(validate(invalid)).toBe(false)
  }
})
