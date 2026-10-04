// @vitest-environment happy-dom
import { Ajv } from 'ajv'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import fixtures from './compat-fixtures.json'
import schema from './workout-library-view.schema.json'
import WorkoutLibraryCard from '../apps/workout/WorkoutLibraryView.vue'
import { messages } from '../apps/workout/messages'
import type { WorkoutLibraryView } from '../apps/workout/workoutLibraryModel'

/**
 * Program blocks and alternating weeks (app EF-1603) and the specialty
 * styles (app EF-1606) in the workout Library card. `fixtures.workoutLibrary`
 * adds three `get_workout_library_item` payloads: the application's test
 * Program `test-blocked-program` (Base for weeks 1–4, Build for weeks 5–8,
 * each alternating Week A and Week B), a German Program whose only block
 * alternates and so carries no label, and Morning Yoga.
 */
const payloads = fixtures.workoutLibrary as unknown as Record<'itemBlockedProgram' | 'itemOneBlockProgram' | 'itemYoga' | 'itemProgramUnavailable' | 'browse', WorkoutLibraryView>
const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(schema)

let mounted: App | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  document.body.innerHTML = ''
})

const mount = async (view: WorkoutLibraryView, locale: 'en' | 'de' = 'en') => {
  const navigate = vi.fn(async () => undefined)
  const sendFollowUp = vi.fn(async () => 'accepted' as const)
  const root = document.createElement('div')
  document.body.append(root)
  mounted = createApp(WorkoutLibraryCard, { library: view, busy: false, navigate, sendFollowUp })
  mounted.use(createI18n({ legacy: false, locale, fallbackLocale: 'en', messages }))
  mounted.mount(root)
  await nextTick()
  return { root, navigate, sendFollowUp }
}
/** The element's text, each text node apart, as a reader hears it. */
const text = (element: Element): string => {
  const parts: string[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '')
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
const blockSection = (root: Element, heading: string) => {
  const section = [...root.querySelectorAll('section[aria-labelledby^="library-block-"]')].find(node => text(node.querySelector('h4')!) === heading)
  if (!section) throw new Error(`no block ${heading}`)
  return section
}
const sessionNames = (section: Element) => [...section.querySelectorAll('h5')].map(text)
const weekButtons = (section: Element) => [...section.querySelectorAll('[role="group"] button')] as HTMLButtonElement[]

describe('workout Library blocks schema', () => {
  it('admits a blocked Program, a one-block Program and a yoga Workout, and still admits a variant without blocks', () => {
    for (const name of ['itemBlockedProgram', 'itemOneBlockProgram', 'itemYoga', 'itemProgramUnavailable'] as const)
      expect(validate(payloads[name]), `${name} ${JSON.stringify(validate.errors)}`).toBe(true)
    const extra = structuredClone(payloads.itemBlockedProgram) as unknown as { record: { content: { variants: Array<{ blocks: Array<Record<string, unknown>> }> } } }
    extra.record.content.variants[0]!.blocks[0]!.futureField = 'kept'
    expect(validate(extra)).toBe(true)
  })

  it('keeps sessions required beside blocks and refuses a block without a week', () => {
    const noSessions = structuredClone(payloads.itemBlockedProgram) as unknown as { record: { content: { variants: Array<Record<string, unknown>> } } }
    delete noSessions.record.content.variants[0]!.sessions
    expect(validate(noSessions)).toBe(false)
    const empty = structuredClone(payloads.itemBlockedProgram) as unknown as { record: { content: { variants: Array<{ blocks: Array<{ rotation: unknown[] }> }> } } }
    empty.record.content.variants[0]!.blocks[0]!.rotation = []
    expect(validate(empty)).toBe(false)
  })
})

describe('workout Library blocks card', () => {
  it('heads each block with its weeks and label and explains the alternating weeks', async () => {
    const { root } = await mount(payloads.itemBlockedProgram)
    const headings = [...root.querySelectorAll('section[aria-labelledby^="library-block-"] h4')].map(text)
    expect(headings).toEqual(['Weeks 1–4 · Base', 'Weeks 5–8 · Build'])
    const base = blockSection(root, 'Weeks 1–4 · Base')
    expect(text(base)).toContain('Week A and Week B alternate, so the same day changes from one week to the next.')
    expect(base.querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Week shown for Weeks 1–4 · Base')
    expect(weekButtons(base).map(text)).toEqual(['Week A', 'Week B'])
    expect(weekButtons(base).map(button => button.getAttribute('aria-pressed'))).toEqual(['true', 'false'])
    expect(sessionNames(base)).toEqual(['Base · Day A: Lunge and Push-Up', 'Base · Day B: Side Lunge and Pike'])
    expect(sessionNames(blockSection(root, 'Weeks 5–8 · Build'))).toEqual(['Build · Day A: Lunge and Push-Up', 'Build · Day B: Side Lunge and Pike'])
    // the existing session rendering: Build adds a set to each exercise
    expect(text(blockSection(root, 'Weeks 5–8 · Build'))).toContain('Bodyweight Reverse Lunge 4 × 10–12 reps')
    expect(text(base)).toContain('Walking Knee Hugs 1 × 60 s')
  })

  it('switches one block to Week B in the card without calling the host', async () => {
    const { root, navigate, sendFollowUp } = await mount(payloads.itemBlockedProgram)
    const base = blockSection(root, 'Weeks 1–4 · Base')
    weekButtons(base)[1]!.click()
    await nextTick()
    expect(sessionNames(blockSection(root, 'Weeks 1–4 · Base'))).toEqual(['Base · Day C: Bridge and Hollow Hold', 'Base · Day D: Lunge and Pike'])
    expect(weekButtons(blockSection(root, 'Weeks 1–4 · Base')).map(button => button.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
    expect(text(blockSection(root, 'Weeks 1–4 · Base'))).toContain('Hollow Body Hold 3 × 30 s')
    // the other block keeps its own week
    expect(sessionNames(blockSection(root, 'Weeks 5–8 · Build'))).toEqual(['Build · Day A: Lunge and Push-Up', 'Build · Day B: Side Lunge and Pike'])
    weekButtons(blockSection(root, 'Weeks 1–4 · Base'))[0]!.click()
    await nextTick()
    expect(sessionNames(blockSection(root, 'Weeks 1–4 · Base'))).toEqual(['Base · Day A: Lunge and Push-Up', 'Base · Day B: Side Lunge and Pike'])
    expect(navigate).not.toHaveBeenCalled()
    expect(sendFollowUp).not.toHaveBeenCalled()
  })

  it('heads a variant\'s only block "Your weeks", in German too', async () => {
    const english = await mount(payloads.itemOneBlockProgram)
    expect([...english.root.querySelectorAll('section[aria-labelledby^="library-block-"] h4')].map(text)).toEqual(['Your weeks'])
    mounted!.unmount()
    mounted = undefined
    document.body.innerHTML = ''
    const { root } = await mount(payloads.itemOneBlockProgram, 'de')
    const only = blockSection(root, 'Deine Wochen')
    expect(text(only)).toContain('Woche A und Woche B wechseln sich ab, deshalb ändert sich derselbe Tag von einer Woche zur nächsten.')
    expect(only.querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Angezeigte Woche für Deine Wochen')
    expect(weekButtons(only).map(text)).toEqual(['Woche A', 'Woche B'])
    expect(sessionNames(only)).toEqual(['Basis · Tag A: Ausfallschritt und Liegestütz', 'Basis · Tag B: Seitlicher Ausfallschritt und Pike'])
    weekButtons(only)[1]!.click()
    await nextTick()
    expect(sessionNames(blockSection(root, 'Deine Wochen'))).toEqual(['Basis · Tag C: Brücke und Hollow Hold', 'Basis · Tag D: Ausfallschritt und Pike'])
  })

  it('shows a block that does not alternate without a switch', async () => {
    const repeating = structuredClone(payloads.itemBlockedProgram) as unknown as { record: { content: { variants: Array<{ blocks: Array<{ rotation: unknown[] }> }> } } }
    repeating.record.content.variants[0]!.blocks[1]!.rotation.splice(1)
    const { root } = await mount(repeating as unknown as WorkoutLibraryView)
    const build = blockSection(root, 'Weeks 5–8 · Build')
    expect(build.querySelector('[role="group"]')).toBeNull()
    expect(text(build)).not.toContain('alternate')
    expect(sessionNames(build)).toEqual(['Build · Day A: Lunge and Push-Up', 'Build · Day B: Side Lunge and Pike'])
  })

  it('renders a Program without blocks as before: its sessions under the day count, no weeks and no switch', async () => {
    const { root } = await mount(payloads.itemProgramUnavailable, 'de')
    expect(root.querySelector('section[aria-labelledby^="library-block-"]')).toBeNull()
    expect(root.querySelector('[role="group"]')).toBeNull()
    expect([...root.querySelectorAll('h3')].map(text)).toEqual(['2 Tage pro Woche', '3 Tage pro Woche'])
    expect([...root.querySelectorAll('h4')].map(text)[0]).toBe('Tag A: Kniebeuge, Bankdrücken und Rudern')
  })
})

describe('workout Library specialty styles', () => {
  const styled = (style: string) => {
    const view = structuredClone(payloads.itemYoga) as unknown as { record: { tags: { style: string[] } } }
    view.record.tags.style = [style]
    return view as unknown as WorkoutLibraryView
  }

  it('names yoga, Pilates and calisthenics in English and German', async () => {
    const expected = { en: { yoga: 'Yoga', pilates: 'Pilates', calisthenics: 'Calisthenics', focus: 'Full body' }, de: { yoga: 'Yoga', pilates: 'Pilates', calisthenics: 'Calisthenics', focus: 'Ganzkörper' } }
    for (const locale of ['en', 'de'] as const) {
      for (const style of ['yoga', 'pilates', 'calisthenics'] as const) {
        const { root } = await mount(styled(style), locale)
        expect(text(root)).toContain(`${expected[locale].focus}, ${expected[locale][style]}`)
        mounted!.unmount()
        mounted = undefined
        document.body.innerHTML = ''
      }
    }
  })

  it('shows Morning Yoga\'s focus and styles and its sided holds', async () => {
    const { root } = await mount(payloads.itemYoga)
    expect(text(root)).toContain('Full body, Yoga, Mobility')
    expect(text(root)).toContain('Low Lunge 1 × 30 s each side')
    expect(text(root)).toContain('Sun Salutation A 3 × 60 s')
    mounted!.unmount()
    mounted = undefined
    const german = await mount(payloads.itemYoga, 'de')
    expect(text(german.root)).toContain('Ganzkörper, Yoga und Mobilität')
  })

  it('shows each browse result\'s focus and style', async () => {
    const { root } = await mount(payloads.browse, 'de')
    const items = [...root.querySelectorAll('li')].map(text)
    expect(items[0]).toContain('Ganzkörper, Kraft')
    expect(items.find(item => item.includes('10 Minute Arms'))).toContain('Arme, Muskelaufbau')
  })
})
