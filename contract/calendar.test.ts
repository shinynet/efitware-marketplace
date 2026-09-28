import { readFileSync } from 'node:fs'
import { Ajv } from 'ajv'
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'
import fixtures from './compat-fixtures.json'
import CalendarView from '../apps/workout/CalendarView.vue'
import { calendarViewSchema, dayMarks, sessionMark, type CalendarView as CalendarViewData } from '../apps/workout/planningModel'
import { viewSchema } from '../apps/workout/model'
import { compactSummary } from '../apps/workout/compactSummary'
import { parseTrainingView } from '../apps/workout/templateModel'
import { messages } from '../apps/workout/messages'

const fixture = fixtures.getCalendarResponse
const presentation = { locale: 'en', unitSystem: 'metric', theme: null, skin: null, timeZone: 'UTC' }
/** open_calendar wraps the get_calendar response exactly like this (app `server/mcp/ui/planning.ts`). */
const wrap = (response: unknown, date = fixture.date) => ({ view: 'calendar', record: { from: fixture.from, to: fixture.to, date, ...(response as object) }, related: {}, presentation })
const projection = z.toJSONSchema(calendarViewSchema, { io: 'input', target: 'draft-07' })
const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(projection)
const buckets = ['completedSessionCount', 'inProgressSessionCount', 'plannedSessionCount', 'missedSessionCount', 'endedSessionCount'] as const

describe('calendar presentation contract (EF-1474)', () => {
  it('publishes the committed calendar projection', () => {
    expect(JSON.parse(readFileSync(new URL('./calendar-view.schema.json', import.meta.url), 'utf8'))).toEqual(projection)
  })

  it('accepts the representative get_calendar response in both consumer schemas without changing it', () => {
    const view = wrap(fixture.response)
    const before = structuredClone(view)
    expect(validate(view), JSON.stringify(validate.errors)).toBe(true)
    expect(calendarViewSchema.safeParse(view).success).toBe(true)
    expect(view).toEqual(before)
  })

  it('covers every required day and keeps the bucket invariant on each', () => {
    expect(Object.keys(fixture.dayRoles)).toEqual(fixture.response.days.map(day => day.date))
    expect(fixture.response.days.map(day => [day.date, day.status])).toEqual([
      ['2026-09-07', 'completed'], ['2026-09-08', 'missed'], ['2026-09-09', 'missed'], ['2026-09-10', 'ended'], ['2026-09-11', 'ended'], ['2026-09-12', 'planned']
    ])
    expect(fixture.response.days.map(day => day.summary.status)).toEqual(['completed', 'planned', 'completed', 'skipped', 'abandoned', 'planned'])
    for (const day of fixture.response.days) expect(buckets.reduce((sum, key) => sum + day[key], 0), day.date).toBe(day.sessionCount)
    const mixed = fixture.response.days.find(day => day.date === '2026-09-09')!
    expect([mixed.completedSessionCount, mixed.missedSessionCount]).toEqual([1, 1])
    expect(fixture.response.agenda.date).toBe(fixture.date)
    expect(fixture.response.agenda.items.map(item => [item.status, item.displayStatus])).toEqual([['completed', 'completed'], ['planned', 'missed']])
  })

  it('rejects the retired and incomplete shapes', () => {
    const day = fixture.response.days[0]!
    const withDay = (patch: Record<string, unknown>) => wrap({ ...fixture.response, days: [{ ...day, ...patch }] })
    expect(validate(withDay({ status: 'incomplete' }))).toBe(false)
    expect(validate(withDay({ status: 'skipped' }))).toBe(false)
    for (const key of buckets) {
      const partial: Record<string, unknown> = { ...day }
      delete partial[key]
      expect(validate(wrap({ ...fixture.response, days: [partial] })), key).toBe(false)
    }
    const item = fixture.response.agenda.items[0]!
    const withItem = (value: Record<string, unknown>) => wrap({ ...fixture.response, agenda: { ...fixture.response.agenda, items: [value] } })
    const withoutDisplay: Record<string, unknown> = { ...item }
    delete withoutDisplay.displayStatus
    expect(validate(withItem(withoutDisplay))).toBe(false)
    expect(validate(withItem({ ...item, displayStatus: 'ended' }))).toBe(false)
    expect(validate(withItem({ ...item, status: 'missed' }))).toBe(false)
    for (const status of ['in_progress', 'missed', 'planned', 'completed', 'ended', null]) expect(validate(withDay({ status })), String(status)).toBe(true)
  })

  it('leaves missed out of the canonical workout lifecycle', () => {
    const workout = { workout: { id: 'a'.repeat(24), title: 'Training', date: '2026-09-08', status: 'missed', revision: `workout:1:${'a'.repeat(64)}`, exercises: [] }, exercises: [], presentation: { locale: 'en', unitSystem: 'metric', theme: null, skin: null } }
    expect(viewSchema.safeParse(workout).success).toBe(false)
    expect(viewSchema.safeParse({ ...workout, workout: { ...workout.workout, status: 'planned' } }).success).toBe(true)
  })

  it('orders one mark per session: completed, in progress, planned, missed, ended', () => {
    const day = { date: '2026-09-09', status: 'in_progress' as const, sessionCount: 7, completedSessionCount: 1, inProgressSessionCount: 1, plannedSessionCount: 1, missedSessionCount: 2, endedSessionCount: 2 }
    expect(dayMarks(day)).toEqual(['completed', 'in_progress', 'planned', 'missed', 'missed', 'ended', 'ended'])
    expect(dayMarks(undefined)).toEqual([])
    expect(['completed', 'in_progress', 'planned', 'missed', 'skipped', 'abandoned'].map(status => sessionMark(status as never))).toEqual(['completed', 'in_progress', 'planned', 'missed', 'ended', 'ended'])
  })
})

