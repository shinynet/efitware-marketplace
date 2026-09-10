import { Ajv } from 'ajv'
import { z } from 'zod'
import { expect, it } from 'vitest'
import fixtures from './compat-fixtures.json'
import { chartGeometry } from '../apps/workout/progressModel'
import { bodyMetricViewSchema } from '../apps/workout/focusedProgressModel'
import { resolveDisplayUnitSystem } from '../apps/workout/presentation'

it('uses the product locale default only when the account has no explicit unit choice', () => {
  expect(resolveDisplayUnitSystem(null, 'en')).toBe('imperial')
  expect(resolveDisplayUnitSystem(null, 'de')).toBe('metric')
  expect(resolveDisplayUnitSystem('metric', 'en')).toBe('metric')
  expect(resolveDisplayUnitSystem('imperial', 'de')).toBe('imperial')
})

it('keeps chart dates proportional across DST and leap days without inventing observations', () => {
  for (const fixture of fixtures.progressDates) {
    const points = fixture.dates.map((date, index) => ({ date, value: 80 + index }))
    const chart = chartGeometry(points)
    expect(chart.points.map(point => point.x)).toEqual(fixture.elapsedDays.map(days => 24 + days / fixture.elapsedDays.at(-1)! * 552))
    expect(chart.points.map(({ date, value }) => ({ date, value }))).toEqual(points)
  }
  expect(chartGeometry([{ date: '2026-01-01', value: 0 }, { date: '2026-01-08', value: 0 }], true).points.map(point => point.y)).toEqual([160, 160])
  expect(chartGeometry([]).points).toEqual([])
  expect(chartGeometry([{ date: '2026-01-01', value: 80 }]).points).toHaveLength(1)
})

it('accepts canonical metric observations and extra product fields without coercion or strict-object rejection', () => {
  const schema = z.toJSONSchema(bodyMetricViewSchema, { io: 'input', target: 'draft-07' })
  expect(JSON.stringify(schema)).not.toContain('"additionalProperties":false')
  const validate = new Ajv({ removeAdditional: false, coerceTypes: false, useDefaults: false }).compile(schema)
  for (const fixture of fixtures.bodyMetricViews) {
    const raw = { ...structuredClone(fixture), futureProductField: true }
    const before = structuredClone(raw)
    expect(validate(raw), JSON.stringify(validate.errors)).toBe(true)
    expect(raw).toEqual(before)
    expect(validate({ ...raw, record: { ...raw.record, key: 'guessed_weight' } })).toBe(false)
    expect(validate({ ...raw, presentation: { ...raw.presentation, unitSystem: 'guessed' } })).toBe(false)
    expect(validate({ ...raw, related: {} })).toBe(false)
  }
})
