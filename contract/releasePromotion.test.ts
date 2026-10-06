import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { promoteRelease } from '../scripts/promote-release'

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const fixture = (opts: { corrupt?: boolean, published?: boolean, changedAfter?: boolean, latestId?: number } = {}) => {
  const content = new TextEncoder().encode('reviewed skill archive')
  const manifest = new TextEncoder().encode(JSON.stringify({
    version: '0.1.31', commit: 'a'.repeat(40), serverContract: { minimumAppCommit: 'b'.repeat(40) },
    files: { 'skill.zip': { bytes: content.length, sha256: hash(content), asset: 'skill.zip' } }
  }))
  const assets = ([['manifest.json', manifest], ['skill.zip', content]] satisfies Array<[string, Uint8Array]>).map(([name, bytes], at) => {
    return { id: at + 1, name, size: bytes.length, digest: `sha256:${hash(bytes)}`, updated_at: '2026-10-06T00:00:00Z',
      browser_download_url: `https://github.com/shinynet/efitware-marketplace/releases/download/v0.1.31/${name}` }
  })
  const release = { id: 100, tag_name: 'v0.1.31', immutable: true, prerelease: !opts.published, assets }
  const receipt = { version: '0.1.31', commit: 'a'.repeat(40), manifestSha256: hash(manifest), minimumAppCommit: 'b'.repeat(40),
    appDeployment: { source: 'c'.repeat(40), id: 'dpl_test', state: 'READY' as const } }
  const calls: Array<{ url: string, method: string, authorized: boolean, body?: unknown }> = []
  const request: typeof fetch = async (input, init) => {
    const url = String(input), method = init?.method ?? 'GET'
    calls.push({ url, method, authorized: new Headers(init?.headers).has('Authorization'), ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}) })
    if (method === 'PATCH') return Response.json({ ...release, prerelease: false,
      assets: opts.changedAfter ? assets.map(asset => ({ ...asset, updated_at: 'changed' })) : assets })
    if (url.endsWith('/releases/latest')) return Response.json({ ...release, id: opts.latestId ?? release.id })
    if (url.includes('api.github.com')) return Response.json(release)
    return new Response(url.endsWith('manifest.json') ? manifest : opts.corrupt ? new TextEncoder().encode('altered') : content)
  }
  return { receipt, request, calls }
}

describe('immutable release metadata promotion', () => {
  it('verifies every byte before its metadata-only write and never sends the token to downloads', async () => {
    const { receipt, request, calls } = fixture()
    expect(await promoteRelease(receipt, 'test-token', request)).toMatchObject({ version: '0.1.31', prerelease: false, assets: 2 })
    expect(calls.filter(call => call.method === 'PATCH')).toEqual([expect.objectContaining({ body: { prerelease: false, name: 'eFitware v0.1.31', make_latest: 'true' } })])
    expect(calls.filter(call => !call.url.includes('api.github.com')).every(call => !call.authorized)).toBe(true)
  })

  it('refuses changed staged bytes before publishing anything', async () => {
    const { receipt, request, calls } = fixture({ corrupt: true })
    await expect(promoteRelease(receipt, 'test-token', request)).rejects.toThrow('identity mismatch')
    expect(calls.some(call => call.method === 'PATCH')).toBe(false)
  })

  it('refuses a pin whose minimum producer differs from the staged contract', async () => {
    const { receipt, request, calls } = fixture()
    await expect(promoteRelease({ ...receipt, minimumAppCommit: 'd'.repeat(40) }, 'test-token', request)).rejects.toThrow('contract mismatch')
    expect(calls.some(call => call.method === 'PATCH')).toBe(false)
  })

  it('reports changed asset identities after publication rather than claiming success', async () => {
    const { receipt, request } = fixture({ changedAfter: true })
    await expect(promoteRelease(receipt, 'test-token', request)).rejects.toThrow('changed immutable assets')
  })

  it('reconciles an already-published release without another write', async () => {
    const { receipt, request, calls } = fixture({ published: true })
    expect(await promoteRelease(receipt, 'test-token', request)).toMatchObject({ prerelease: false })
    expect(calls.some(call => call.method === 'PATCH')).toBe(false)
  })

  it('refuses to report complete promotion when GitHub still advertises another latest release', async () => {
    const { receipt, request } = fixture({ latestId: 99 })
    await expect(promoteRelease(receipt, 'test-token', request)).rejects.toThrow('not GitHub latest')
  })
})
