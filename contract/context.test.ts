import { readFileSync } from 'node:fs'
import { Ajv } from 'ajv'
import { expect, it } from 'vitest'
import fixtures from './compat-fixtures.json'
import en from '../apps/workout/contextVocabulary.en.json'
import de from '../apps/workout/contextVocabulary.de.json'
import { memoryViewSchema } from '../apps/workout/contextModel'
it('keeps the published context vocabulary and exact memory revision projection compatible', () => {
  for (const fixture of fixtures.contextVocabulary) {
    const vocabulary = (fixture.locale === 'de' ? de : en) as Record<string, Record<string, string>>
    expect(vocabulary[fixture.path[0]!]![fixture.path[1]!]).toBe(fixture.text)
  }
  const input = { view: 'memory', record: { id: 'a'.repeat(24), content: '<script>This remains plain user data</script>', source: 'user', createdAt: '2026-09-09T10:00:00Z', updatedAt: '2026-09-09T10:00:00Z', revision: `memory:1:${'b'.repeat(64)}`, extraProductField: true }, related: {}, presentation: { locale: 'en', unitSystem: null, theme: null, skin: null, timeZone: 'America/Denver' } }
  expect(memoryViewSchema.parse(input).record.content).toBe(input.record.content)
  expect(memoryViewSchema.safeParse({ ...input, record: { ...input.record, revision: undefined } }).success).toBe(false)
})

it('accepts labelled equipment inventory in the released context schema without changing it', () => {
  const schema = JSON.parse(readFileSync(new URL('./context-view.schema.json', import.meta.url), 'utf8'))
  const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(schema)
  const plateSetId = 'pls-7b6e1189-869b-4e2b-86e5-b91441386ae6'
  const loads = {
    plateSets: [{ id: plateSetId, name: 'Shared plates', sizes: [
      { size: { value: 20, unit: 'kg' }, count: 2 },
      { size: { value: 0.25, unit: 'lb' }, count: 4 }
    ] }],
    equipment: [
      { equipmentId: 'barbell_plates', kind: 'plate_loaded', plateSetId, base: { value: 20, unit: 'kg' }, paired: true, implements: 1 },
      { equipmentId: 'farmers_handles', kind: 'plate_loaded', plateSetId, base: { value: 10, unit: 'lb' }, paired: false, implements: 2 },
      { equipmentId: 'fixed_dumbbells', kind: 'fixed', values: [{ value: 15, unit: 'lb' }, { value: 30, unit: 'lb' }] },
      { equipmentId: 'chest_press_machine', kind: 'stack', max: { value: 225, unit: 'lb' } },
      { equipmentId: 'adjustable_dumbbells', kind: 'stack', max: { value: 52.5, unit: 'lb' }, step: { value: 2.5, unit: 'lb' }, lightest: { value: 5, unit: 'lb' } },
      { equipmentId: 'resistance_bands', kind: 'bands', levels: ['Light', 'Medium', 'Heavy'] }
    ]
  }
  for (const unitSystem of ['metric', 'imperial']) {
    const presentation = { locale: 'en', unitSystem, theme: null, skin: null, timeZone: 'Europe/Berlin' }
    const input = {
      view: 'context',
      record: {
        profile: { preferredName: null, heightCm: null, weight: null, trainingGoals: [], trainingInterests: [], sportEventContext: '', focusAreas: [], motivation: '', experience: null, daysPerWeek: null, availableDays: [], minutesPerSession: null, goalWeight: null, bodyFat: null, restingHeartRate: null, measurements: {} },
        health: { limitations: [], healthNotes: '' }, customEquipment: [],
        trainingSpaces: [
          { id: 'ts-home', name: 'Home', access: 'selected', equipment: { items: loads.equipment.map(entry => entry.equipmentId), custom: [] }, notes: '', isDefault: true, loads },
          { id: 'ts-gym', name: 'Gym', access: 'unconfigured', equipment: { items: [], custom: [] }, notes: '', isDefault: false, loads: { plateSets: [], equipment: [] } }
        ],
        preferences: { ...presentation, weekStart: 'monday' },
        context: { today: '2026-10-06', timezone: 'Europe/Berlin', unitSystem, weekStart: 'monday', locale: 'en' }
      },
      related: { section: 'spaces', memories: { data: [], meta: { page: 1, limit: 20, total: 0 } } },
      presentation
    }
    const before = structuredClone(input)
    expect(validate(input), JSON.stringify(validate.errors)).toBe(true)
    expect(input).toEqual(before)
  }
})
