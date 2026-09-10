import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { buildClientPackages } from './buildClientPackages.ts'

const { values } = parseArgs({ options: { output: { type: 'string' }, strict: { type: 'boolean' } } })
if (!values.output) throw new Error('Usage: node scripts/build-release.ts --output <new-directory> [--strict]')
if (values.strict && execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('A release requires a clean commit')
const output = resolve(values.output)
const sha256 = (content: Uint8Array) => createHash('sha256').update(content).digest('hex')
await mkdir(output)
await buildClientPackages(resolve(output, 'packages'))
const paths = ['workout.html', 'efitware-codex.zip', 'efitware-claude.zip', 'efitware-coach.zip', 'contract/workout-view.schema.json', 'contract/compat-fixtures.json', 'contract/template-view.schema.json', 'contract/view-coverage.json']
await mkdir(resolve(output, 'contract'))
for (const path of paths) {
  const source = path === 'workout.html' ? 'dist/card/workout.html' : path.startsWith('contract/') ? path : resolve(output, 'packages', path)
  await copyFile(source, resolve(output, path))
}
const files: Record<string, { sha256: string, bytes: number, asset: string }> = {}
for (const path of paths) {
  const content = await readFile(resolve(output, path))
  files[path] = { sha256: sha256(content), bytes: content.length, asset: path.split('/').at(-1)! }
}
const plugin = JSON.parse(await readFile('plugins/efitware/.codex-plugin/plugin.json', 'utf8')) as { version: string }
const skill = await readFile('plugins/efitware/skills/efitware-coach/SKILL.md')
const serverContract = JSON.parse(await readFile('contract/server-contract.json', 'utf8'))
const provenance = JSON.parse(await readFile('apps/workout/lib/PROVENANCE.json', 'utf8')) as { files: { path: string }[] }
const theme = createHash('sha256')
for (const path of provenance.files.map(file => file.path).filter(path => path.startsWith('apps/workout/theme/')).sort()) theme.update(path).update('\0').update(await readFile(path))
const manifest = { formatVersion: 2, version: plugin.version, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), serverContract, skillSha256: sha256(skill), cardSha256: files['workout.html']!.sha256, themeSha256: theme.digest('hex'), files }
await writeFile(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ version: manifest.version, commit: manifest.commit, output, manifestSha256: sha256(await readFile(resolve(output, 'manifest.json'))) }))
