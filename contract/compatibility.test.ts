import { describe, expect, it } from 'vitest'
import { interleavedExerciseSequence } from '../apps/workout/lib/sequenceUtils'
import { workoutSections } from '../apps/workout/lib/sections'
import { displayMeasure, formatMeasure, parseInput, storageValue, type ActualField } from '../apps/workout/presentation'
import type { UnitSystem } from '../apps/workout/lib/units'
import type { ViewActivity, ViewExercise } from '../apps/workout/model'
import fixtures from './compat-fixtures.json'

describe('published compatibility fixtures', () => {
  it('preserves clamped activity slots and ties', () => {
    for (const fixture of fixtures.nestedSequences) {
      const sets = fixture.sets.map(id => ({ id, category: 'working' as const, completed: false }))
      const activities = fixture.activities.map(activity => ({ ...activity, kind: 'rest' as const, title: '', completed: false }))
      expect(interleavedExerciseSequence(sets, activities).map(item => item.type === 'set' ? item.set.id : item.activity.id)).toEqual(fixture.expected)
    }
  })
  it('preserves canonical section order and stable root ties', () => {
    const section = (value: string | undefined) => value as ViewExercise['section']
    const exercises: ViewExercise[] = fixtures.sections.exercises.map(item => ({ ...item, section: section(item.section), exerciseId: item.id, exerciseName: item.id, modality: 'resistance', sets: [] }))
    const activities: ViewActivity[] = fixtures.sections.activities.map(item => ({ ...item, section: section(item.section), kind: 'rest', title: item.id, completed: false }))
    expect(workoutSections(exercises, activities).map(group => group.items.map(item => item.data.id))).toEqual(fixtures.sections.expected)
  })
  it('converts canonical storage at display thresholds', () => {
    for (const fixture of fixtures.conversions) {
      const result = displayMeasure(fixture.field as ActualField, fixture.value, fixture.system as UnitSystem)
      expect(result.unit).toBe(fixture.expected.unit)
      expect(result.value).toBeCloseTo(fixture.expected.value, 10)
    }
  })
  it('formats thresholds and rounding for the account locale', () => {
    for (const fixture of fixtures.formats) expect(formatMeasure(fixture.field as ActualField, fixture.value, fixture.system as UnitSystem, fixture.locale)).toBe(fixture.expected)
  })
  it('round-trips localized decimals to metric storage', () => {
    for (const fixture of fixtures.roundTrips) expect(storageValue(fixture.field as ActualField, parseInput(fixture.input, fixture.locale)!, fixture.unit)).toBeCloseTo(fixture.storage, 10)
    for (const fixture of fixtures.invalidNumbers) expect(() => parseInput(fixture.input, fixture.locale)).toThrow('INVALID_NUMBER')
    expect(parseInput(' ', 'de')).toBeNull()
  })
})
