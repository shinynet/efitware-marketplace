import { Ajv } from 'ajv'
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'
import fixtures from './compat-fixtures.json'
import coverage from './view-coverage.json'
import serverContract from './server-contract.json'
import WorkoutLibraryCard from '../apps/workout/WorkoutLibraryView.vue'
import en from '../apps/workout/workoutLibraryVocabulary.en.json'
import de from '../apps/workout/workoutLibraryVocabulary.de.json'
import { compactSummary } from '../apps/workout/compactSummary'
import { messages } from '../apps/workout/messages'
import { parseTrainingView } from '../apps/workout/templateModel'
import { prescriptionSummary, workoutLibraryArguments, workoutLibraryItemArguments, workoutLibraryPath, workoutLibraryViewSchema, type LibraryItemRecord, type WorkoutLibraryView } from '../apps/workout/workoutLibraryModel'
import { prescriptionLine } from '../apps/workout/workoutLibraryPresentation'

/**
 * The workout Library card (app EF-1607, format 8). `fixtures.workoutLibrary`
 * holds `open_workout_library` payloads exactly as the application emits
 * them: a browse page in a dumbbell-and-bench space (adaptable, exact and
 * equipment-unavailable items), a browse page in an unconfigured space, an
 * adaptable Workout with two named swaps in a dumbbell-only space, and a
 * German Program the space cannot run, and Short Conditioning's rowing
 * intervals (a warm-up, six 30-second efforts with five 60-second recoveries
 * between them, and a cool-down).
 */
const payloads = fixtures.workoutLibrary as unknown as Record<'browse' | 'browseNeedsSpace' | 'itemAdaptable' | 'itemProgramUnavailable' | 'itemShortConditioning', WorkoutLibraryView>
const schema = JSON.parse(readFileSync(new URL('./workout-library-view.schema.json', import.meta.url), 'utf8'))
const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(schema)
const noop = async () => 'accepted' as const

const render = async (view: WorkoutLibraryView, locale: 'en' | 'de' = 'en') => {
  const app = createSSRApp(WorkoutLibraryCard, { library: view, busy: false, navigate: async () => undefined, sendFollowUp: noop })
  app.use(createI18n({ legacy: false, locale, fallbackLocale: 'en', messages }))
  return (await renderToString(app)).replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}
const i18n = (locale: 'en' | 'de') => createI18n({ legacy: false, locale, fallbackLocale: 'en', messages }).global
const slotSets = (view: WorkoutLibraryView, slotId: string) => {
  const record = view.record as LibraryItemRecord
  if (record.content.format !== 'workout') throw new Error('fixture')
  return record.content.session.slots.find(slot => slot.slotId === slotId)!.prescription.sets
}
const line = (locale: 'en' | 'de', sets: ReturnType<typeof slotSets>) => {
  const { t, te } = i18n(locale)
  return prescriptionLine({ t: t as never, te, locale }, sets)
}

describe('workout Library schema', () => {
  it('admits every application payload, keeps it open and matches the generated draft-07 file', () => {
    for (const payload of Object.values(payloads)) expect(validate(payload), JSON.stringify(validate.errors)).toBe(true)
    const extra = structuredClone(payloads.itemAdaptable) as unknown as { record: Record<string, unknown> }
    extra.record.futureField = 'kept'
    expect(validate(extra)).toBe(true)
    expect(JSON.stringify(z.toJSONSchema(workoutLibraryViewSchema, { io: 'input', target: 'draft-07' }))).toBe(JSON.stringify(schema))
    expect(parseTrainingView(payloads.browse)).toMatchObject({ view: 'workout-library', record: { mode: 'browse' } })
  })

  it('refuses a payload without a fit or with an unknown fit state', () => {
    const missing = structuredClone(payloads.browse) as unknown as { record: { data: Array<Record<string, unknown>> } }
    delete missing.record.data[0]!.fit
    expect(validate(missing)).toBe(false)
    const unknown = structuredClone(payloads.itemAdaptable) as unknown as { record: { fit: Record<string, unknown> } }
    unknown.record.fit.state = 'maybe'
    expect(validate(unknown)).toBe(false)
  })

  it('admits the personal reason and cause the application sends while health sharing is withheld', () => {
    const withheld = structuredClone(payloads.itemAdaptable) as unknown as { record: { fit: { swaps: Array<{ cause: string }> } } }
    withheld.record.fit.swaps[0]!.cause = 'personal'
    expect(validate(withheld)).toBe(true)
  })

  it('registers the view, its display tool and the five tools in the coverage and server contract', () => {
    expect(coverage.views['workout-library']).toMatchObject({ displayTool: 'open_workout_library', schemaPath: 'contract/workout-library-view.schema.json' })
    for (const tool of ['search_workout_library', 'get_workout_library_item', 'preview_workout_library_item', 'open_workout_library', 'save_workout_library_workout']) {
      expect(serverContract.tools).toContain(tool)
      expect((coverage.tools as Record<string, { views: string[] }>)[tool]?.views).toContain('workout-library')
    }
    expect((coverage.tools as Record<string, { role: string }>).save_workout_library_workout!.role).toBe('action')
  })
})

