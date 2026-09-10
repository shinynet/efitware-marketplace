import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import serverContract from './server-contract.json'

it('keeps the published skill inventory consistent with the required server surface', () => {
  const skill = readFileSync('plugins/efitware/skills/efitware-coach/SKILL.md', 'utf8')
  const start = skill.indexOf('## What this surface can and cannot do')
  const section = skill.slice(start, skill.indexOf('\n## ', start + 5))
  const names = [...new Set([...section.matchAll(/^\| `([^`\s]+)` \|/gm)].map(match => match[1]))].sort()
  expect(serverContract.tools).toEqual(names)
  expect(serverContract.minimumAppCommit).toMatch(/^[a-f0-9]{40}$/)
  expect(skill).toContain('call `open_workout`')
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
