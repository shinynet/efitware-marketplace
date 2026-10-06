import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'

const sha = z.string().regex(/^[a-f0-9]{40}$/)
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const version = z.string().regex(/^\d+\.\d+\.\d+$/)
const assetSchema = z.object({ id: z.number().int(), name: z.string(), size: z.number().int(), digest: z.string().nullable(), updated_at: z.string(), browser_download_url: z.string() })
const releaseSchema = z.object({ id: z.number().int(), tag_name: z.string(), immutable: z.literal(true), prerelease: z.boolean(), assets: z.array(assetSchema) })
const manifestSchema = z.object({ version, commit: sha, serverContract: z.object({ minimumAppCommit: sha }), files: z.record(z.string(), z.object({ bytes: z.number().int().positive(), sha256: digest, asset: z.string().regex(/^[a-z0-9._-]+$/) })) })
export const promotionReceiptSchema = z.object({
  version, commit: sha, manifestSha256: digest, minimumAppCommit: sha,
  appDeployment: z.object({ source: sha, id: z.string().regex(/^dpl_[A-Za-z0-9]+$/), state: z.literal('READY') }).strict()
}).strict()

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const identity = (assets: z.infer<typeof assetSchema>[]) => JSON.stringify(assets.map(({ id, name, size, digest, updated_at, browser_download_url }) => ({ id, name, size, digest, updated_at, browser_download_url })).sort((a, b) => a.name.localeCompare(b.name)))

/** Publish metadata only after the reviewed pin/deployment receipt and every immutable byte agree. */
export const promoteRelease = async (receipt: z.infer<typeof promotionReceiptSchema>, token: string, request: typeof fetch = fetch) => {
  promotionReceiptSchema.parse(receipt)
  if (!token) throw new Error('Release metadata credential unavailable')
  const tag = `v${receipt.version}`
  const api = 'https://api.github.com/repos/shinynet/efitware-marketplace'
  const call = async (path: string, body?: object) => {
    const response = await request(`${api}${path}`, {
      method: body ? 'PATCH' : 'GET', redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    if (!response.ok) throw new Error(`Release metadata request failed (${response.status})`)
    return releaseSchema.parse(await response.json())
  }
  const before = await call(`/releases/tags/${tag}`)
  if (before.tag_name !== tag) throw new Error('Release tag mismatch')
  const download = async (name: string) => {
    const asset = before.assets.find(asset => asset.name === name)
    const url = `https://github.com/shinynet/efitware-marketplace/releases/download/${tag}/${name}`
    if (!asset || asset.browser_download_url !== url) throw new Error(`Missing or unexpected release asset: ${name}`)
    const response = await request(url, { signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error(`Release asset download failed (${response.status})`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length !== asset.size || asset.digest !== `sha256:${hash(bytes)}`) throw new Error(`Release asset identity mismatch: ${name}`)
    return bytes
  }
  const bytes = await download('manifest.json')
  if (hash(bytes) !== receipt.manifestSha256) throw new Error('Staged manifest hash mismatch')
  const manifest = manifestSchema.parse(JSON.parse(new TextDecoder().decode(bytes)))
  if (manifest.version !== receipt.version || manifest.commit !== receipt.commit || manifest.serverContract.minimumAppCommit !== receipt.minimumAppCommit) throw new Error('Staged release contract mismatch')
  if (before.assets.length !== Object.keys(manifest.files).length + 1) throw new Error('Unexpected release asset inventory')
  for (const entry of Object.values(manifest.files)) {
    const content = await download(entry.asset)
    if (content.length !== entry.bytes || hash(content) !== entry.sha256) throw new Error(`Staged file mismatch: ${entry.asset}`)
  }
  const after = before.prerelease ? await call(`/releases/${before.id}`, { prerelease: false, name: `eFitware ${tag}`, make_latest: 'true' }) : before
  if (after.id !== before.id || after.tag_name !== tag || after.prerelease || identity(after.assets) !== identity(before.assets)) throw new Error('Release metadata promotion changed immutable assets')
  if ((await call('/releases/latest')).id !== after.id) throw new Error('Published release is not GitHub latest')
  return { version: receipt.version, releaseId: after.id, prerelease: after.prerelease, assets: after.assets.length, manifestSha256: receipt.manifestSha256 }
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  const receipt = promotionReceiptSchema.parse(JSON.parse(await readFile('.github/release-promotion.json', 'utf8')))
  const channels: { published?: unknown, staged?: unknown } = JSON.parse(await readFile('channels.json', 'utf8'))
  if (channels.published !== receipt.version || channels.staged !== null) throw new Error('Published channel does not match reviewed promotion')
  for (const client of ['codex', 'claude']) {
    const plugin: { version?: unknown } = JSON.parse(await readFile(`plugins/efitware/.${client}-plugin/plugin.json`, 'utf8'))
    if (plugin.version !== receipt.version) throw new Error('Published plugin version mismatch')
  }
  if (execFileSync('git', ['rev-parse', `v${receipt.version}^{commit}`], { encoding: 'utf8' }).trim() !== receipt.commit) throw new Error('Immutable tag source mismatch')
  execFileSync('git', ['merge-base', '--is-ancestor', receipt.commit, 'HEAD'])
  console.log(JSON.stringify(await promoteRelease(receipt, process.env.GH_TOKEN ?? '')))
}
