import { Ajv } from 'ajv'
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { createSSRApp, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'
import ProgressView from '../apps/workout/ProgressView.vue'
import ExerciseProgressView from '../apps/workout/ExerciseProgressView.vue'
import { progressViewSchema, unlockProgressDays } from '../apps/workout/progressModel'
import { exerciseProgressViewSchema } from '../apps/workout/focusedProgressModel'
import { messages } from '../apps/workout/messages'

const id = 'b'.repeat(24)
const presentation = { locale: 'en', unitSystem: 'metric', theme: null, skin: null, timeZone: 'UTC' }
const sevenDays = [1, 2, 3, 4, 5, 6, 7].map(day => `2026-09-0${day}`)
/** Seven high-rep session days: none holds a set of 12 reps or fewer (EF-1466). */
const row = (patch: Record<string, unknown> = {}) => ({ id, name: 'Goblet squat', modality: 'resistance', bestSetReps: 15, bestSetWeightKg: 20, sessionDates: sevenDays, series: [], unlocked: false, ...patch })
const meta = { total: 1, page: 1, limit: 10 }
const progress = (entry: Record<string, unknown>) => ({
  view: 'progress',
  record: {
    asOf: '2026-09-07', rangeStart: '2026-08-11', range: '4w', unlockSessions: 6, progressionCount: 1, metrics: [], weeklyVolume: [],
    consistency: { heatmap: [], sessionsDone: 7, sessionsPlanned: 7, streakWeeks: 1 }, balance: { muscles: [], movements: [] },
    body: { weightKg: null, goalWeightKg: null, bodyFatPercent: null, weightSeries: [], bodyFatSeries: [], measurements: [] },
    cardio: { restingHr: null, restingHrSeries: [], zone2Minutes: 0, bestEfforts: [] }, modalitySplit: [], recentPrs: [],
    metadata: { today: '2026-09-07', timezone: 'UTC', readAt: '2026-09-07T12:00:00.000Z', readConsistency: 'snapshot' }
  },
  related: { section: 'strength', progression: { data: [entry], meta }, goals: { data: [], meta: { total: 0, page: 1, limit: 10 } } },
  presentation
})
const exerciseProgress = (entry: Record<string, unknown>) => ({
  view: 'exercise-progress', record: { id, name: 'Goblet squat', modality: 'resistance' },
  related: {
    stats: { sessions: 7, prCount: 0, unlockAt: 6 },
    progression: { data: [entry], meta, metadata: { range: '4w', rangeStart: '2026-08-11', today: '2026-09-07', timezone: 'UTC', readAt: '2026-09-07T12:00:00.000Z' } },
    history: [], records: [], collection: 'history', page: 1, limit: 10
  },
  presentation
})

const render = async (component: Component, props: Record<string, unknown>, locale: 'en' | 'de' = 'en') => {
  const app = createSSRApp(component, { disabled: false, navigate: () => undefined, followUp: async () => 'accepted', ...props })
  app.use(createI18n({ legacy: false, locale, fallbackLocale: 'en', messages }))
  return (await renderToString(app)).replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}
const views = [
  ['ProgressView', (entry: Record<string, unknown>) => render(ProgressView, { progress: progressViewSchema.parse(progress(entry)) })],
  ['ExerciseProgressView', (entry: Record<string, unknown>) => render(ExerciseProgressView, { exercise: exerciseProgressViewSchema.parse(exerciseProgress(entry)) })]
] as const

describe('estimate unlock counts eligible progression days (EF-1483)', () => {
  it('keeps eligibleProgressionDays through both schemas and admits only a non-negative integer', () => {
    expect(progressViewSchema.parse(progress(row({ eligibleProgressionDays: 0 }))).related.progression.data[0]!.eligibleProgressionDays).toBe(0)
    expect(exerciseProgressViewSchema.parse(exerciseProgress(row({ eligibleProgressionDays: 3 }))).related.progression.data[0]!.eligibleProgressionDays).toBe(3)
    expect(progressViewSchema.parse(progress(row())).related.progression.data[0]).not.toHaveProperty('eligibleProgressionDays')
    for (const [name, schema, wrap] of [['progress', progressViewSchema, progress], ['exercise-progress', exerciseProgressViewSchema, exerciseProgress]] as const) {
      const validate = new Ajv({ removeAdditional: false, coerceTypes: false, useDefaults: false }).compile(z.toJSONSchema(schema, { io: 'input', target: 'draft-07' }))
      for (const value of [0, 6]) expect(validate(wrap(row({ eligibleProgressionDays: value }))), `${name} ${value}`).toBe(true)
      expect(validate(wrap(row())), name).toBe(true)
      for (const value of [-1, 1.5, '2', null]) expect(validate(wrap(row({ eligibleProgressionDays: value }))), `${name} ${String(value)}`).toBe(false)
    }
  })

  it('falls back to the session-day count when the application omits the field', () => {
    expect(unlockProgressDays({ sessionDates: sevenDays, eligibleProgressionDays: 0 })).toBe(0)
    expect(unlockProgressDays({ sessionDates: sevenDays })).toBe(7)
  })

  for (const [name, show] of views) {
    it(`${name}: a locked high-rep card shows 0/6, not 7/6`, async () => {
      const text = await show(row({ eligibleProgressionDays: 0 }))
      expect(text).toContain('0 of 6 days with a set of 12 reps or fewer recorded.')
      expect(text).not.toContain('7 of 6')
    })

    it(`${name}: without the field the locked card is unchanged`, async () => {
      const text = await show(row())
      expect(text).toContain('7 of 6 training days recorded. More sessions are needed for this chart.')
      expect(text).not.toContain('12 reps or fewer recorded')
    })

    it(`${name}: an unlocked card shows its chart and no locked count`, async () => {
      const series = sevenDays.map((date, index) => ({ date, value: 30 + index }))
      const withField = await show(row({ bestSetReps: 8, series, unlocked: true, eligibleProgressionDays: 7 }))
      const without = await show(row({ bestSetReps: 8, series, unlocked: true }))
      expect(withField).toBe(without)
      expect(withField).toContain('Estimated one-rep maximum')
      expect(withField).not.toMatch(/of 6 (training )?days/)
    })
  }

  it('localizes the eligible-day count in German', async () => {
    const text = await render(ProgressView, { progress: progressViewSchema.parse(progress(row({ eligibleProgressionDays: 0 }))) }, 'de')
    expect(text).toContain('0 von 6 Tagen mit einem Satz von höchstens 12 Wiederholungen erfasst.')
  })
})
