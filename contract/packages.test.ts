import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { buildClientPackages } from '../scripts/buildClientPackages'

it('packages identical canonical content deterministically and refuses overwrite', async () => {
  const root = await mkdtemp(join(tmpdir(), 'efitware-packages-'))
  try {
    const first = join(root, 'first'), second = join(root, 'second')
    await buildClientPackages(first)
    await buildClientPackages(second)
    for (const name of ['codex', 'claude', 'coach']) {
      const filename = `efitware-${name}.zip`
      const a = await readFile(join(first, filename)), b = await readFile(join(second, filename))
      expect(createHash('sha256').update(a).digest('hex')).toBe(createHash('sha256').update(b).digest('hex'))
      const entries = execFileSync('unzip', ['-Z1', join(first, filename)], { encoding: 'utf8' }).trim().split('\n')
      expect(entries.some(path => /(^|\/)\.(env|git)(\/|$|\.)/.test(path))).toBe(false)
      for (const entry of entries) {
        const source = name === 'claude' ? `plugins/efitware/${entry}` : name === 'coach' ? `plugins/efitware/skills/${entry}` : entry
        expect(execFileSync('unzip', ['-p', join(first, filename), entry])).toEqual(await readFile(source))
      }
    }
    await expect(buildClientPackages(first)).rejects.toMatchObject({ code: 'EEXIST' })
  } finally { await rm(root, { recursive: true, force: true }) }
})
