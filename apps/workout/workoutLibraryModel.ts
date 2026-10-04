import { z } from 'zod'
import { presentationSchema } from './model.ts'

/**
 * The workout Library card's consumer projection (EF-1607, format 8). The
 * application's `open_workout_library` returns `search_workout_library`'s
 * result as `record.mode: 'browse'` and `get_workout_library_item`'s as
 * `record.mode: 'item'`. The application DTO is authoritative: these objects
 * stay open so additive product fields pass.
 */

const presentation = presentationSchema.extend({ timeZone: z.string() })
const objectId = z.string().regex(/^[a-f0-9]{24}$/i)
const authoredId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const meta = z.object({ page: z.number().int().positive(), limit: z.number().int().positive(), total: z.number().int().nonnegative() })

export const librarySpaceSchema = z.object({
  id: z.string(), name: z.string(), isDefault: z.boolean(),
  equipment: z.enum(['confirmed', 'unconfigured'])
})
const slotExercise = { slotId: authoredId, exerciseId: objectId.optional(), name: z.string().optional() }
/** `personal`: the reason is withheld health data (the assistant has no health-sharing permission). */
export const swapCauseSchema = z.enum(['equipment', 'limitations-or-hidden', 'personal'])
export const unavailableReasonSchema = z.enum(['equipment', 'limitations', 'days', 'catalog', 'personal'])
export const libraryFitSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('needs-space') }),
  z.object({ state: z.literal('exact'), variantIds: z.array(authoredId) }),
  z.object({
    state: z.literal('adaptable'), variantIds: z.array(authoredId),
    swaps: z.array(z.object({ ...slotExercise, cause: swapCauseSchema, missingEquipment: z.array(z.string()) })).min(1)
  }),
  z.object({
    state: z.literal('unavailable'), reason: unavailableReasonSchema,
    slotIds: z.array(authoredId), exercises: z.array(z.object(slotExercise)),
    missingEquipment: z.array(z.string()).optional(), requiredDays: z.number().int().positive().optional()
  })
])
export const libraryTagsSchema = z.object({
  focus: z.array(z.string()), style: z.array(z.string()), purpose: z.array(z.string()), experience: z.array(z.string())
})
export const libraryItemSchema = z.object({
  id: authoredId, version: z.number().int().positive(), format: z.enum(['workout', 'program']),
  title: z.string(), summary: z.string(), tags: libraryTagsSchema,
  sessionMinutes: z.object({ min: z.number().positive(), max: z.number().positive() }),
  supportedDays: z.array(z.number().int()), defaultWeeks: z.number().int().positive().optional(),
  fit: libraryFitSchema,
  /** A Program's fit was evaluated against this week's remaining capacity (the requested `weekStart`, else the current week). */
  programWeek: z.object({ weekStart: z.string(), capacity: z.number().int(), variantId: z.string().optional() }).optional(),
  appPath: z.string().regex(/^\/library\/[a-z0-9-]+$/)
})
const plannedSet = z.object({
  category: z.string(),
  plannedReps: z.object({ min: z.number(), max: z.number() }).optional(),
  plannedDuration: z.number().nonnegative().optional(), plannedDistance: z.number().nonnegative().optional(),
  rirTarget: z.number().nonnegative().optional(), plannedRpe: z.number().nonnegative().optional(),
  side: z.enum(['left', 'right', 'both']).optional()
})
const librarySession = z.object({
  sessionId: authoredId, name: z.string(), estimatedMinutes: z.number().positive(),
  slots: z.array(z.object({ ...slotExercise, prescription: z.object({ order: z.number(), section: z.enum(['warmup', 'main', 'cooldown']).optional(), sets: z.array(plannedSet) }) }))
})
/**
 * One visible block of a Program variant (app EF-1603): weeks `startWeek + 1`
 * to `startWeek + weeks`, repeating `[Week A]` or alternating `[Week A, Week B]`.
 * `label` is absent on a variant's only block. Optional and additive:
 * `sessions` stays the variant's first week, so a reader without blocks
 * still validates.
 */
export const libraryBlockSchema = z.object({
  id: authoredId, label: z.string().optional(),
  weeks: z.number().int().positive(), startWeek: z.number().int().nonnegative(),
  rotation: z.array(z.array(librarySession)).min(1)
})
export const libraryVariantSchema = z.object({ id: authoredId, daysPerWeek: z.number().int(), sessions: z.array(librarySession), blocks: z.array(libraryBlockSchema).optional() })
export const libraryItemDetailSchema = libraryItemSchema.extend({
  description: z.string(), suitability: z.string(), trainingSpace: librarySpaceSchema,
  content: z.discriminatedUnion('format', [
    z.object({ format: z.literal('workout'), session: librarySession }),
    z.object({ format: z.literal('program'), variants: z.array(libraryVariantSchema) })
  ]),
  exercises: z.array(z.object({ id: objectId, name: z.string(), modality: z.string(), equipmentRequired: z.array(z.string()) }))
})
export const libraryQuerySchema = z.object({
  q: z.string().optional(), format: z.enum(['workout', 'program']).optional(),
  purpose: z.string().optional(), focus: z.string().optional(), style: z.string().optional(), experience: z.string().optional(),
  maxMinutes: z.number().int().optional(), daysPerWeek: z.number().int().optional(), weekStart: z.string().optional(),
  fit: z.enum(['fits', 'exact', 'all']), page: z.number().int().positive(), limit: z.number().int().positive()
})
export const workoutLibraryViewSchema = z.object({
  view: z.literal('workout-library'),
  record: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('browse'), trainingSpace: librarySpaceSchema, query: libraryQuerySchema, data: z.array(libraryItemSchema), meta }),
    libraryItemDetailSchema.extend({ mode: z.literal('item') })
  ]),
  related: z.object({}),
  presentation
})
export type WorkoutLibraryView = z.infer<typeof workoutLibraryViewSchema>
export type LibraryBrowseRecord = Extract<WorkoutLibraryView['record'], { mode: 'browse' }>
export type LibraryItemRecord = Extract<WorkoutLibraryView['record'], { mode: 'item' }>
export type LibraryItem = z.infer<typeof libraryItemSchema>
export type LibraryFit = z.infer<typeof libraryFitSchema>
export type LibrarySession = z.infer<typeof librarySession>
export type LibraryBlock = z.infer<typeof libraryBlockSchema>

