// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, createSSRApp, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'
import { messages } from '../apps/workout/messages'
import WorkoutSetRow from '../apps/workout/WorkoutSetRow.vue'
import type { ViewSet } from '../apps/workout/model'
import { viewSchema } from '../apps/workout/model'
import { compactSummary } from '../apps/workout/compactSummary'
import { parseTrainingView, templateViewSchema } from '../apps/workout/templateModel'
import TemplateView from '../apps/workout/TemplateView.vue'
import fixtures from './compat-fixtures.json'

const row = (unit: 'lb' | 'kg', value: number): ViewSet => ({
  id: 'cardio-interval', category: 'working', completed: false,
  plannedDuration: 600, plannedWeight: { value, unit }
})
const props = (set: ViewSet) => ({ set, number: 1, modality: 'cardio' as const,
  tracking: { id: 'outdoor-run', loadShape: 'added' as const, tracksTime: true, tracksWeight: false },
  system: 'imperial' as const, disabled: false, save: () => undefined })
const render = async (set: ViewSet, locale: 'en' | 'de' = 'en') => {
  const app = createSSRApp(WorkoutSetRow, props(set))
  app.use(createI18n({ legacy: false, locale, messages }))
  return renderToString(app)
}
const text = (html: string) => html.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
afterEach(() => { document.body.innerHTML = '' })

describe('cardio total added weight in the embedded workout (EF-1684)', () => {
  it.each([['en', 'lb', 20, 'Added (lb)', '+20 lb', 'Leave empty for none.'],
    ['de', 'kg', 9.25, 'Zusatz (kg)', '+9,25 kg', 'Leer lassen für kein Zusatzgewicht.']] as const)(
    'uses the cardio label, supplied load unit and no-load hint in %s/%s', async (locale, unit, value, label, load, hint) => {
      const html = await render(row(unit, value), locale)
      const visible = text(html)
      expect(visible).toContain(label)
      expect(visible).toContain(load)
      expect(visible).toContain(hint)
      expect(html).toContain(`aria-label="${locale === 'en' ? 'Set' : 'Satz'} 1 — ${label}"`)
      expect(visible).not.toMatch(/body weight|Körpergewicht/i)
    })

  it.each([undefined, 0])('keeps absent/zero cardio added targets quiet (%s)', async value => {
    const set = row('lb', 20)
    if (value === undefined) delete set.plannedWeight
    else set.plannedWeight = { value, unit: 'lb' }
    const visible = text(await render(set))
    expect(visible).toContain('10 min')
    expect(visible).not.toMatch(/body weight|\+0 lb|0 lb/i)
  })

  it('retains an older payload’s cardio measurement without requiring a tracking load shape', async () => {
    const set = row('lb', 20)
    const app = createSSRApp(WorkoutSetRow, { ...props(set), tracking: { id: 'outdoor-run', tracksTime: true } })
    app.use(createI18n({ legacy: false, locale: 'en', messages }))
    const visible = text(await renderToString(app))
    expect(visible).toContain('Added (lb)')
    expect(visible).toContain('+20 lb')
  })

  it.each([20, 0])('keeps the same extra-load meaning in compact and template prescriptions (%s lb)', async value => {
    const base = fixtures.measurementContract.openWorkout.imperial
    const exercise = { ...base.workout.exercises[0]!, modality: 'cardio', exerciseName: 'Outdoor Run', sets: [row('lb', value)] }
    const view = viewSchema.parse({ ...base, workout: { ...base.workout, exercises: [exercise] } })
    const i18n = createI18n({ legacy: false, locale: 'en', messages })
    const detail = compactSummary(parseTrainingView(view), { locale: 'en', system: 'imperial', t: i18n.global.t }).detail!.value
    const template = templateViewSchema.parse({ view: 'template', record: { id: 'a'.repeat(24), name: 'Vest run', revision: `template:1:${'a'.repeat(64)}`, exercises: [exercise] }, related: { exercises: [] }, presentation: base.presentation })
    const app = createSSRApp(TemplateView, { template, disabled: false, create: () => undefined, followUp: async () => 'accepted', navigate: async () => undefined, openApp: () => undefined })
    app.use(i18n)
    const visible = text(await renderToString(app))
    if (value > 0) {
      expect(detail).toContain('+20 lb')
      expect(visible).toContain('+20 lb')
    } else {
      expect(detail).not.toContain('0 lb')
      expect(visible).not.toContain('0 lb')
    }
    expect(detail + visible).not.toMatch(/body weight/i)
  })

  it('sends an explicit higher actual as a measurement and lets an empty edit clear it', async () => {
    const set = row('lb', 20)
    const save = vi.fn(async () => true)
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(WorkoutSetRow, { ...props(set), save })
    app.use(createI18n({ legacy: false, locale: 'en', messages }))
    app.mount(container)
    try {
      const input = container.querySelector<HTMLInputElement>('input[aria-label="Set 1 — Added (lb)"]')
      expect(input).not.toBeNull()
      input!.value = '40'
      input!.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()
      const done = [...container.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Done')!
      done.click()
      await vi.waitFor(() => expect(save).toHaveBeenCalledWith({ completed: true, weight: { value: 40, unit: 'lb' } }))
      input!.value = ''
      input!.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()
      done.click()
      await vi.waitFor(() => expect(save).toHaveBeenLastCalledWith({ completed: true, weight: null }))
    } finally { app.unmount() }
  })
})
