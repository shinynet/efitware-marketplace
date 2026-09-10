import { Ajv } from 'ajv'
import { z } from 'zod'
import { expect, it } from 'vitest'
import fixtures from './compat-fixtures.json'
import { parseRecurrence } from '../apps/workout/lib/recurrence'
import { rangeDays, shiftDay, programViewSchema, calendarViewSchema, scheduleViewSchema } from '../apps/workout/planningModel'

it('keeps calendar day ranges intact across DST and leap days', () => {
  for (const fixture of fixtures.calendarRanges) {
    expect(rangeDays(fixture.from, fixture.to)).toEqual(fixture.days)
    expect(shiftDay(fixture.from, fixture.days.length - 1)).toBe(fixture.to)
  }
})
it('matches the product recurrence interpretation for the shared fixtures', () => {
  for (const fixture of fixtures.recurrences) expect(parseRecurrence(fixture.rule)).toMatchObject(fixture.expected)
})
it('publishes open input projections for each planning view', () => {
  for (const schema of [programViewSchema, calendarViewSchema, scheduleViewSchema]) {
    const projection = z.toJSONSchema(schema, { io: 'input', target: 'draft-07' })
    expect(JSON.stringify(projection)).not.toContain('"additionalProperties":false')
    const validator = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(projection)
    expect(validator({ view: 'unrecognized' })).toBe(false)
  }
})