/**
 * Where the card's header link opens the application: `/library` (with the
 * browsed space when it is not the default) or the item's page. Neither app
 * page has a week parameter, so a browsed or evaluated `weekStart` stays out.
 */
export const workoutLibraryPath = (record: WorkoutLibraryView['record']): string => {
  const params = new URLSearchParams()
  if (!record.trainingSpace?.isDefault && record.trainingSpace) params.set('space', record.trainingSpace.id)
  if (record.mode === 'browse') {
    for (const key of ['format', 'focus', 'style', 'purpose', 'experience', 'q'] as const) {
      const value = record.query[key]
      if (value) params.set(key, value)
    }
  }
  const query = params.toString()
  return `${record.mode === 'browse' ? '/library' : record.appPath}${query ? `?${query}` : ''}`
}

/**
 * The navigation arguments that reopen this card, with `patch` applied. An
 * item keeps the week its Program fit was evaluated for, so a refresh or a
 * return reads the same capacity.
 */
export const workoutLibraryArguments = (record: WorkoutLibraryView['record'], patch: Record<string, unknown> = {}): Record<string, unknown> => {
  const space = record.trainingSpace.isDefault ? {} : { trainingSpaceId: record.trainingSpace.id }
  // the application refuses a week for a Workout, so only a Program keeps one
  if (record.mode === 'item') return { itemId: record.id, ...space, ...(record.format === 'program' && record.programWeek ? { weekStart: record.programWeek.weekStart } : {}), ...patch }
  const { fit, page, limit, ...facets } = record.query
  return { ...facets, fit, page, limit, ...space, ...patch }
}

/**
 * Opening one result: the item reads in the space the results were evaluated
 * for and, for a Program, the same week (the browsed `weekStart`, else the
 * week its fit names), so its fit does not change on the way in. A Workout
 * never takes a week: the application refuses one.
 */
export const workoutLibraryItemArguments = (record: LibraryBrowseRecord, item: LibraryItem): Record<string, unknown> => {
  // the application refuses a week for a Workout, so only a Program carries one
  const weekStart = item.format === 'program' ? record.query.weekStart ?? item.programWeek?.weekStart : undefined
  return { itemId: item.id, ...(record.trainingSpace.isDefault ? {} : { trainingSpaceId: record.trainingSpace.id }), ...(weekStart ? { weekStart } : {}) }
}

export type PlannedSet = z.infer<typeof plannedSet>
/**
 * One run of identical sets in a prescription: same category, rep range,
 * duration, distance and side. `side: 'each'` is a left group and a right
 * group that match in everything else, counted per side.
 */
export interface SetGroup {
  category: string
  count: number
  reps?: { min: number, max: number }
  seconds?: number
  side?: 'left' | 'right' | 'both' | 'each'
}
const outside = (category: string) => category === 'warmup' || category === 'cooldown'
const groupKey = (set: PlannedSet, side = set.side) =>
  JSON.stringify([set.category, set.plannedReps?.min, set.plannedReps?.max, set.plannedDuration, set.plannedDistance, side])

/**
 * A prescription's sets for the card's one-line summary, without changing
 * the authored workout: identical sets collapse into groups in first-seen
 * order, left and right groups that otherwise match read as "each side",
 * and warm-ups and cool-downs are counted apart. A prescription of only
 * warm-ups or cool-downs (a warm-up section) groups those sets instead.
 */
export const prescriptionSummary = (sets: PlannedSet[]): { groups: SetGroup[], warmup: number, cooldown: number } => {
  const main = sets.filter(set => !outside(set.category))
  const grouped = new Map<string, { set: PlannedSet, count: number }>()
  for (const set of main.length ? main : sets) {
    const key = groupKey(set)
    const entry = grouped.get(key)
    if (entry) entry.count += 1
    else grouped.set(key, { set, count: 1 })
  }
  const merged = new Set<string>()
  const groups: SetGroup[] = []
  for (const [key, { set, count }] of grouped) {
    if (merged.has(key)) continue
    let side: SetGroup['side'] = set.side
    if (set.side === 'left' || set.side === 'right') {
      const pairKey = groupKey(set, set.side === 'left' ? 'right' : 'left')
      if (grouped.get(pairKey)?.count === count) {
        merged.add(pairKey)
        side = 'each'
      }
    }
    groups.push({
      category: set.category, count,
      ...(set.plannedReps ? { reps: { min: set.plannedReps.min, max: set.plannedReps.max } } : {}),
      ...(set.plannedDuration !== undefined ? { seconds: set.plannedDuration } : {}),
      ...(side ? { side } : {})
    })
  }
  return {
    groups,
    warmup: main.length ? sets.filter(set => set.category === 'warmup').length : 0,
    cooldown: main.length ? sets.filter(set => set.category === 'cooldown').length : 0
  }
}
