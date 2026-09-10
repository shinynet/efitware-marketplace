// Deliberate product parser projection; provenance and shared recurrence fixtures track compatibility.
const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
type WeekdayCode = typeof WEEKDAY_CODES[number]
type RecurrenceFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
type MonthlyOrdinal = 1 | 2 | 3 | 4 | -1
interface RecurrenceParts { freq: RecurrenceFreq, interval: number, byDays: WeekdayCode[], monthlyMode: 'day' | 'weekday', monthDay: number, ordinal: MonthlyOrdinal, weekday: WeekdayCode, month: number }
export const DEFAULT_RECURRENCE_PARTS: RecurrenceParts = {
  freq: 'WEEKLY',
  interval: 1,
  byDays: ['MO'],
  monthlyMode: 'day',
  monthDay: 1,
  ordinal: 1,
  weekday: 'MO',
  month: 1
}

export const parseRecurrence = (rrule: string): RecurrenceParts => {
  const result: RecurrenceParts = { ...DEFAULT_RECURRENCE_PARTS, byDays: [...DEFAULT_RECURRENCE_PARTS.byDays] }
  if (!rrule) return result

  const raw = Object.fromEntries(
    rrule.split(';').map((p) => {
      const [key, value] = p.split('=')
      return [key, value] as const
    })
  )

  if (raw.FREQ) result.freq = raw.FREQ as RecurrenceFreq
  if (raw.INTERVAL) result.interval = Number(raw.INTERVAL)

  if (result.freq === 'WEEKLY') {
    if (raw.BYDAY) {
      const codes = raw.BYDAY.split(',') as WeekdayCode[]
      result.byDays = WEEKDAY_CODES.filter(code => codes.includes(code))
    } else {
      result.byDays = []
    }
  } else {
    result.byDays = []
  }

  if (result.freq === 'MONTHLY') {
    if (raw.BYDAY) {
      // Ordinal weekday, e.g. "1MO" or "-1FR".
      const match = /^(-?\d+)([A-Z]{2})$/.exec(raw.BYDAY)
      if (match) {
        result.monthlyMode = 'weekday'
        result.ordinal = Number(match[1]) as MonthlyOrdinal
        result.weekday = match[2] as WeekdayCode
      }
    } else if (raw.BYMONTHDAY) {
      result.monthlyMode = 'day'
      result.monthDay = Number(raw.BYMONTHDAY)
    }
  }

  if (result.freq === 'YEARLY') {
    if (raw.BYMONTH) result.month = Number(raw.BYMONTH)
    if (raw.BYMONTHDAY) result.monthDay = Number(raw.BYMONTHDAY)
  }

  return result
}
