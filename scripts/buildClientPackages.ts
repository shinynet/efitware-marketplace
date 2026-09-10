import { execFileSync } from 'node:child_process'
import { mkdir, readFile, utimes, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const skillFiles = ['SKILL.md', 'agents/openai.yaml', 'assets/efitware-icon.png']
const iconFiles = ['assets/efitware-icon.png', 'assets/efitware-icon-dark.png']
const plugin = 'plugins/efitware'

/** Package only the committed public plugin allowlist, with deterministic ZIP timestamps. */
export const buildClientPackages = async (output: string) => {
  const destination = resolve(output)
  const codex = JSON.parse(await readFile(resolve(root, plugin, '.codex-plugin/plugin.json'), 'utf8')) as { name: string, version: string }
  const claude = JSON.parse(await readFile(resolve(root, plugin, '.claude-plugin/plugin.json'), 'utf8')) as typeof codex
  if (codex.name !== 'efitware' || claude.name !== codex.name || claude.version !== codex.version) throw new Error('Plugin identity/version mismatch')
  const mcp = JSON.parse(await readFile(resolve(root, plugin, '.mcp.json'), 'utf8'))
  if (JSON.stringify(mcp) !== JSON.stringify({ mcpServers: { eFitware: { type: 'http', url: 'https://app.efitware.com/mcp/v1' } } })) throw new Error('Unexpected MCP endpoint or credential field')
  await mkdir(destination)
  const packages = [
    { name: 'codex', files: [
      ['.agents/plugins/marketplace.json', '.agents/plugins/marketplace.json'],
      ...['.codex-plugin/plugin.json', '.mcp.json', 'INSTALL.md', ...iconFiles, ...skillFiles.map(path => `skills/efitware/${path}`)].map(path => [`${plugin}/${path}`, `${plugin}/${path}`])
    ] },
    { name: 'claude', files: ['.claude-plugin/plugin.json', '.mcp.json', 'INSTALL.md', ...skillFiles.map(path => `skills/efitware/${path}`)].map(path => [`${plugin}/${path}`, path]) },
    { name: 'coach', files: skillFiles.map(path => [`${plugin}/skills/efitware/${path}`, `efitware/${path}`]) }
  ]
  for (const bundle of packages) {
    const cwd = resolve(destination, bundle.name)
    for (const [source, name] of bundle.files) {
      const path = resolve(cwd, name!)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, await readFile(resolve(root, source!)), { flag: 'wx' })
      await utimes(path, 946684800, 946684800)
    }
    execFileSync('zip', ['-X', '-q', resolve(destination, `efitware-${bundle.name}.zip`), ...bundle.files.map(([, path]) => path!).sort()], { cwd, env: { ...process.env, TZ: 'UTC' } })
  }
}
