import { expect, it } from 'vitest'
import fixtures from './compat-fixtures.json'
import en from '../apps/workout/contextVocabulary.en.json'
import de from '../apps/workout/contextVocabulary.de.json'
import { memoryViewSchema } from '../apps/workout/contextModel'
it('keeps the published context vocabulary and exact memory revision projection compatible', () => {
  for (const fixture of fixtures.contextVocabulary) {
    const vocabulary = (fixture.locale === 'de' ? de : en) as Record<string, Record<string, string>>
    expect(vocabulary[fixture.path[0]!]![fixture.path[1]!]).toBe(fixture.text)
  }
  const input = { view: 'memory', record: { id: 'a'.repeat(24), content: '<script>This remains plain user data</script>', source: 'user', createdAt: '2026-09-09T10:00:00Z', updatedAt: '2026-09-09T10:00:00Z', revision: `memory:1:${'b'.repeat(64)}`, extraProductField: true }, related: {}, presentation: { locale: 'en', unitSystem: null, theme: null, skin: null, timeZone: 'America/Denver' } }
  expect(memoryViewSchema.parse(input).record.content).toBe(input.record.content)
  expect(memoryViewSchema.safeParse({ ...input, record: { ...input.record, revision: undefined } }).success).toBe(false)
})
