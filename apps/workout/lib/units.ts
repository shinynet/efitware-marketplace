/**
 * Measurement-system contracts (EF-92) for the "utils convert, i18n formats"
 * layer: the active system plus the shapes the `convertWeight` / `convertDistance`
 * / `convertElevation` / `convertPace` helpers in `shared/utils/unitUtils.ts` return.
 * Storage is always metric; these describe a value converted to the user's
 * system, ready for `$n(value, 'measure', { unit })`.
 */

export type UnitSystem = 'metric' | 'imperial'
