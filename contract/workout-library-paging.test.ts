// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, shallowRef, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import fixtures from './compat-fixtures.json'
import WorkoutLibraryCard from '../apps/workout/WorkoutLibraryView.vue'
import { messages } from '../apps/workout/messages'
import type { WorkoutLibraryView } from '../apps/workout/workoutLibraryModel'

/**
 * Paging the workout Library card (EF-1634). "Previous page" and "Next page"
 * sit below a long list and replace the results in place, so once the new
 * page renders the card brings the top of its results into view in its own
 * document and moves focus to the results heading. A page change that does not land leaves
 * scroll and focus alone.
 */
const browse = fixtures.workoutLibrary.browseCovers as unknown as WorkoutLibraryView
const pageOf = (page: number): WorkoutLibraryView => {
  const view = structuredClone(browse)
  if (view.record.mode !== 'browse') throw new Error('fixture')
  view.record.query.page = page
  view.record.meta.page = page
  view.record.data = page === 1 ? view.record.data : [...view.record.data].reverse()
  return view
}

let mounted: App | undefined
let reducedMotion = false
const scrolled = vi.fn()
beforeEach(() => {
  reducedMotion = false
  scrolled.mockClear()
  Element.prototype.scrollIntoView = function (this: Element, options?: boolean | ScrollIntoViewOptions) { scrolled(this, options) }
  window.matchMedia = ((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' && reducedMotion, media: query })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  document.body.innerHTML = ''
})

/** Mounts the card the way WorkoutApp does: a page change replaces the `library` prop once the host answers. */
const mount = async (start: WorkoutLibraryView, land = true) => {
  const library = shallowRef(start)
  const navigate = vi.fn(async (target: { name: string, arguments: Record<string, unknown> }) => {
    if (land) library.value = pageOf(target.arguments.page as number)
  })
  const root = document.createElement('div')
  document.body.append(root)
  mounted = createApp(defineComponent(() => () => h(WorkoutLibraryCard, { library: library.value, busy: false, navigate, sendFollowUp: async () => 'accepted' as const })))
  mounted.use(createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages }))
  mounted.mount(root)
  await nextTick()
  return { root, navigate }
}
const button = (root: Element, name: string) => [...root.querySelectorAll('button')].find(node => node.textContent?.trim() === name)!
const settle = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}

describe('workout Library paging', () => {
  it('brings the results heading into view and focuses it after Next, with the new page rendered', async () => {
    const { root, navigate } = await mount(pageOf(1))
    button(root, 'Next page').focus()
    button(root, 'Next page').click()
    await settle()
    expect(navigate).toHaveBeenCalledWith({ name: 'open_workout_library', arguments: expect.objectContaining({ page: 2 }) }, true)
    const heading = root.querySelector('#workout-library-heading')!
    expect(scrolled).toHaveBeenCalledTimes(1)
    // the whole results top, eyebrow included, comes into view
    expect(scrolled).toHaveBeenCalledWith(heading.closest('section'), { block: 'start', behavior: 'smooth' })
    expect(document.activeElement).toBe(heading)
    expect(heading.getAttribute('tabindex')).toBe('-1')
    // the new page is what the heading now introduces
    expect(root.querySelector('li h2')!.textContent).toContain('10 Minute Arms')
  })

  it('does the same after Previous, without smooth scrolling under reduced motion', async () => {
    reducedMotion = true
    const { root } = await mount(pageOf(2))
    button(root, 'Previous page').click()
    await settle()
    const heading = root.querySelector('#workout-library-heading')!
    expect(scrolled).toHaveBeenCalledWith(heading.closest('section'), { block: 'start', behavior: 'auto' })
    expect(document.activeElement).toBe(heading)
    expect(root.querySelector('li h2')!.textContent).toContain('Quick Full Body')
  })

  it('leaves scroll and focus alone when the page change does not land', async () => {
    const { root } = await mount(pageOf(1), false)
    const next = button(root, 'Next page')
    next.focus()
    next.click()
    await settle()
    expect(scrolled).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(next)
  })
})
