// @vitest-environment happy-dom
import { Ajv } from 'ajv'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App, type Component } from 'vue'
import { createI18n } from 'vue-i18n'
import fixtures from './compat-fixtures.json'
import schema from './workout-library-view.schema.json'
import CompactCard from '../apps/workout/CompactCard.vue'
import WorkoutLibraryCard from '../apps/workout/WorkoutLibraryView.vue'
import { compactSummary } from '../apps/workout/compactSummary'
import { messages } from '../apps/workout/messages'
import { parseTrainingView } from '../apps/workout/templateModel'
import type { WorkoutLibraryView } from '../apps/workout/workoutLibraryModel'

/**
 * Library cover art (app EF-1609) in the workout Library card.
 * `fixtures.workoutLibrary.browseCovers` is the browse page as the application
 * emits it once covers are pinned: four items carry `cover.thumbnail` (a
 * 480 × 360 JPEG on the media origin with the manifest's alt text), and the
 * two Programs whose content moved past their art carry none.
 * `itemCover` is Short Conditioning with its cover. Every older fixture is
 * the same payload without one.
 */
type Name = 'browse' | 'browseCovers' | 'itemCover' | 'itemShortConditioning' | 'itemAdaptable' | 'itemProgramUnavailable'
const payloads = fixtures.workoutLibrary as unknown as Record<Name, WorkoutLibraryView>
const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(schema)

let mounted: App | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  document.body.innerHTML = ''
})
const i18n = (locale: 'en' | 'de' = 'en') => createI18n({ legacy: false, locale, fallbackLocale: 'en', messages })
const mountWith = async (component: Component, props: Record<string, unknown>) => {
  const root = document.createElement('div')
  document.body.append(root)
  mounted = createApp(component, props)
  mounted.use(i18n())
  mounted.mount(root)
  await nextTick()
  return root
}
const mount = (view: WorkoutLibraryView) => mountWith(WorkoutLibraryCard, { library: view, busy: false, navigate: vi.fn(async () => undefined), sendFollowUp: vi.fn(async () => 'accepted' as const) })
const boxes = (root: Element) => [...root.querySelectorAll('[data-library-cover]')]
const thumbnail = (view: WorkoutLibraryView, index = 0) => {
  const record = view.record
  const item = record.mode === 'browse' ? record.data[index]! : record
  return item.cover!.thumbnail
}

describe('workout Library cover schema', () => {
  it('admits payloads with and without a cover, and keeps the cover open', () => {
    for (const name of ['browse', 'browseCovers', 'itemCover', 'itemShortConditioning'] as const)
      expect(validate(payloads[name]), `${name} ${JSON.stringify(validate.errors)}`).toBe(true)
    const extra = structuredClone(payloads.itemCover) as unknown as { record: { cover: { thumbnail: Record<string, unknown>, hero?: unknown } } }
    extra.record.cover.hero = { url: 'https://media.efitware.com/x.jpg' }
    extra.record.cover.thumbnail.type = 'image/jpeg'
    expect(validate(extra)).toBe(true)
  })

  it('refuses a cover without a thumbnail, alt text or integer size', () => {
    const noThumbnail = structuredClone(payloads.itemCover) as unknown as { record: { cover: Record<string, unknown> } }
    delete noThumbnail.record.cover.thumbnail
    expect(validate(noThumbnail)).toBe(false)
    const noAlt = structuredClone(payloads.browseCovers) as unknown as { record: { data: Array<{ cover: { thumbnail: Record<string, unknown> } }> } }
    delete noAlt.record.data[0]!.cover.thumbnail.alt
    expect(validate(noAlt)).toBe(false)
    const fractional = structuredClone(payloads.itemCover) as unknown as { record: { cover: { thumbnail: { width: number } } } }
    fractional.record.cover.thumbnail.width = 480.5
    expect(validate(fractional)).toBe(false)
  })
})

