import { computed, ref, shallowRef } from 'vue'
import { App, type McpUiHostContext } from '@modelcontextprotocol/ext-apps'
import { parseTrainingView, type TrainingView } from './templateModel'

interface PendingAction { name: string, arguments: Record<string, unknown> }
const intentKey = () => `mcp-app-${Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')}`
interface ToolResult { isError?: boolean, structuredContent?: unknown }
const failure = (result: ToolResult) => {
  const content = result.structuredContent
  return typeof content === 'object' && content !== null && 'error' in content ? content.error : undefined
}
const failureCode = (result: ToolResult): string => {
  const error = failure(result)
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : 'REQUEST_FAILED'
}

/** Owns one card's bridge and serialized, revision-checked saves. No local persistence simulation. */
export const createWorkoutConnection = () => {
  const app = new App({ name: 'eFitware Workout', version: '1.0.0' })
  const route = shallowRef<TrainingView>()
  const view = computed(() => route.value?.view === 'workout' ? route.value.record : undefined)
  const template = computed(() => route.value?.view === 'template' ? route.value : undefined)
  const presentation = computed(() => route.value?.view === 'workout' ? route.value.record.presentation : route.value?.presentation)
  const sourceTemplateId = ref<string>()
  let readTarget: PendingAction | undefined
  let navigationGeneration = 0
  const host = shallowRef<McpUiHostContext>()
  const connected = ref(false)
  const busy = ref(false)
  const error = ref('')
  const saved = ref(false)
  const stale = ref(false)
  const pending = shallowRef<PendingAction>()
  const needsReadback = ref(false)
  let disposed = false
  let connectTimer: ReturnType<typeof setTimeout> | undefined
  const canWrite = computed(() => connected.value && !busy.value && !error.value && !stale.value && !!route.value)

  const read = async () => {
    const target = readTarget ?? (template.value
      ? { name: 'open_template', arguments: { templateId: template.value.record.id } }
      : view.value ? { name: 'open_workout', arguments: { workoutId: view.value.workout.id } } : undefined)
    if (!target) return
    const generation = ++navigationGeneration
    const result = await app.callServerTool(target, { timeout: 15_000 })
    if (result.isError) throw new Error(failureCode(result))
    const parsed = parseTrainingView(result.structuredContent)
    if (disposed || generation !== navigationGeneration) return
    route.value = parsed
    readTarget = undefined
    stale.value = false
  }
  const navigate = async (target: PendingAction) => {
    if (busy.value || pending.value || needsReadback.value) return
    readTarget = target
    saved.value = false
    await refresh()
  }
  const refresh = async () => {
    if (busy.value || pending.value) return
    busy.value = true
    try {
      await read()
      error.value = ''
      needsReadback.value = false
    } catch {
      error.value = 'READ_FAILED'
    } finally {
      busy.value = false
    }
  }
  const execute = async () => {
    if (busy.value || !pending.value) return
    busy.value = true
    error.value = ''
    saved.value = false
    try {
      const result = await app.callServerTool(pending.value, { timeout: 15_000 })
      if (result.isError) {
        const code = failureCode(result)
        // Only a definitive client rejection ends the intent. Retry ambiguous server
        // failures and rate limits with the original key, revision and exact payload.
        const detail = failure(result)
        const status = typeof detail === 'object' && detail !== null && 'status' in detail ? detail.status : undefined
        if (typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429) pending.value = undefined
        error.value = code
        return
      }
      if (pending.value.name === 'create_workout') {
        const content = result.structuredContent
        const id = typeof content === 'object' && content !== null && 'id' in content ? content.id : undefined
        if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id)) throw new Error('INVALID_CREATED_WORKOUT')
        sourceTemplateId.value = template.value?.record.id
        readTarget = { name: 'open_workout', arguments: { workoutId: id } }
      }
      pending.value = undefined
      needsReadback.value = true
      await read()
      needsReadback.value = false
      saved.value = true
      // Context is informational; a host that declines it must not undo a successful save.
      void app.updateModelContext({ structuredContent: { workoutId: view.value?.workout.id, revision: view.value?.workout.revision,
        completedSets: view.value?.workout.exercises.reduce((sum, ex) => sum + ex.sets.filter(set => set.completed).length, 0) } }).catch(() => {})
      return true
    } catch {
      error.value = needsReadback.value ? 'READ_FAILED_AFTER_SAVE' : 'CONNECTION_LOST'
    } finally { busy.value = false }
  }
  const mutate = (name: 'log_sets' | 'update_workout_activity', arguments_: Record<string, unknown>) => {
    if (!canWrite.value || !view.value || pending.value) return
    pending.value = { name, arguments: { ...arguments_, workoutId: view.value.workout.id,
      expectedRevision: view.value.workout.revision, idempotencyKey: intentKey() } }
    return execute()
  }
  const start = async () => {
    app.ontoolresult = (result) => {
      if (disposed) return
      if (result.isError) {
        error.value = failureCode(result)
        return
      }
      try {
        const parsed = parseTrainingView(result.structuredContent)
        if (route.value) { stale.value = true; return }
        route.value = parsed
      } catch { error.value = 'INVALID_RESULT' }
    }

    app.onhostcontextchanged = (context) => {
      host.value = { ...host.value, ...context }
    }
    app.ontoolcancelled = () => {
      error.value = 'CANCELLED'
    }
    connectTimer = setTimeout(() => {
      if (!connected.value) error.value = 'CONNECTION_LOST'
    }, 15_000)
    try {
      await app.connect()
      if (disposed) return
      connected.value = !!app.getHostCapabilities()?.serverTools
      host.value = app.getHostContext()
      if (connected.value && error.value === 'CONNECTION_LOST') error.value = ''
      if (!connected.value) error.value = 'TOOLS_UNAVAILABLE'
    } catch {
      error.value = 'CONNECTION_LOST'
    } finally {
      clearTimeout(connectTimer)
    }
  }
  const createFromTemplate = (date: string) => {
    if (!canWrite.value || !template.value || pending.value) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) return
    pending.value = { name: 'create_workout', arguments: { date, sourceTemplateId: template.value.record.id,
      idempotencyKey: intentKey() } }
    return execute()
  }
  const sendFollowUp = async (prompt: string): Promise<'accepted' | 'unavailable' | 'rejected' | 'uncertain'> => {
    if (!app.getHostCapabilities()?.message?.text) return 'unavailable'
    try {
      const result = await app.sendMessage({ role: 'user', content: [{ type: 'text', text: prompt }] }, { timeout: 15_000 })
      return result.isError ? 'rejected' : 'accepted'
    } catch { return 'uncertain' }
  }
  const close = () => {
    disposed = true
    clearTimeout(connectTimer)
    void app.close()
  }
  return { view, template, presentation, sourceTemplateId, createFromTemplate, sendFollowUp, navigate, host, connected, busy, error, saved, stale, pending, needsReadback, canWrite, start, close, mutate,
    retry: execute, refresh, open: () => view.value && app.openLink({ url: `https://app.efitware.com/workouts/${view.value.workout.date}/${view.value.workout.id}` }) }
}
