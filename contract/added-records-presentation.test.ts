// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, createSSRApp, nextTick, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'
import fixtures from './compat-fixtures.json'
import { messages } from '../apps/workout/messages'
import { exerciseProgressViewSchema } from '../apps/workout/focusedProgressModel'
import { progressViewSchema } from '../apps/workout/progressModel'
import { viewSchema } from '../apps/workout/model'
import { compactSummary } from '../apps/workout/compactSummary'
import ExerciseProgressView from '../apps/workout/ExerciseProgressView.vue'
import ProgressView from '../apps/workout/ProgressView.vue'
import WorkoutSetRow from '../apps/workout/WorkoutSetRow.vue'

const clone = <T>(value: T): T => structuredClone(value)
const render = async (component: Component, props: Record<string, unknown>, locale: 'en' | 'de' = 'en') => {
  const app = createSSRApp(component, { disabled: false, navigate: () => undefined, followUp: async () => 'accepted', ...props })
  app.use(createI18n({ legacy: false, locale, fallbackLocale: 'en', messages }))
  return renderToString(app)
}
const text = (html: string) => html.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const translator = (locale: 'en' | 'de') => createI18n({ legacy: false, locale, fallbackLocale: 'en', messages }).global.t
const row = (unit: 'kg' | 'lb', value: number) => {
  const base = fixtures.measurementContract.openExerciseProgress.related.progression.data[0]!
  return { ...clone(base), loadShape: 'added', bestSetWeight: { value, unit }, bestSetReps: 8, unlocked: true, series: [{ date: '2026-10-01', value: { value: 999, unit } }], repRecords: [{ date: '2026-09-24', reps: 12, weight: { value: 0, unit } }, { date: '2026-10-01', reps: 8, weight: { value, unit } }] }
}
const focused = (unit: 'kg' | 'lb', value: number) => {
  const base = clone(fixtures.measurementContract.openExerciseProgress)
  const weight = { value, unit }
  return exerciseProgressViewSchema.parse({ ...base,
    record: { ...base.record, name: 'Pull-Up', addedLoadOptions: ['weight_vest'] },
    related: { ...base.related,
      stats: { ...base.related.stats, loadShape: 'added', topSet: { date: '2026-10-01', reps: 8, weight }, repRecords: row(unit, value).repRecords },
      progression: { ...base.related.progression, data: [row(unit, value)] },
      records: [{ ...base.related.records[0], loadShape: 'added', date: '2026-10-01', reps: 8, weight, estimatedOneRm: { value: 999, unit }, prs: [{ type: 'weight', reps: 8, weight }, { type: 'reps', reps: 8, weight }, { type: 'oneRm', reps: 8, weight }] }], collection: 'records'
    }
  })
}
const broad = (unit: 'kg' | 'lb', value: number, section: 'overview' | 'strength' = 'strength') => {
  const base = clone(fixtures.measurementContract.openProgress)
  const source = base.record.recentPrs[0]!
  return progressViewSchema.parse({ ...base,
    record: { ...base.record, recentPrs: [
      { ...source, id: 'first-weight', setId: 'weight-source', type: 'weight', loadShape: 'added', exerciseName: 'Pull-Up', reps: 5, weight: { value: 25, unit } },
      { ...source, id: 'later-reps', setId: 'rep-source', type: 'reps', loadShape: 'added', exerciseName: 'Pull-Up', reps: 8, weight: { value, unit } },
      { ...source, id: 'stale-estimate', type: 'oneRm', loadShape: 'added', reps: 8, weight: { value, unit }, estimatedOneRm: { value: 999, unit } }
    ] },
    related: { ...base.related, section, progression: { ...base.related.progression, data: [row(unit, value)] } }
  })
}
afterEach(() => { document.body.innerHTML = '' })

