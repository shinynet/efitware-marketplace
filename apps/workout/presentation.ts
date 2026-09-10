import { convertDistance, convertWeight, metresFromDisplayDistance, poundsToKilograms } from './lib/unitUtils'
import type { UnitSystem } from './lib/units'

export type ActualField = 'weight' | 'reps' | 'duration' | 'distance'
export const displayMeasure = (field: ActualField, value: number, system: UnitSystem) => {
  if (field === 'weight') return convertWeight(value, system)
  if (field === 'distance') return convertDistance(value, system)
  return { value, unit: field === 'duration' ? 'second' : undefined }
}
export const formatMeasure = (field: ActualField, value: number, system: UnitSystem, locale: string) => {
  const display = field === 'duration' && value >= 60
    ? { value: value / (value >= 3600 ? 3600 : 60), unit: value >= 3600 ? 'hour' : 'minute' }
    : displayMeasure(field, value, system)
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, ...(display.unit ? { style: 'unit', unit: display.unit, unitDisplay: 'short' } as const : {}) }).format(display.value)
}
export const storageValue = (field: ActualField, value: number, unit: string | undefined) => {
  if (field === 'weight' && unit === 'pound') return poundsToKilograms(value)
  if (field === 'distance' && unit) return metresFromDisplayDistance(value, unit)
  return value
}
export const parseInput = (input: string, locale: string): number | null => {
  const text = input.trim()
  if (!text) return null
  const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === 'decimal')?.value ?? '.'
  const normalized = text.replace(decimal, '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error('INVALID_NUMBER')
  const value = Number(normalized)
  if (!Number.isFinite(value)) throw new Error('INVALID_NUMBER')
  return value
}
