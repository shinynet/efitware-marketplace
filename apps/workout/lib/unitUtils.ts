import type { UnitSystem } from './units'

interface Measure { value: number, unit: string }
const LB_PER_KG = 2.2046226218
const M_PER_MILE = 1609.344

/** Weight: kg → kilogram | pound. */
export const convertWeight = (kg: number, system: UnitSystem): Measure => {
  return system === 'imperial'
    ? { value: kg * LB_PER_KG, unit: 'pound' }
    : { value: kg, unit: 'kilogram' }
}

/**
 * Distance: metres → mile (imperial) | metre/kilometre (metric, switching to km
 * at 1 km so a 5 000 m run reads "5 km", not "5,000 m").
 */
export const convertDistance = (meters: number, system: UnitSystem): Measure => {
  if (system === 'imperial') {
    return { value: meters / M_PER_MILE, unit: 'mile' }
  }
  return meters >= 1000
    ? { value: meters / 1000, unit: 'kilometer' }
    : { value: meters, unit: 'meter' }
}

/** Pounds → kilograms (the inverse of `convertWeight(_, 'imperial')`). */
export const poundsToKilograms = (pounds: number): number => pounds / LB_PER_KG

/** Miles → metres, the inverse of `convertDistance(_, 'imperial')`. */
export const metresFromMiles = (miles: number): number => miles * M_PER_MILE

/** Kilometres → metres, the inverse of `convertDistance`'s ≥1 km metric branch. */
export const metresFromKilometres = (km: number): number => km * 1000

/**
 * Converts an edited distance display value back to canonical metres, given the
 * Intl unit `convertDistance` returned for it. The metric `< 1 km` case stays in
 * metres (no conversion); the `kilometer` and `mile` cases reverse the forward
 * factor. Pairs with `convertDistance` so a value edited in the unit the cell
 * displayed round-trips back to storage exactly.
 */
export const metresFromDisplayDistance = (value: number, unit: string): number => {
  if (unit === 'mile') return metresFromMiles(value)
  if (unit === 'kilometer') return metresFromKilometres(value)
  return value
}