describe('added-load record presentation (EF-1677)', () => {
  it.each([['en', 'lb', 10], ['de', 'kg', 5.25]] as const)('keeps dated rep records and both award types, as given in %s/%s', async (locale, unit, value) => {
    const exercise = focused(unit, value)
    const html = await render(ExerciseProgressView, { exercise }, locale)
    const visible = text(html)
    const t = translator(locale)
    const amount = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
    expect(visible).toContain(t('progressUi.heaviestAdded'))
    expect(visible).toContain(`+${amount} ${unit}`)
    expect(visible).toContain(t('progressUi.bodyWeightAt'))
    expect(visible).toContain(t('progressUi.repRecord'))
    expect(html).toContain('datetime="2026-09-24"')
    expect(html).toContain('datetime="2026-10-01"')
    expect(html.match(new RegExp(`>\\s*${t('viewWorkout')}\\s*</button>`, 'g'))).toHaveLength(1)
    expect(visible).not.toContain(t('progressUi.estimated'))
    expect(visible).not.toContain(t('progressUi.prType.oneRm'))
    expect(visible).not.toContain('999')
    expect(visible).not.toMatch(/of 6.*days|von 6.*Tagen/)
  })

  it('makes the initial compact view describe added load and suppresses a supplied estimate series', () => {
    const exercise = focused('lb', 10)
    const summary = compactSummary(exercise, { locale: 'en', system: 'metric', t: translator('en') })
    expect(summary.bars).toBeUndefined()
    expect(summary.facts).toContainEqual({ label: 'Heaviest added', value: '+10 lb' })
    expect(summary.facts.some(fact => /Top set|999/.test(fact.label + fact.value))).toBe(false)
  })

  it('does not manufacture a zero-load heaviest record for body-weight-only history', async () => {
    const exercise = focused('kg', 0)
    exercise.related.records = []
    exercise.related.stats.repRecords = [{ date: '2026-09-24', reps: 12, weight: { value: 0, unit: 'kg' } }]
    const visible = text(await render(ExerciseProgressView, { exercise }))
    expect(visible).toContain('12 reps at body weight')
    expect(visible).not.toContain('Heaviest added')
    expect(visible).not.toContain('0 kg')
    expect(compactSummary(exercise, { locale: 'en', system: 'metric', t: translator('en') }).facts.some(fact => fact.label === 'Heaviest added')).toBe(false)
  })

  it('uses published options for an older focused view whose stats and curve omit the optional load shape', async () => {
    const exercise = focused('lb', 10)
    delete exercise.related.stats.loadShape
    delete exercise.related.progression.data[0]!.loadShape
    const visible = text(await render(ExerciseProgressView, { exercise }))
    expect(visible).toContain('Heaviest added')
    expect(visible).not.toContain('Estimated one-rep maximum')
  })

  it.each([['en', 'lb', 10], ['de', 'kg', 5.25]] as const)('shows added strength facts without any estimate or unlock text in %s/%s', async (locale, unit, value) => {
    const visible = text(await render(ProgressView, { progress: broad(unit, value) }, locale))
    const t = translator(locale)
    expect(visible).toContain(t('progressUi.heaviestAdded'))
    expect(visible).toContain(t('progressUi.bodyWeightAt'))
    expect(visible).toContain(t('progressUi.repRecord'))
    expect(visible).not.toContain(t('progressUi.estimated'))
    expect(visible).not.toContain(t('progressUi.estimateNote'))
    expect(visible).not.toContain('999')
    expect(visible).not.toMatch(/of 6.*days|von 6.*Tagen/)
  })

  it('groups recent awards into one workout action without coalescing different source performances', async () => {
    const navigate = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const progress = broad('lb', 10, 'overview')
    const app = createApp(ProgressView, { progress, disabled: false, navigate, followUp: async () => 'accepted' })
    app.use(createI18n({ legacy: false, locale: 'en', messages }))
    app.mount(container)
    try {
      expect(container.textContent?.replace(/\s+/g, ' ')).toContain('Heaviest added +25 lb')
      expect(container.textContent).toContain('5 reps')
      expect(container.textContent).toContain('Rep record:')
      expect(container.textContent).toContain('8 reps')
      expect(container.textContent).toContain('+10 lb')
      expect(container.textContent).not.toContain('999')
      const actions = [...container.querySelectorAll('button')].filter(button => button.textContent?.trim() === 'View workout')
      expect(actions).toHaveLength(1)
      actions[0]!.click()
      await nextTick()
      expect(navigate).toHaveBeenCalledExactlyOnceWith({ name: 'open_workout', arguments: { workoutId: progress.record.recentPrs[0]!.workoutId } })
    } finally { app.unmount() }
  })

  it.each([['en', 'lb', 10], ['de', 'kg', 5.25]] as const)('shows completed set awards and an added-weight field despite tracksWeight=false in %s/%s', async (locale, unit, value) => {
    const raw = clone(fixtures.measurementContract.openWorkout.imperial)
    const view = viewSchema.parse({ ...raw,
      workout: { ...raw.workout, exercises: [{ ...raw.workout.exercises[0], sets: [{ id: 'added-set', category: 'working', completed: true, weight: { value, unit }, reps: 8, plannedReps: { min: 8, max: 8 }, prs: [{ type: 'weight', reps: 8, weight: { value, unit } }, { type: 'reps', reps: 8, weight: { value, unit } }, { type: 'oneRm', reps: 8, weight: { value, unit } }] }] }] },
      exercises: [{ ...raw.exercises[0], loadShape: 'added', tracksWeight: false }]
    })
    const html = await render(WorkoutSetRow, { set: view.workout.exercises[0]!.sets[0], number: 1, tracking: view.exercises[0], system: 'metric', save: () => undefined }, locale)
    const visible = text(html)
    expect(visible).toContain(translator(locale)('progressUi.heaviestAdded'))
    expect(visible).toContain(translator(locale)('progressUi.repRecord'))
    expect(visible).toContain(translator(locale)('progressUi.bodyWeight'))
    expect(html).toContain('inputmode="decimal"')
    expect(visible).not.toContain(translator(locale)('progressUi.prType.oneRm'))
  })
})
