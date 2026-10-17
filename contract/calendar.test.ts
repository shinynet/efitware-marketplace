// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { Ajv } from 'ajv'
import { z } from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, createSSRApp, nextTick, type App } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'
import fixtures from './compat-fixtures.json'
import CalendarView from '../apps/workout/CalendarView.vue'
import { calendarViewSchema, dayMarks, dayProgramNames, sessionMark, type CalendarView as CalendarViewData } from '../apps/workout/planningModel'
import { viewSchema } from '../apps/workout/model'
import { compactSummary } from '../apps/workout/compactSummary'
import { parseTrainingView } from '../apps/workout/templateModel'
import { messages } from '../apps/workout/messages'
import WorkoutApp from '../apps/workout/WorkoutApp.vue'

const { bridge } = vi.hoisted(() => ({ bridge: {
  ontoolresult: undefined as undefined | ((result: { structuredContent?: unknown, isError?: boolean }) => void),
  connect: vi.fn(async () => {}), close: vi.fn(async () => {}),
  getHostCapabilities: vi.fn(() => ({ serverTools: {}, message: { text: {} } })),
  getHostContext: vi.fn(() => ({ locale: 'en', theme: 'light' })),
  callServerTool: vi.fn(), updateModelContext: vi.fn(async () => {}), sendMessage: vi.fn(), openLink: vi.fn(async () => ({}))
} }))
vi.mock('@modelcontextprotocol/ext-apps', () => ({ App: class { constructor() { return bridge } } }))

const fixture = fixtures.getCalendarResponse
const presentation = { locale: 'en', unitSystem: 'metric', theme: null, skin: null, timeZone: 'UTC' }
/** open_calendar wraps the get_calendar response exactly like this (app `server/mcp/ui/planning.ts`). */
const wrap = (response: unknown, date = fixture.date) => ({ view: 'calendar', record: { from: fixture.from, to: fixture.to, date, ...(response as object) }, related: {}, presentation })
const projection = z.toJSONSchema(calendarViewSchema, { io: 'input', target: 'draft-07' })
const validate = new Ajv({ removeAdditional: false, useDefaults: false, coerceTypes: false }).compile(projection)
/** The representative response with its goal days replaced, or removed when `undefined` (an application before EF-1889). */
const responseWith = (goalDays: unknown) => {
  const response: Record<string, unknown> = structuredClone(fixture.response)
  if (goalDays === undefined) delete response.goalDays
  else response.goalDays = goalDays
  return response as typeof fixture.response
}
const buckets = ['completedSessionCount', 'inProgressSessionCount', 'plannedSessionCount', 'missedSessionCount', 'endedSessionCount'] as const