describe('workout Library vocabulary', () => {
  it('matches the application strings the fixture pins', () => {
    for (const fixture of fixtures.workoutLibraryVocabulary) {
      const vocabulary = (fixture.locale === 'de' ? de : en) as Record<string, Record<string, string>>
      expect(vocabulary[fixture.path[0]!]![fixture.path[1]!]).toBe(fixture.text)
    }
  })
})

describe('workout Library card', () => {
  it('browses with fit badges, the space and paging', async () => {
    const text = await render(payloads.browse)
    expect(text).toContain('Workouts and programs')
    expect(text).toContain('your training space “Default”')
    expect(text).toContain('Quick Full Body')
    expect(text).toContain('Adaptable')
    expect(text).toContain('Exact fit')
    expect(text).toContain('Unavailable')
    expect(text).toContain('1 exercise is swapped')
    expect(text).toContain('This space is missing Lat pulldown')
    expect(text).toContain('Page 1 · 24 items')
  })

  it('says an unconfigured space needs setup instead of guessing', async () => {
    const text = await render(payloads.browseNeedsSpace)
    expect(text).toContain('No equipment is recorded for “Default” yet')
    expect(text).toContain('Needs setup')
  })

  it('names each swap, its missing equipment and the sessions on an item', async () => {
    const text = await render(payloads.itemAdaptable)
    expect(text).toContain('Strength for Runners')
    expect(text).toContain('Bulgarian Split Squat is swapped: this space has no Flat bench.')
    expect(text).toContain('Copenhagen Plank is swapped: this space has no Flat bench.')
    expect(text).toContain('Swapped here')
    expect(text).toContain('Who it suits')
    expect(text).toMatch(/3 × 6–8 reps/)
    expect(text).toContain('Ask my AI to prepare this')
  })

  it('reads a withheld reason without naming a limitation', async () => {
    const view = structuredClone(payloads.itemAdaptable)
    if (view.record.mode !== 'item' || view.record.fit.state !== 'adaptable') throw new Error('fixture')
    view.record.fit.swaps[0]!.cause = 'personal'
    const text = await render(view)
    expect(text).toContain('Bulgarian Split Squat is swapped for a personal reason.')
    expect(text).not.toContain('limitations')
  })

  it('renders a German Program the space cannot run, with no save request', async () => {
    const text = await render(payloads.itemProgramUnavailable, 'de')
    expect(text).toContain('Workout-Bibliothek · Programm')
    expect(text).toContain('Nicht verfügbar')
    expect(text).toContain('Hier fehlt Latzug')
    expect(text).toContain('Starte dieses Programm in der eFitware-App.')
    expect(text).not.toContain('Meine KI soll das vorbereiten')
  })
})

describe('prescription summaries', () => {
  const intervals = slotSets(payloads.itemShortConditioning, 'row-intervals')
  const copenhagen = slotSets(payloads.itemAdaptable, 'copenhagen-plank')

  it('keeps work and recovery apart and counts the warm-up and cool-down separately', () => {
    expect(intervals).toHaveLength(13)
    expect(prescriptionSummary(intervals)).toEqual({
      groups: [{ category: 'interval', count: 6, seconds: 30 }, { category: 'recovery', count: 5, seconds: 60 }],
      warmup: 1, cooldown: 1
    })
    expect(line('en', intervals)).toBe('6 × 30 s work · 5 × 60 s recovery + 1 warm-up + 1 cool-down')
    expect(line('de', intervals)).toBe('6 × 30 s Belastung · 5 × 60 s Erholung + 1 Aufwärmsatz + 1 Abwärmsatz')
  })

  it('reads alternating left and right holds as each side, and an unmatched side by name', () => {
    expect(prescriptionSummary(copenhagen)).toEqual({ groups: [{ category: 'working', count: 2, seconds: 20, side: 'each' }], warmup: 0, cooldown: 0 })
    expect(line('en', copenhagen)).toBe('2 × 20 s each side')
    expect(line('de', copenhagen)).toBe('2 × 20 s pro Seite')
    const lopsided = [...copenhagen, { category: 'working', plannedDuration: 20, side: 'left' as const }]
    expect(line('en', lopsided)).toBe('3 × 20 s left side · 2 × 20 s right side')
  })

  it('keeps the compact form for identical working sets and pluralizes the extras', () => {
    expect(line('en', slotSets(payloads.itemAdaptable, 'jump-squat'))).toBe('3 × 4–5 reps + 1 warm-up')
    expect(line('en', slotSets(payloads.itemAdaptable, 'split-squat'))).toBe('3 × 6–8 reps')
    expect(line('en', slotSets(payloads.itemAdaptable, 'leg-swings'))).toBe('1 × 30 s each side')
    const doubled = [{ category: 'warmup', plannedReps: { min: 5, max: 5 } }, { category: 'warmup', plannedReps: { min: 3, max: 3 } }, { category: 'working', plannedReps: { min: 5, max: 5 } }, { category: 'cooldown', plannedDuration: 60 }, { category: 'cooldown', plannedDuration: 60 }]
    expect(line('en', doubled)).toBe('1 × 5 reps + 2 warm-ups + 2 cool-downs')
    expect(line('de', doubled)).toBe('1 × 5 Wdh. + 2 Aufwärmsätze + 2 Abwärmsätze')
  })

  it('renders the interval and sided-hold items as written', async () => {
    const conditioning = await render(payloads.itemShortConditioning)
    expect(conditioning).toContain('Rowing Erg 6 × 30 s work · 5 × 60 s recovery + 1 warm-up + 1 cool-down')
    expect(conditioning).not.toContain('11 × 60 s')
    expect(conditioning).not.toContain('warm-ups')
    const runners = await render(payloads.itemAdaptable)
    expect(runners).toContain('Copenhagen Plank Swapped here 2 × 20 s each side')
    expect(runners).toContain('Leg Swings 1 × 30 s each side')
    expect(runners).not.toContain('4 × 20 s')
    const german = await render(payloads.itemShortConditioning, 'de')
    expect(german).toContain('6 × 30 s Belastung · 5 × 60 s Erholung + 1 Aufwärmsatz + 1 Abwärmsatz')
  })
})

