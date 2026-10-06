// @vitest-environment happy-dom
import { Ajv } from 'ajv'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import fixtures from './compat-fixtures.json'
import schema from './workout-library-view.schema.json'
import WorkoutLibraryCard from '../apps/workout/WorkoutLibraryView.vue'
import { messages } from '../apps/workout/messages'
import type { LibraryItemRecord, WorkoutLibraryView } from '../apps/workout/workoutLibraryModel'
import { timedFormatLabel } from '../apps/workout/workoutLibraryPresentation'

const payloads = fixtures.workoutLibraryTimedFormats as unknown as Record<string, WorkoutLibraryView>
const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(schema)
let app: App | undefined
afterEach(() => { app?.unmount(); app = undefined; document.body.innerHTML = '' })
const mount = async (view: WorkoutLibraryView, locale: 'en' | 'de') => {
  const root = document.createElement('div')
  document.body.append(root)
  const navigate = vi.fn(async () => undefined)
  const sendFollowUp = vi.fn(async () => 'accepted' as const)
  app = createApp(WorkoutLibraryCard, { library: view, busy: false, navigate, sendFollowUp })
  app.use(createI18n({ legacy: false, locale, fallbackLocale: 'en', messages }))
  app.mount(root)
  await nextTick()
  return { root, navigate, sendFollowUp }
}
const sessionOf = (view: WorkoutLibraryView) => {
  const record = view.record as LibraryItemRecord
  if (record.content.format !== 'workout') throw new Error('Workout fixture required')
  return record.content.session
}

describe('Library timed format compatibility', () => {
  it('accepts all eight real MCP payloads without coercion and preserves additive group fields', () => {
    for (const [key, view] of Object.entries(payloads)) expect(validate(view), `${key}: ${JSON.stringify(validate.errors)}`).toBe(true)
    const view = structuredClone(payloads['dumbbell-amrap:en']!)
    Object.assign(sessionOf(view).executionGroups![0]!, { futureField: 'preserved' })
    expect(validate(view)).toBe(true)
  })
  it('accepts old payloads without groups and ordinary untimed groups', () => {
    const view = structuredClone(payloads['bodyweight-emom:en']!)
    delete sessionOf(view).executionGroups![0]!.format
    expect(validate(view)).toBe(true)
    delete sessionOf(view).executionGroups
    expect(validate(view)).toBe(true)
    expect(validate(fixtures.workoutLibrary.itemYoga)).toBe(true)
  })
  it.each([
    { type: 'amrap', capSeconds: 59 }, { type: 'amrap', capSeconds: 3601 },
    { type: 'emom', minutes: 1 }, { type: 'emom', minutes: 2.5 },
    { type: 'for-time' }, { type: 'tabata', rounds: 41, workSeconds: 20, restSeconds: 10 },
    { type: 'tabata', rounds: 8, workSeconds: 4, restSeconds: 10 },
    { type: 'tabata', rounds: 8, workSeconds: 20, restSeconds: -1 }
  ])('refuses an invalid clock: %j', (format) => {
    const view = structuredClone(payloads['bodyweight-emom:en']!)
    Object.assign(sessionOf(view).executionGroups![0]!, { format })
    expect(validate(view)).toBe(false)
  })
})

describe('Library timed format presentation', () => {
  it.each(['en', 'de'] as const)('renders every format and the two Tabata groups in %s without host actions', async (locale) => {
    const expected: Record<string, string[]> = {
      'dumbbell-amrap': [`AMRAP 15 ${locale === 'en' ? 'min' : 'Min.'}`],
      'bodyweight-emom': [`EMOM 8 ${locale === 'en' ? 'min' : 'Min.'}`],
      'bodyweight-tabata': ['Tabata 8 × 20 s / 10 s', 'Tabata 8 × 20 s / 10 s'],
      'dumbbell-strength-and-chipper': [locale === 'en' ? 'For time, 18 min cap' : 'Auf Zeit, Limit 18 Min.']
    }
    for (const [id, labels] of Object.entries(expected)) {
      const view = payloads[`${id}:${locale}`]!
      const { root, navigate, sendFollowUp } = await mount(view, locale)
      const list = root.querySelector(`ul[aria-label="${locale === 'en' ? 'Timed formats' : 'Zeitformate'}"]`)!
      expect([...list.children].map(node => node.textContent?.trim())).toEqual(labels)
      const styles = (view.record as LibraryItemRecord).tags.style
      if (styles.includes('functional')) expect(root.textContent).toContain(locale === 'en' ? 'Functional fitness' : 'Functional Fitness')
      if (styles.includes('hiit')) expect(root.textContent).toContain('HIIT')
      for (const slot of sessionOf(view).slots) expect(root.textContent).toContain(slot.name)
      expect(navigate).not.toHaveBeenCalled()
      expect(sendFollowUp).not.toHaveBeenCalled()
      app!.unmount(); app = undefined; document.body.innerHTML = ''
    }
  })
  it('renders no timed list for absent or untimed groups', async () => {
    const view = structuredClone(payloads['bodyweight-emom:en']!)
    delete sessionOf(view).executionGroups![0]!.format
    let mounted = await mount(view, 'en')
    expect(mounted.root.querySelector('ul[aria-label="Timed formats"]')).toBeNull()
    app!.unmount(); app = undefined; document.body.innerHTML = ''
    delete sessionOf(view).executionGroups
    mounted = await mount(view, 'en')
    expect(mounted.root.querySelector('ul[aria-label="Timed formats"]')).toBeNull()
  })
  it('uses a clock for a cap that includes seconds', () => {
    const i18n = createI18n({ legacy: false, locale: 'de', messages })
    expect(timedFormatLabel({ t: i18n.global.t, te: i18n.global.te, locale: 'de' }, { type: 'amrap', capSeconds: 90 })).toBe('AMRAP 1:30')
  })
})
