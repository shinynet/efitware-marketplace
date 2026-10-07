import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import serverContract from './server-contract.json'

it('keeps the published skill inventory consistent with the required server surface', () => {
  const skill = readFileSync('plugins/efitware/skills/efitware/SKILL.md', 'utf8')
  const start = skill.indexOf('## What this surface can and cannot do')
  const section = skill.slice(start, skill.indexOf('\n## ', start + 5))
  const names = [...new Set([...section.matchAll(/^\| `([^`\s]+)` \|/gm)].map(match => match[1]))].sort()
  expect(serverContract.tools).toEqual(names)
  expect(serverContract.minimumAppCommit).toMatch(/^[a-f0-9]{40}$/)
  expect(skill).toContain('call `open_workout`')
  // EF-1339: a lookup question opens the existing card without being asked to.
  expect(skill).toContain('is a display request even when the user does not ask for a card')
  expect(skill).toMatch(/has no workoutId: call `open_calendar` for that day instead/)
  // EF-1469: a PR is one award of two kinds; legacy markers are never announced.
  expect(skill).toContain('Ordinary external lifts earn at most one award per exercise per workout: Heaviest (`weight`, a new top weight) or Est. 1RM (`oneRm`')
  expect(skill).toContain('Added-load exercises never earn an estimated 1RM.')
  expect(skill).toContain('same or heavier added load')
  expect(skill).toContain('Both can belong to the same set; name both while treating it as one performance.')
  expect(skill).toContain('Rep record: 12 reps at body weight')
  expect(skill).toContain('The first qualifying workout sets the reference and earns none.')
  expect(skill).toContain('A stored `volume` marker or ineligible estimate is not an award: never announce it.')
  // EF-1587: a day's program credit comes from the full list, not the scalar fields.
  expect(skill).toContain('credit a shared or manual-led day from `programs`')
})

it('preserves marketplace identity and sign-in policy', () => {
  const codex = JSON.parse(readFileSync('.agents/plugins/marketplace.json', 'utf8'))
  const claude = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'))
  expect(codex.name).toBe('efitware')
  expect(claude.name).toBe('efitware')
  expect(codex.plugins[0].source.path).toBe('./plugins/efitware')
  expect(claude.plugins[0].source).toBe('./plugins/efitware')
  expect(codex.plugins[0].policy.authentication).toBe('ON_INSTALL')
})
