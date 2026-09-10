import { beforeEach, expect, it, vi } from 'vitest'
import { createWorkoutConnection } from '../apps/workout/workoutConnection'

const { bridge } = vi.hoisted(() => ({ bridge: {
  ontoolresult: undefined as undefined | ((result: { structuredContent?: unknown, isError?: boolean }) => void),
  connect: vi.fn(async () => {}), close: vi.fn(async () => {}),
  getHostCapabilities: vi.fn(() => ({ serverTools: {}, message: { text: {} } })),
  getHostContext: vi.fn(() => ({ locale: 'en', theme: 'light' })),
  callServerTool: vi.fn(), updateModelContext: vi.fn(async () => {}), sendMessage: vi.fn(), openLink: vi.fn()
} }))
vi.mock('@modelcontextprotocol/ext-apps', () => ({ App: class { constructor() { return bridge } } }))

const presentation = { locale: 'en', unitSystem: 'metric', theme: null, skin: null }
const template = { view: 'template', record: { id: 'a'.repeat(24), name: 'Soloflex', revision: `template:1:${'a'.repeat(64)}`, exercises: [] }, related: { exercises: [] }, presentation }
const workout = { workout: { id: 'b'.repeat(24), title: 'Soloflex', date: '2026-09-10', status: 'planned', revision: `workout:1:${'b'.repeat(64)}`, exercises: [] }, exercises: [], presentation }
beforeEach(() => { vi.clearAllMocks(); bridge.callServerTool.mockReset(); bridge.sendMessage.mockReset() })
const open = async () => {
  const connection = createWorkoutConnection()
  await connection.start()
  bridge.ontoolresult?.({ structuredContent: template })
  return connection
}

it('opens a template without writes and creates one dated workout in the same bridge', async () => {
  const connection = await open()
  try {
    expect(connection.template.value?.record.name).toBe('Soloflex')
    expect(bridge.callServerTool).not.toHaveBeenCalled()
    bridge.callServerTool.mockResolvedValueOnce({ structuredContent: { id: workout.workout.id } }).mockResolvedValueOnce({ structuredContent: workout })
    expect(await connection.createFromTemplate('2026-09-10')).toBe(true)
    expect(bridge.callServerTool.mock.calls[0]![0]).toMatchObject({ name: 'create_workout', arguments: { date: '2026-09-10', sourceTemplateId: template.record.id, idempotencyKey: expect.any(String) } })
    expect(connection.view.value?.workout.id).toBe(workout.workout.id)
    expect(connection.sourceTemplateId.value).toBe(template.record.id)
    bridge.callServerTool.mockResolvedValueOnce({ structuredContent: template })
    await connection.navigate({ name: 'open_template', arguments: { templateId: template.record.id } })
    expect(connection.template.value?.record.id).toBe(template.record.id)
    expect(bridge.connect).toHaveBeenCalledTimes(1)
  } finally { connection.close() }
})

it('retains the same creation intent after a lost response and never repeats a create for failed readback', async () => {
  const connection = await open()
  try {
    bridge.callServerTool.mockRejectedValueOnce(new Error('lost'))
    await connection.createFromTemplate('2026-09-10')
    const intent = structuredClone(bridge.callServerTool.mock.calls[0]![0])
    bridge.callServerTool.mockResolvedValueOnce({ structuredContent: { id: workout.workout.id } }).mockRejectedValueOnce(new Error('read lost'))
    await connection.retry()
    expect(bridge.callServerTool.mock.calls[1]![0]).toEqual(intent)
    expect(connection.needsReadback.value).toBe(true)
    expect(connection.pending.value).toBeUndefined()
    bridge.callServerTool.mockResolvedValueOnce({ structuredContent: workout })
    await connection.refresh()
    expect(bridge.callServerTool.mock.calls[3]![0]).toEqual({ name: 'open_workout', arguments: { workoutId: workout.workout.id } })
    expect(connection.needsReadback.value).toBe(false)
  } finally { connection.close() }
})

it('keeps denied writes on the template and refuses impossible dates', async () => {
  const connection = await open()
  try {
    await connection.createFromTemplate('2026-02-30')
    expect(bridge.callServerTool).not.toHaveBeenCalled()
    bridge.callServerTool.mockResolvedValueOnce({ isError: true, structuredContent: { error: { status: 403, code: 'DENIED' } } })
    await connection.createFromTemplate('2026-09-10')
    expect(connection.template.value?.record.id).toBe(template.record.id)
    expect(connection.saved.value).toBe(false)
    expect(connection.pending.value).toBeUndefined()
  } finally { connection.close() }
})

it('distinguishes accepted, rejected and uncertain host messages from persistence', async () => {
  const connection = await open()
  try {
    bridge.sendMessage.mockResolvedValueOnce({}).mockResolvedValueOnce({ isError: true }).mockRejectedValueOnce(new Error('timeout'))
    expect(await connection.sendFollowUp('Adapt this template')).toBe('accepted')
    expect(await connection.sendFollowUp('Adapt this template')).toBe('rejected')
    expect(await connection.sendFollowUp('Adapt this template')).toBe('uncertain')
    expect(connection.saved.value).toBe(false)
    expect(bridge.callServerTool).not.toHaveBeenCalled()
  } finally { connection.close() }
})
