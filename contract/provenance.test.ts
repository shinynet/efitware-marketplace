import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import provenance from '../apps/workout/lib/PROVENANCE.json'

it('requires an explicit provenance update for every changed copy or theme asset', () => {
  for (const file of provenance.files) {
    expect(file.commit).toMatch(/^[a-f0-9]{40}$/)
    expect(file.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    const hash = createHash('sha256').update(readFileSync(new URL(`../${file.path}`, import.meta.url))).digest('hex')
    expect(hash, file.path).toBe(file.sha256)
  }
})