describe('workout Library cover art', () => {
  it('heads each browse result with its lazy thumbnail, and a plain placeholder where there is none', async () => {
    const root = await mount(payloads.browseCovers)
    const results = [...root.querySelectorAll('li')]
    expect(results).toHaveLength(6)
    const covered = payloads.browseCovers.record.mode === 'browse' ? payloads.browseCovers.record.data.map(item => !!item.cover) : []
    expect(covered).toEqual([true, true, false, true, false, true])
    results.forEach((result, index) => {
      const box = result.querySelector('[data-library-cover]')!
      // the cover comes first in the result
      expect(result.firstElementChild).toBe(box)
      const image = box.querySelector('img')
      if (!covered[index]) {
        expect(image).toBeNull()
        expect(box.getAttribute('aria-hidden')).toBe('true')
        return
      }
      const expected = thumbnail(payloads.browseCovers, index)
      expect(image!.getAttribute('src')).toBe(expected.url)
      expect(image!.getAttribute('alt')).toBe(expected.alt)
      expect(image!.getAttribute('width')).toBe('480')
      expect(image!.getAttribute('height')).toBe('360')
      expect(image!.getAttribute('loading')).toBe('lazy')
      expect(box.hasAttribute('aria-hidden')).toBe(false)
    })
  })

  it('shows no image at all for a browse page without covers', async () => {
    const root = await mount(payloads.browse)
    expect(boxes(root)).toHaveLength(6)
    expect(root.querySelector('img')).toBeNull()
  })

  it('puts the cover at the top of the item view, loaded at once', async () => {
    const root = await mount(payloads.itemCover)
    const article = root.querySelector('article')!
    const image = article.querySelector('img')!
    expect(image.compareDocumentPosition(article.querySelector('h1')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(image.getAttribute('src')).toBe('https://media.efitware.com/library-covers/short-conditioning/v2/thumbnail-480.jpg')
    expect(image.getAttribute('alt')).toBe('A woman seated at the catch of a rowing stroke with her arms extended.')
    expect([image.getAttribute('width'), image.getAttribute('height')]).toEqual(['480', '360'])
    expect(image.getAttribute('loading')).toBe('eager')
  })

  it('shows the placeholder on an item without a cover', async () => {
    const root = await mount(payloads.itemShortConditioning)
    expect(boxes(root)).toHaveLength(1)
    expect(root.querySelector('img')).toBeNull()
  })

  it('replaces an image that fails to load with the placeholder, never a broken image', async () => {
    const root = await mount(payloads.browseCovers)
    const [first, second] = [...root.querySelectorAll('[data-library-cover] img')]
    first!.dispatchEvent(new Event('error'))
    await nextTick()
    const box = root.querySelector('li [data-library-cover]')!
    expect(box.querySelector('img')).toBeNull()
    expect(box.getAttribute('aria-hidden')).toBe('true')
    // the other results keep their art
    expect(root.querySelectorAll('[data-library-cover] img')).toHaveLength(3)
    expect(root.contains(second!)).toBe(true)
  })
})

describe('workout Library compact cover', () => {
  const summary = (view: WorkoutLibraryView) => {
    const { t, te } = i18n().global
    return compactSummary(parseTrainingView(view), { locale: 'en', system: 'metric', t: t as never, te })
  }

  it('carries the item cover and nothing for results or an item without art', () => {
    expect(summary(payloads.itemCover).cover).toEqual(payloads.itemCover.record.mode === 'item' ? payloads.itemCover.record.cover : undefined)
    expect(summary(payloads.itemShortConditioning).cover).toBeUndefined()
    expect(summary(payloads.browseCovers).cover).toBeUndefined()
  })

  it('draws a small thumbnail beside the title, and no box when there is no art', async () => {
    let root = await mountWith(CompactCard, { summary: summary(payloads.itemCover) })
    const image = root.querySelector('[data-library-cover] img')!
    expect(image.getAttribute('alt')).toBe(thumbnail(payloads.itemCover).alt)
    expect(image.closest('[data-library-cover]')!.parentElement!.querySelector('h1')!.textContent).toContain('Short Conditioning')
    mounted!.unmount()
    root = await mountWith(CompactCard, { summary: summary(payloads.itemShortConditioning) })
    expect(boxes(root)).toHaveLength(0)
  })
})