describe('compact card and links', () => {
  it('opens /library with a non-default space and the facets in force, and /library/<id> for an item', () => {
    expect(workoutLibraryPath(payloads.browse.record)).toBe('/library')
    const elsewhere = structuredClone(payloads.browse)
    if (elsewhere.record.mode !== 'browse') throw new Error('fixture')
    elsewhere.record.trainingSpace.isDefault = false
    elsewhere.record.query.format = 'program'
    expect(workoutLibraryPath(elsewhere.record)).toBe(`/library?space=${elsewhere.record.trainingSpace.id}&format=program`)
    expect(workoutLibraryPath(payloads.itemAdaptable.record)).toBe('/library/strength-for-runners')
    expect(workoutLibraryArguments(payloads.itemAdaptable.record)).toEqual({ itemId: 'strength-for-runners' })
    expect(workoutLibraryArguments(elsewhere.record, { page: 2 })).toMatchObject({ format: 'program', page: 2, trainingSpaceId: elsewhere.record.trainingSpace.id })
  })

  it('carries the evaluated Program week into the item, its refresh and back, but not into app links', () => {
    expect(workoutLibraryArguments(payloads.itemProgramUnavailable.record)).toEqual({ itemId: 'beginner-strength-program', weekStart: '2026-10-05' })
    expect(workoutLibraryArguments(payloads.itemProgramUnavailable.record, { weekStart: '2026-11-09' })).toMatchObject({ weekStart: '2026-11-09' })
    expect(workoutLibraryPath(payloads.itemProgramUnavailable.record)).toBe('/library/beginner-strength-program')
    const week = structuredClone(payloads.browse)
    if (week.record.mode !== 'browse') throw new Error('fixture')
    week.record.query.weekStart = '2026-11-02'
    const [workout, , program] = week.record.data
    expect(workoutLibraryItemArguments(week.record, program!)).toEqual({ itemId: 'beginner-strength-program', weekStart: '2026-11-02' })
    expect(workoutLibraryItemArguments(week.record, workout!)).toEqual({ itemId: 'quick-full-body', weekStart: '2026-11-02' })
    expect(workoutLibraryArguments(week.record)).toMatchObject({ weekStart: '2026-11-02' })
    expect(workoutLibraryPath(week.record)).toBe('/library')
    // without a browsed week, a Program opens in the week its fit was evaluated for
    expect(workoutLibraryItemArguments(payloads.browse.record as never, program!)).toEqual({ itemId: 'beginner-strength-program', weekStart: '2026-10-05' })
    expect(workoutLibraryItemArguments(payloads.browse.record as never, workout!)).toEqual({ itemId: 'quick-full-body' })
  })

  it.each(['en', 'de'] as const)('summarizes browse and item views in %s', (locale) => {
    const { t, te } = i18n(locale)
    const options = { locale, system: 'metric' as const, t: t as never, te }
    const browse = compactSummary(payloads.browse, options)
    expect(browse.facts).toHaveLength(3)
    expect(browse.path).toBe('/library')
    const item = compactSummary(payloads.itemAdaptable, options)
    expect(item.title).toBe('Strength for Runners')
    expect(item.facts.map(fact => fact.value)).toContain(locale === 'de' ? 'Anpassbar' : 'Adaptable')
    expect(item.detail?.value).toMatch(/Bulgarian Split Squat/)
    expect(item.path).toBe('/library/strength-for-runners')
  })
})
