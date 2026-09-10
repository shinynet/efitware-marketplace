import { parseRecurrence } from './lib/recurrence'

/** Product recurrence phrases, rendered without Nuxt runtime or client-side occurrence generation. */
export const summarizeRecurrence = (rule: string, locale: string, t: (key: string, values?: Record<string, string>) => string) => {
  const parts = parseRecurrence(rule)
  const n = (value: number) => new Intl.NumberFormat(locale).format(value)
  const count = n(parts.interval)
  if (parts.freq === 'DAILY') return t(parts.interval === 1 ? 'recurrence.daily' : 'recurrence.everyNDays', { count })
  if (parts.freq === 'WEEKLY') {
    if (parts.interval === 2 && parts.byDays.length === 1) return t('recurrence.everyOther', { day: t(`recurrence.weekdaySingular.${parts.byDays[0]}`) })
    const days = new Intl.ListFormat(locale, { type: 'conjunction' }).format(parts.byDays.map(code => t(`recurrence.weekdayPlural.${code}`))) || t('recurrence.weekly')
    return parts.interval === 1 ? days : t('recurrence.everyNWeeks', { count, days })
  }
  if (parts.freq === 'MONTHLY') {
    const body = parts.monthlyMode === 'weekday' ? t('recurrence.onOrdinalWeekday', { ordinal: t(`recurrence.ordinal.${parts.ordinal}`), weekday: t(`recurrence.weekdaySingular.${parts.weekday}`) }) : t('recurrence.onDay', { day: n(parts.monthDay) })
    return t(parts.interval === 1 ? 'recurrence.monthly' : 'recurrence.everyNMonths', { count, body })
  }
  const date = t('recurrence.yearlyDate', { month: t(`recurrence.monthShort.${parts.month}`), day: n(parts.monthDay) })
  return t(parts.interval === 1 ? 'recurrence.yearly' : 'recurrence.everyNYears', { count, date })
}