describe('calendar presentation contract (EF-1474)', () => {
  it('publishes the committed calendar projection', () => {
    expect(JSON.parse(readFileSync('contract/calendar-view.schema.json', 'utf8'))).toEqual(projection)
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
      ['2026-09-07', 'completed'], ['2026-09-08', 'missed'], ['2026-09-09', 'missed'], ['2026-09-10', 'ended'], ['2026-09-11', 'ended'], ['2026-09-12', 'planned'],
      ['2026-09-13', 'planned'], ['2026-09-14', 'planned']
    ])
    expect(fixture.response.days.map(day => day.summary.status)).toEqual(['completed', 'planned', 'completed', 'skipped', 'abandoned', 'planned', 'planned', 'planned'])
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

describe('calendar day programs (EF-1587)', () => {
  type Summary = { programId?: string, programSessionCount?: number, programName?: string, programs?: Array<{ programId: string, programName?: string, sessionCount: number }> }
  const summaryOf = (date: string) => fixture.response.days.find(day => day.date === date)!.summary as Summary
  const withPrograms = (programs: unknown) => wrap({ ...fixture.response, days: [{ ...fixture.response.days[0]!, summary: { ...summaryOf('2026-09-13'), programs } }] })

  it('lists each program once on every program-backed day, summing to programSessionCount', () => {
    for (const day of fixture.response.days) {
      const summary = day.summary as Summary
      if (summary.programSessionCount === undefined) expect(summary.programs, day.date).toBeUndefined()
      else expect(summary.programs!.reduce((sum, program) => sum + program.sessionCount, 0), day.date).toBe(summary.programSessionCount)
    }
    expect(summaryOf('2026-09-13').programs!.map(program => program.programName)).toEqual(['Winter strength', 'Engine block'])
    // A manual session leads: the scalar programId speaks only for the primary, so only programs carries the id.
    expect(summaryOf('2026-09-14').programId).toBeUndefined()
    expect(summaryOf('2026-09-14').programs).toEqual([{ programId: '6a0000000000000000000001', programName: 'Winter strength', sessionCount: 1 }])
  })

  it('admits the program list and refuses an empty or malformed one', () => {
    expect(validate(withPrograms([{ programId: 'a'.repeat(24), sessionCount: 1 }])), JSON.stringify(validate.errors)).toBe(true)
    expect(validate(withPrograms([]))).toBe(false)
    expect(validate(withPrograms([{ programId: 'a'.repeat(24), programName: 'A', sessionCount: 0 }]))).toBe(false)
    expect(validate(withPrograms([{ programId: 'a'.repeat(24), programName: 'A', sessionCount: 1.5 }]))).toBe(false)
    expect(validate(withPrograms([{ programName: 'A', sessionCount: 1 }]))).toBe(false)
    expect(calendarViewSchema.safeParse(withPrograms([])).success).toBe(false)
    // Kept through the card's own parse, so the view can name every program.
    expect(calendarViewSchema.parse(wrap(fixture.response)).record.days.find(day => day.date === '2026-09-13')!.summary!.programs).toHaveLength(2)
  })

  it('names every program, skips an unresolved one and falls back to the scalar name', () => {
    expect(dayProgramNames(summaryOf('2026-09-13') as never)).toEqual(['Winter strength', 'Engine block'])
    expect(dayProgramNames(summaryOf('2026-09-14') as never)).toEqual(['Winter strength'])
    expect(dayProgramNames({ title: 'A', status: 'planned', programName: 'Winter strength', programs: [{ programId: 'a'.repeat(24), sessionCount: 1 }, { programId: 'b'.repeat(24), programName: 'Engine block', sessionCount: 1 }] })).toEqual(['Engine block'])
    // An application before EF-1575 sends only the scalar name.
    expect(dayProgramNames({ title: 'A', status: 'planned', programName: 'Winter strength' })).toEqual(['Winter strength'])
    expect(dayProgramNames({ title: 'A', status: 'planned' })).toEqual([])
    expect(dayProgramNames(undefined)).toEqual([])
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
/** The day button's program line, if any. */
const programsOn = (html: string, date: string) => {
  const cell = html.split(/<li[\s>]/).find(part => part.includes(`datetime="${date}" class="block font-semibold"`))
  if (!cell) throw new Error(`No cell for ${date}`)
  return /<span[^>]*data-programs[^>]*>([^<]*)<\/span>/.exec(cell)?.[1]
}
/** Agenda rows: display status, visible label, notes and action buttons. Goal rows are read by `goalRows`. */
const agendaRows = (html: string) => html.split('id="calendar-agenda-title"')[1]!.split(/<li[\s>]/).slice(1).filter(row => !row.includes('data-goal-day')).map(row => ({
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
    const planned = { kind: 'planned', role: 'img', label: 'Planned' }
    expect(marksOn(html, '2026-09-12')).toEqual([planned])
    expect(marksOn(html, '2026-09-13')).toEqual([planned, planned])
    expect(marksOn(html, '2026-09-14')).toEqual([planned, planned])
    expect(marksOn(html, '2026-09-15')).toEqual([])
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

  it('names every program a day draws on, and the scalar program without the list', async () => {
    const html = await render(wrap(fixture.response))
    expect(programsOn(html, '2026-09-13')).toBe('Programs: Winter strength · Engine block')
    expect(programsOn(html, '2026-09-14')).toBe('Program: Winter strength')
    expect(programsOn(html, '2026-09-08')).toBe('Program: Winter strength')
    expect(programsOn(html, '2026-09-07')).toBeUndefined()
    // An application before EF-1575 sends only the scalar fields.
    const scalarOnly = structuredClone(fixture.response)
    for (const day of scalarOnly.days) delete (day.summary as { programs?: unknown }).programs
    const legacy = await render(wrap(scalarOnly))
    expect(programsOn(legacy, '2026-09-13')).toBe('Program: Winter strength')
    expect(programsOn(legacy, '2026-09-07')).toBeUndefined()
    const de = await render(wrap(fixture.response), 'de')
    expect(programsOn(de, '2026-09-13')).toBe('Programme: Winter strength · Engine block')
    expect(programsOn(de, '2026-09-14')).toBe('Programm: Winter strength')
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

const compactTranslator = (locale: 'en' | 'de') => {
  const lookup = (key: string) => key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages[locale])
  const t = (key: string, values: Record<string, string | number> = {}) => {
    const text = lookup(key)
    if (typeof text !== 'string') throw new Error(`Missing ${locale} message: ${key}`)
    return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`))
  }
  return { t, te: (key: string) => typeof lookup(key) === 'string' }
}

describe('compact calendar card (EF-1474)', () => {
  const translator = compactTranslator

  it('counts sessions without claiming every session was completed, and names a missed first item', () => {
    const withoutGoals = responseWith(undefined)
    const summary = compactSummary(parseTrainingView(wrap(withoutGoals)), { locale: 'en', system: 'metric', ...translator('en') })
    expect(summary.facts).toEqual([{ label: 'Sessions', value: '11' }, { label: 'Completed', value: '2' }, { label: 'Days trained', value: '2' }])
    expect(summary.detail).toEqual({ label: 'On this day', value: 'Lower body B · Completed' })
    const missedFirst = { ...withoutGoals, agenda: { ...fixture.response.agenda, items: [...fixture.response.agenda.items].reverse() } }
    expect(compactSummary(parseTrainingView(wrap(missedFirst)), { locale: 'en', system: 'metric', ...translator('en') }).detail?.value).toBe('Evening mobility · Missed')
    expect(compactSummary(parseTrainingView(wrap(missedFirst)), { locale: 'de', system: 'metric', ...translator('de') }).detail?.value).toBe('Evening mobility · Verpasst')
    expect(JSON.stringify(messages)).not.toMatch(/all sessions (were )?complete/i)
  })
})

describe('calendar goal days (EF-1889)', () => {
  const [run] = fixture.response.goalDays
  const squat = { goalId: '6c0000000000000000000002', name: 'Squat 140 kg for a single at the spring regional powerlifting meet', date: '2026-09-09' }
  /** A date inside the range that has no entry in `days`: only its goal makes it worth a flag. */
  const bench = { goalId: '6c0000000000000000000003', name: 'Bench 100 kg', date: '2026-09-16' }
  const several = [run!, squat, bench]
  const noGoals = responseWith(undefined)
  const cellOf = (html: string, date: string) => {
    const cell = html.split(/<li[\s>]/).find(part => part.includes(`datetime="${date}" class="block font-semibold"`))
    if (!cell) throw new Error(`No cell for ${date}`)
    return cell
  }
  /** The day button's goal flags with their accessible names. */
  const flagsOn = (html: string, date: string) => [...cellOf(html, date).matchAll(/<span[^>]*data-goal-flag[^>]*>/g)].map(([tag]) => ({ role: /role="img"/.test(tag) ? 'img' : undefined, label: /aria-label="([^"]*)"/.exec(tag)?.[1] }))
  const countsOn = (html: string, date: string) => /<span class="mt-1 block text-sm text-muted">([^<]*)<\/span>/.exec(cellOf(html, date))?.[1]
  /** The selected day's goal rows: visible text and the goal link's visible and accessible names. */
  const goalRows = (html: string) => html.split('id="calendar-agenda-title"')[1]!.split(/<li[\s>]/).slice(1).filter(row => row.includes('data-goal-day')).map(row => ({
    text: row.slice(row.indexOf('>') + 1, row.indexOf('<button')).replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    button: /<button[^>]*aria-label="([^"]*)"[^>]*>([^<]*)/.exec(row)?.slice(1).map(text => text.trim())
  }))
  const selecting = (date: string, response = responseWith(several)) => wrap({ ...response, agenda: { date, items: [] } }, date)
  const empty = 'Nothing scheduled for this day.'

  it('admits absent, empty and populated goal days in both consumer schemas', () => {
    for (const goalDays of [undefined, [], fixture.response.goalDays, several]) {
      const view = wrap(responseWith(goalDays))
      expect(validate(view), JSON.stringify(validate.errors)).toBe(true)
      expect(calendarViewSchema.safeParse(view).success).toBe(true)
    }
    expect(fixture.response.goalDays).toEqual([{ goalId: '6c0000000000000000000001', name: 'Run 5 km under 25 minutes', date: fixture.date }])
  })

  it('refuses malformed goal days', () => {
    const malformed: unknown[] = [
      null, {}, 'goal', [null], [{ ...run, goalId: 'goal-1' }], [{ ...run, goalId: undefined }], [{ ...run, name: undefined }], [{ ...run, name: 7 }],
      [{ ...run, date: '2026-9-9' }], [{ ...run, date: '2026-09-09T00:00:00.000Z' }], [{ ...run, date: undefined }]
    ]
    for (const goalDays of malformed) {
      const view = wrap(responseWith(goalDays))
      expect(validate(view), JSON.stringify(goalDays)).toBe(false)
      expect(calendarViewSchema.safeParse(view).success, JSON.stringify(goalDays)).toBe(false)
    }
  })

  it('caps nothing: more than 50 goal days validate and survive the card parse', () => {
    const many = Array.from({ length: 60 }, (_, index) => ({ goalId: (index + 1).toString(16).padStart(24, '0'), name: `Goal ${index + 1}`, date: fixture.date }))
    const view = wrap(responseWith(many))
    expect(validate(view), JSON.stringify(validate.errors)).toBe(true)
    expect(calendarViewSchema.parse(view).record.goalDays).toEqual(many)
  })

  it('keeps goal days through the card parse and leaves the published schema open', () => {
    expect(calendarViewSchema.parse(wrap(responseWith(several))).record.goalDays).toEqual(several)
    const parsed = parseTrainingView(wrap(fixture.response))
    expect(parsed.view === 'calendar' && parsed.record.goalDays).toEqual(fixture.response.goalDays)
    const record: { required: string[], properties: Record<string, unknown> } = JSON.parse(readFileSync('contract/calendar-view.schema.json', 'utf8')).properties.record
    expect(Object.keys(record.properties)).toContain('goalDays')
    expect(record.required).not.toContain('goalDays')
    // Producer fields the card does not read still validate: the wire schema never closes an object.
    expect(validate(wrap({ ...responseWith([{ ...run, status: 'active' }]), futureField: true })), JSON.stringify(validate.errors)).toBe(true)
  })

  it('flags each goal date once, naming its goals, and leaves marks, counts and agenda unchanged', async () => {
    const html = await render(wrap(responseWith(several)))
    const before = await render(wrap(noGoals))
    expect(flagsOn(html, '2026-09-09')).toEqual([{ role: 'img', label: 'Goal target date on Wed, Sep 9, 2026: Run 5 km under 25 minutes and Squat 140 kg for a single at the spring regional powerlifting meet' }])
    expect(flagsOn(html, '2026-09-16')).toEqual([{ role: 'img', label: 'Goal target date on Wed, Sep 16, 2026: Bench 100 kg' }])
    for (const date of ['2026-09-07', '2026-09-08', '2026-09-10', '2026-09-14', '2026-09-15']) expect(flagsOn(html, date), date).toEqual([])
    for (let date = fixture.from; date <= fixture.to; date = new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) {
      expect(marksOn(html, date), date).toEqual(marksOn(before, date))
      expect(countsOn(html, date), date).toEqual(countsOn(before, date))
      expect(flagsOn(before, date), date).toEqual([])
    }
    // A goal-only date keeps an empty session line rather than inventing one.
    expect(marksOn(html, '2026-09-16')).toEqual([])
    expect(countsOn(html, '2026-09-16')).toBe('0 complete · 0 sessions')
    expect(agendaRows(html)).toEqual(agendaRows(before))
    // The flag is a pole and pennant, never a session mark's circle.
    const flag = cellOf(html, '2026-09-09').split('data-goal-flag')[1]!.split('</svg>')[0]!
    expect(flag).not.toContain('<circle')
    expect(flag).toContain('<path d="M4.25 2.25 L11.5 4.5 L4.25 6.75 Z" fill="currentColor"')
    expect(cellOf(html, '2026-09-09').split('data-goal-flag')[0]).toMatch(/class="[^"]*text-terracotta[^"]*"[^>]*$/)
  })

  it('lists only the selected day\'s goals, above its workouts', async () => {
    const html = await render(wrap(responseWith(several)))
    expect(goalRows(html)).toEqual([
      { text: 'Run 5 km under 25 minutes Target date', button: ['Open goal in eFitware: Run 5 km under 25 minutes', 'Open goal'] },
      { text: 'Squat 140 kg for a single at the spring regional powerlifting meet Target date', button: ['Open goal in eFitware: Squat 140 kg for a single at the spring regional powerlifting meet', 'Open goal'] }
    ])
    const agenda = html.split('id="calendar-agenda-title"')[1]!
    expect(agenda.indexOf('data-goal-day')).toBeLessThan(agenda.indexOf('Lower body B'))
    expect(agendaRows(html).map(row => row.displayStatus)).toEqual(['completed', 'missed'])
    expect(agenda).not.toContain(empty)
    const other = await render(selecting('2026-09-16'))
    expect(goalRows(other).map(row => row.text)).toEqual(['Bench 100 kg Target date'])
  })

  it('shows the empty-agenda message only when the day has neither goals nor workouts', async () => {
    const goalOnly = await render(selecting('2026-09-16'))
    expect(goalRows(goalOnly)).toHaveLength(1)
    expect(goalOnly).not.toContain(empty)
    expect(await render(selecting('2026-09-15'))).toContain(empty)
    expect(goalRows(await render(selecting('2026-09-15')))).toEqual([])
    expect(await render(selecting('2026-09-16', responseWith([])))).toContain(empty)
    expect(await render(selecting('2026-09-16', noGoals))).toContain(empty)
    expect(await render(wrap(fixture.response))).not.toContain(empty)
  })

  it('renders the German goal labels', async () => {
    const html = await render(wrap(responseWith(several)), 'de')
    expect(flagsOn(html, '2026-09-09')).toEqual([{ role: 'img', label: 'Zieldatum am Mi., 9. Sept. 2026: Run 5 km under 25 minutes und Squat 140 kg for a single at the spring regional powerlifting meet' }])
    expect(flagsOn(html, '2026-09-16')).toEqual([{ role: 'img', label: 'Zieldatum am Mi., 16. Sept. 2026: Bench 100 kg' }])
    expect(goalRows(html)[0]).toEqual({ text: 'Run 5 km under 25 minutes Zieldatum', button: ['Ziel öffnen in eFitware: Run 5 km under 25 minutes', 'Ziel öffnen'] })
  })

  it('leads the compact card with the selected day\'s goals and otherwise keeps the first workout', () => {
    const options = (locale: 'en' | 'de') => ({ locale, system: 'metric' as const, ...compactTranslator(locale) })
    const summary = (response: unknown, locale: 'en' | 'de' = 'en', date = fixture.date) => compactSummary(parseTrainingView(wrap(response, date)), options(locale))
    expect(summary(fixture.response).detail).toEqual({ label: 'Target date', value: 'Run 5 km under 25 minutes' })
    expect(summary(responseWith(several)).detail).toEqual({ label: 'Target date', value: 'Run 5 km under 25 minutes and Squat 140 kg for a single at the spring regional powerlifting meet' })
    expect(summary(responseWith(several), 'de').detail).toEqual({ label: 'Zieldatum', value: 'Run 5 km under 25 minutes und Squat 140 kg for a single at the spring regional powerlifting meet' })
    expect(summary(responseWith(several)).facts).toEqual(summary(noGoals).facts)
    expect(summary(responseWith([bench])).detail).toEqual({ label: 'On this day', value: 'Lower body B · Completed' })
    expect(summary(responseWith([])).detail).toEqual({ label: 'On this day', value: 'Lower body B · Completed' })
    expect(compactSummary(parseTrainingView(selecting('2026-09-16')), options('en')).detail).toEqual({ label: 'Target date', value: 'Bench 100 kg' })
  })

  describe('goal links', () => {
    let mounted: App | undefined
    afterEach(() => { mounted?.unmount(); mounted = undefined; document.body.innerHTML = ''; vi.clearAllMocks() })
    const settle = async () => { for (let index = 0; index < 5; index++) { await nextTick(); await new Promise(resolve => setTimeout(resolve, 0)) } }
    const buttonNamed = (name: string) => [...document.querySelectorAll('button')].find(button => (button.getAttribute('aria-label') ?? button.textContent!.trim()) === name)
    const dayButton = (date: string) => document.querySelector(`time[datetime="${date}"].block`)!.closest('button')!

    it('opens a goal through its own callback, outside the day button, and selects days with reads only', async () => {
      const navigate = vi.fn(), create = vi.fn(), openGoal = vi.fn()
      const root = document.body.appendChild(document.createElement('div'))
      mounted = createApp(CalendarView, { calendar: calendarViewSchema.parse(wrap(responseWith(several))), disabled: false, navigate, create, openGoal })
      mounted.use(createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages }))
      mounted.mount(root)
      const link = buttonNamed('Open goal in eFitware: Squat 140 kg for a single at the spring regional powerlifting meet')!
      expect(link.parentElement!.closest('button')).toBeNull()
      expect(dayButton('2026-09-09').querySelector('button')).toBeNull()
      link.click()
      expect(openGoal.mock.calls).toEqual([[squat.goalId]])
      dayButton('2026-09-16').click()
      expect(navigate.mock.calls).toEqual([[{ name: 'open_calendar', arguments: { from: fixture.from, to: fixture.to, date: '2026-09-16' } }, true]])
      expect(openGoal).toHaveBeenCalledTimes(1)
      expect(create).not.toHaveBeenCalled()
    })

    it('opens the goal page in eFitware through the host bridge without calling a tool', async () => {
      const root = document.body.appendChild(document.createElement('div'))
      mounted = createApp(WorkoutApp)
      mounted.use(createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages }))
      mounted.mount(root)
      await settle()
      bridge.ontoolresult?.({ structuredContent: wrap(responseWith(several)) })
      await settle()
      expect(document.body.textContent).toContain('Target date')
      buttonNamed('Show more')!.click()
      await settle()
      buttonNamed('Open goal in eFitware: Run 5 km under 25 minutes')!.click()
      expect(bridge.openLink.mock.calls).toEqual([[{ url: 'https://app.efitware.com/goals/6c0000000000000000000001' }]])
      expect(bridge.callServerTool).not.toHaveBeenCalled()
      bridge.callServerTool.mockResolvedValueOnce({ structuredContent: selecting('2026-09-16') })
      dayButton('2026-09-16').click()
      await settle()
      expect(bridge.callServerTool.mock.calls.map(([call]) => call)).toEqual([{ name: 'open_calendar', arguments: { from: fixture.from, to: fixture.to, date: '2026-09-16' } }])
      expect(goalRows(document.body.innerHTML).map(row => row.text)).toEqual(['Bench 100 kg Target date'])
      expect(bridge.openLink).toHaveBeenCalledTimes(1)
    })
  })
})