const render = async (view: unknown, locale: 'en' | 'de' = 'en') => {
  const calendar = calendarViewSchema.parse(view) as CalendarViewData
  const app = createSSRApp(CalendarView, { calendar, disabled: false, navigate: () => undefined, create: () => undefined })
  app.use(createI18n({ legacy: false, locale, fallbackLocale: 'en', messages }))
  return renderToString(app)
}
/** The day button's marks, in document order, with their accessible names. */
const marksOn = (html: string, date: string) => {
  const cell = html.split(/<li[\s>]/).find(part => part.includes(`datetime="${date}" class="block font-semibold"`))
  if (!cell) throw new Error(`No cell for ${date}`)
  return [...cell.matchAll(/<span[^>]*data-mark="(\w+)"[^>]*>/g)].map(([tag, kind]) => ({ kind, role: /role="img"/.test(tag) ? 'img' : undefined, label: /aria-label="([^"]*)"/.exec(tag)?.[1] }))
}
/** Agenda rows: display status, visible label, notes and action buttons. */
const agendaRows = (html: string) => html.split('id="calendar-agenda-title"')[1]!.split(/<li[\s>]/).slice(1).map(row => ({
  displayStatus: /data-display-status="(\w+)"/.exec(row)?.[1],
  mark: /data-mark="(\w+)"[^>]*aria-hidden="true"/.exec(row)?.[1],
  text: row.slice(row.indexOf('>') + 1).replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  buttons: [...row.matchAll(/<button[^>]*class="([^"]*)"[^>]*>([^<]*)<\/button>/g)].map(([, cls, label]) => ({ primary: cls!.includes('primary'), label: label!.trim() }))
}))

describe('CalendarView rendering (EF-1474)', () => {
  it('renders the representative response with a distinct, labelled mark per session', async () => {
    const html = await render(wrap(fixture.response))
    const done = { kind: 'completed', role: 'img', label: 'Done' }
    const missed = { kind: 'missed', role: 'img', label: 'Missed' }
    const ended = { kind: 'ended', role: 'img', label: 'Ended (skipped or abandoned)' }
    expect(marksOn(html, '2026-09-07')).toEqual([done])
    expect(marksOn(html, '2026-09-08')).toEqual([missed])
    expect(marksOn(html, '2026-09-09')).toEqual([done, missed])
    expect(marksOn(html, '2026-09-10')).toEqual([ended])
    expect(marksOn(html, '2026-09-11')).toEqual([ended])
    expect(marksOn(html, '2026-09-12')).toEqual([{ kind: 'planned', role: 'img', label: 'Planned' }])
    expect(marksOn(html, '2026-09-13')).toEqual([])
    const rows = agendaRows(html)
    expect(rows.map(row => [row.displayStatus, row.mark])).toEqual([['completed', 'completed'], ['missed', 'missed']])
    expect(rows[0]!.text).toContain('Completed · 6:05')
    expect(rows[0]!.buttons).toEqual([{ primary: false, label: 'View workout' }])
    expect(rows[1]!.text).toContain('Missed — no saved workout')
    expect(rows[1]!.text).toContain('It is not moved to today.')
    expect(rows[1]!.buttons).toEqual([{ primary: false, label: 'Log past workout' }])
    expect(html).not.toContain('Create planned workout and open')
  })

  it('draws each mark with a shape that does not depend on colour', async () => {
    const html = await render(wrap({ days: [{ date: '2026-09-09', status: 'in_progress', sessionCount: 5, completedSessionCount: 1, inProgressSessionCount: 1, plannedSessionCount: 1, missedSessionCount: 1, endedSessionCount: 1 }], agenda: null }))
    const cell = html.split(/<li[\s>]/).find(part => part.includes('datetime="2026-09-09" class="block font-semibold"'))!
    const shapes = Object.fromEntries(cell.split('data-mark="').slice(1).map(part => [part.slice(0, part.indexOf('"')), {
      filled: /<circle[^>]*fill="currentColor"/.test(part.split('</svg>')[0]!),
      ring: /<circle[^>]*fill="none"/.test(part.split('</svg>')[0]!),
      half: /<path[^>]*d="M6 1\.75 A4\.25 4\.25 0 0 0 6 10\.25 Z"[^>]*fill="currentColor"/.test(part.split('</svg>')[0]!),
      line: /<line[^>]*x1="([\d.]+)"[^>]*y1="([\d.]+)"[^>]*x2="([\d.]+)"[^>]*y2="([\d.]+)"/.exec(part.split('</svg>')[0]!)?.slice(1).map(Number)
    }]))
    expect(Object.keys(shapes)).toEqual(['completed', 'in_progress', 'planned', 'missed', 'ended'])
    expect(shapes.completed).toEqual({ filled: true, ring: false, half: false, line: undefined })
    expect(shapes.in_progress).toEqual({ filled: false, ring: true, half: true, line: undefined })
    expect(shapes.in_progress).not.toEqual(shapes.completed)
    expect(shapes.planned).toEqual({ filled: false, ring: true, half: false, line: undefined })
    // No two marks share a shape: colour is never the only difference.
    expect(new Set(Object.values(shapes).map(shape => JSON.stringify({ ...shape, line: shape.line ? (shape.line[1] === shape.line[3] ? 'bar' : 'slash') : null }))).size).toBe(5)
    const [mx1, my1, mx2, my2] = shapes.missed!.line!
    expect(shapes.missed!.ring && mx1 !== mx2 && my1 !== my2).toBe(true)
    const [ex1, ey1, ex2, ey2] = shapes.ended!.line!
    expect(shapes.ended!.ring && ex1 !== ex2 && ey1 === ey2).toBe(true)
    expect(marksOn(html, '2026-09-09').map(mark => mark.label)).toEqual(['Done', 'In progress', 'Planned', 'Missed', 'Ended (skipped or abandoned)'])
  })

  it('renders every agenda state with its label and action', async () => {
    const at = (id: string, status: string, displayStatus: string, extra: Record<string, unknown> = {}) => ({ id, time: '2026-09-09T17:30:00.000Z', name: `Session ${id.slice(-1)}`, status, displayStatus, ...extra })
    const schedule = 'c'.repeat(24)
    const items = [
      at('w1', 'completed', 'completed'), at('w2', 'in_progress', 'in_progress'), at('w3', 'planned', 'planned'), at('w4', 'planned', 'missed'),
      at('w5', 'skipped', 'skipped'), at('w6', 'abandoned', 'abandoned'),
      at(`occ-${schedule}-a`, 'planned', 'planned', { scheduleId: schedule, time: '2026-09-09T00:00:00.000Z' }),
      at(`occ-${schedule}-b`, 'planned', 'missed', { scheduleId: schedule, time: '2026-09-09T00:00:00.000Z' })
    ]
    const html = await render(wrap({ days: [], agenda: { date: '2026-09-09', items } }))
    const rows = agendaRows(html)
    expect(rows.map(row => [row.displayStatus, row.mark])).toEqual([
      ['completed', 'completed'], ['in_progress', 'in_progress'], ['planned', 'planned'], ['missed', 'missed'],
      ['skipped', 'ended'], ['abandoned', 'ended'], ['planned', 'planned'], ['missed', 'missed']
    ])
    const labels = rows.map(row => row.text.replace(/^Session \w /, ''))
    expect(labels[0]).toMatch(/^Completed · 5:30/)
    expect(labels[1]).toMatch(/^In progress · 5:30/)
    expect(labels[2]).toMatch(/^Planned View workout$/)
    expect(labels[3]).toMatch(/^Missed Opens the workout on its original date .* Log past workout$/)
    expect(labels[4]).toMatch(/^Skipped · 5:30 PM View workout$/)
    expect(labels[5]).toMatch(/^Abandoned · 5:30 PM View workout$/)
    expect(labels[6]).toMatch(/^Scheduled — no saved workout yet This saves .* Create planned workout and open$/)
    expect(labels[7]).toMatch(/^Missed — no saved workout This saves the workout on its original date .* Log past workout$/)
    expect(rows.map(row => row.buttons)).toEqual([
      [{ primary: false, label: 'View workout' }], [{ primary: false, label: 'View workout' }], [{ primary: false, label: 'View workout' }], [{ primary: false, label: 'Log past workout' }],
      [{ primary: false, label: 'View workout' }], [{ primary: false, label: 'View workout' }], [{ primary: true, label: 'Create planned workout and open' }], [{ primary: false, label: 'Log past workout' }]
    ])
  })

  it('renders the German labels', async () => {
    const html = await render(wrap(fixture.response), 'de')
    expect(marksOn(html, '2026-09-09').map(mark => mark.label)).toEqual(['Erledigt', 'Verpasst'])
    expect(marksOn(html, '2026-09-10').map(mark => mark.label)).toEqual(['Beendet (übersprungen oder abgebrochen)'])
    expect(marksOn(html, '2026-09-12').map(mark => mark.label)).toEqual(['Geplant'])
    const rows = agendaRows(html)
    expect(rows[1]!.text).toContain('Verpasst — kein Training gespeichert')
    expect(rows[1]!.buttons).toEqual([{ primary: false, label: 'Vergangenes Training erfassen' }])
  })
})

describe('compact calendar card (EF-1474)', () => {
  const translator = (locale: 'en' | 'de') => {
    const lookup = (key: string) => key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages[locale])
    const t = (key: string, values: Record<string, string | number> = {}) => {
      const text = lookup(key)
      if (typeof text !== 'string') throw new Error(`Missing ${locale} message: ${key}`)
      return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`))
    }
    return { t, te: (key: string) => typeof lookup(key) === 'string' }
  }

  it('counts sessions without claiming every session was completed, and names a missed first item', () => {
    const summary = compactSummary(parseTrainingView(wrap(fixture.response)), { locale: 'en', system: 'metric', ...translator('en') })
    expect(summary.facts).toEqual([{ label: 'Sessions', value: '7' }, { label: 'Completed', value: '2' }, { label: 'Days trained', value: '2' }])
    expect(summary.detail).toEqual({ label: 'On this day', value: 'Lower body B · Completed' })
    const missedFirst = { ...fixture.response, agenda: { ...fixture.response.agenda, items: [...fixture.response.agenda.items].reverse() } }
    expect(compactSummary(parseTrainingView(wrap(missedFirst)), { locale: 'en', system: 'metric', ...translator('en') }).detail?.value).toBe('Evening mobility · Missed')
    expect(compactSummary(parseTrainingView(wrap(missedFirst)), { locale: 'de', system: 'metric', ...translator('de') }).detail?.value).toBe('Evening mobility · Verpasst')
    expect(JSON.stringify(messages)).not.toMatch(/all sessions (were )?complete/i)
  })
})
