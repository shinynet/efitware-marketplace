import { computed, ref, shallowRef } from 'vue'
import { App, type McpUiHostContext } from '@modelcontextprotocol/ext-apps'
import { viewSchema, type WorkoutView } from './model'

interface PendingAction { name: string, arguments: Record<string, unknown> }
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
  const view = shallowRef<WorkoutView>()
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
  const canWrite = computed(() => connected.value && !busy.value && !error.value && !stale.value && !!view.value)

  const read = async () => {
    if (!view.value) return
    const result = await app.callServerTool({ name: 'open_workout', arguments: { workoutId: view.value.workout.id } }, { timeout: 15_000 })
    if (result.isError) throw new Error(failureCode(result))
    view.value = viewSchema.parse(result.structuredContent)
    stale.value = false
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
      expectedRevision: view.value.workout.revision, idempotencyKey: `mcp-app-${Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')}` } }
    return execute()
  }
  const start = async () => {
    app.ontoolresult = (result) => {
      if (disposed) return
      if (result.isError) {
        error.value = failureCode(result)
        return
      }
      const parsed = viewSchema.safeParse(result.structuredContent)
      if (!parsed.success) {
        error.value = 'INVALID_RESULT'
        return
      }
      if (view.value) {
        stale.value = true
        return
      }
      view.value = parsed.data
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
  const close = () => {
    disposed = true
    clearTimeout(connectTimer)
    void app.close()
  }
  return { view, host, connected, busy, error, saved, stale, pending, needsReadback, canWrite, start, close, mutate,
    retry: execute, refresh, open: () => view.value && app.openLink({ url: `https://app.efitware.com/workouts/${view.value.workout.date}/${view.value.workout.id}` }) }
}
