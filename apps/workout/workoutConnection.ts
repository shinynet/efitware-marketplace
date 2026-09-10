import { computed, ref, shallowRef } from 'vue'
import { App, type McpUiHostContext } from '@modelcontextprotocol/ext-apps'
import { parseTrainingView, type TrainingView } from './templateModel'

interface PendingAction { name: string, arguments: Record<string, unknown> }
const intentKey = () => `mcp-app-${Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')}`
const targetForView = (view: TrainingView): PendingAction => {
  if (view.view === 'status') return { name: 'open_status', arguments: { section: view.related.section, page: view.related.connections.meta.page, limit: view.related.connections.meta.limit } }
  if (view.view === 'integration') return { name: 'open_integration', arguments: { connectionId: view.record.id, page: view.related.runs.meta.page, limit: view.related.runs.meta.limit } }
  if (view.view === 'receipts') return { name: 'open_receipts', arguments: { page: view.record.meta.page, limit: view.record.meta.limit } }
  if (view.view === 'workout-review') return { name: 'open_workout_review', arguments: { workoutId: view.record.id, page: view.related.decisions.meta.page, limit: view.related.decisions.meta.limit } }
  if (view.view === 'share') return { name: 'open_share', arguments: { request: { ...view.related.request } } }
  if (view.view === 'library') return { name: 'open_library', arguments: { ...view.record.query } }
  if (view.view === 'exercise') return { name: 'open_exercise', arguments: { exerciseId: view.record.id } }
  if (view.view === 'context') return { name: 'open_context', arguments: { section: view.related.section, page: view.related.memories.meta.page, limit: view.related.memories.meta.limit } }
  if (view.view === 'memory') return { name: 'open_memory', arguments: { memoryId: view.record.id } }
  if (view.view === 'body-metric') return { name: 'open_body_metric', arguments: { ...view.record } }
  if (view.view === 'exercise-progress') return { name: 'open_exercise_progress', arguments: { exerciseId: view.record.id, range: view.related.progression.metadata.range, today: view.related.progression.metadata.today, collection: view.related.collection, page: view.related.page, limit: view.related.limit } }
  if (view.view === 'progress') return { name: 'open_progress', arguments: { range: view.record.range, today: view.record.asOf, section: view.related.section, page: view.related.section === 'goals' ? view.related.goals.meta.page : view.related.progression.meta.page, limit: view.related.progression.meta.limit } }
  if (view.view === 'workout') return { name: 'open_workout', arguments: { workoutId: view.record.workout.id } }
  if (view.view === 'template') return { name: 'open_template', arguments: { templateId: view.record.id } }
  if (view.view === 'goal') return { name: 'open_goal', arguments: { goalId: view.record.id, today: view.related.today, page: view.related.checkIns.meta.page, limit: view.related.checkIns.meta.limit } }
  if (view.view === 'goal-plan') return { name: 'open_goal_plan', arguments: { planId: view.record.id, today: view.related.today, page: view.related.historyMeta.page, limit: view.related.historyMeta.limit, ...(view.related.displayedVersion.id !== view.related.activeVersion.id ? { versionId: view.related.displayedVersion.id } : {}) } }
  if (view.view === 'program') return { name: 'open_program', arguments: { programId: view.record.id, today: view.related.today, page: view.related.page, limit: view.related.limit, collection: view.related.collection } }
  if (view.view === 'schedule') return { name: 'open_schedule', arguments: { scheduleId: view.record.id, today: view.related.today } }
  return { name: 'open_calendar', arguments: { from: view.record.from, to: view.record.to, date: view.record.date } }
}
const modelContext = (view: TrainingView): Record<string, unknown> => {
  if (view.view === 'status') return { view: view.view, section: view.related.section, status: view.record }
  if (view.view === 'integration') return { view: view.view, connectionId: view.record.id, status: view.record.status }
  if (view.view === 'receipts') return { view: view.view, page: view.record.meta.page, receiptIds: view.record.data.map(row => row.id) }
  if (view.view === 'workout-review') return { view: view.view, workoutId: view.record.id, revision: view.related.reflections.revision, status: view.record.status }
  if (view.view === 'share') return { view: view.view, request: view.related.request, caption: view.record.caption, published: false }
  if (view.view === 'library') return { view: view.view, query: view.record.query, total: view.related.exercises.meta.total }
  if (view.view === 'exercise') return { view: view.view, exerciseId: view.record.id, isFavorite: view.record.isFavorite, isHidden: view.record.isHidden }
  if (view.view === 'context') return { view: view.view, section: view.related.section, page: view.related.memories.meta.page }
  if (view.view === 'memory') return { view: view.view, memoryId: view.record.id, revision: view.record.revision }
  if (view.view === 'workout') return { view: 'workout', workoutId: view.record.workout.id, revision: view.record.workout.revision, status: view.record.workout.status, completedSets: view.record.workout.exercises.reduce((sum, ex) => sum + ex.sets.filter(set => set.completed).length, 0) }
  if (view.view === 'body-metric') return { view: view.view, ...view.record, observations: view.related.observations.data }
  if (view.view === 'exercise-progress') return { view: view.view, exerciseId: view.record.id, range: view.related.progression.metadata, allTimeStats: view.related.stats, collection: view.related.collection, page: view.related.page }
  if (view.view === 'progress') return { view: view.view, from: view.record.rangeStart, to: view.record.asOf, range: view.record.range, section: view.related.section, metrics: view.record.metrics }
  if (view.view === 'calendar') return { view: view.view, from: view.record.from, to: view.record.to, date: view.record.date }
  const base = { view: view.view, recordId: view.record.id, revision: view.record.revision }
  if (view.view === 'goal') return { ...base, status: view.record.status, checkInCount: view.related.checkInCount }
  if (view.view === 'goal-plan') return { ...base, status: view.record.status, activeVersionId: view.related.activeVersion.id, displayedVersionId: view.related.displayedVersion.id }
  if (view.view === 'schedule') return { ...base, enabled: view.record.enabled }
  if (view.view === 'program') return { ...base, status: view.record.status }
  return base
}
const validDay = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
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
  const lastReceipt = ref<string>()
  const history = shallowRef<PendingAction[]>([])
  const backTarget = computed(() => history.value.at(-1))
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
    const target = readTarget ?? (route.value ? targetForView(route.value) : undefined)
    if (!target) return
    const generation = ++navigationGeneration
    const result = await app.callServerTool(target, { timeout: 15_000 })
    if (result.isError) throw new Error(failureCode(result))
    const parsed = parseTrainingView(result.structuredContent)
    if (disposed || generation !== navigationGeneration) return
    route.value = parsed
    // Context is a canonical read summary; a host refusal never undoes a save.
    void app.updateModelContext({ structuredContent: modelContext(parsed) }).catch(() => {})
    readTarget = undefined
    stale.value = false
  }
  const navigate = async (target: PendingAction, replace = false) => {
    if (busy.value || pending.value || needsReadback.value) return
    if (!replace && route.value) history.value = [...history.value, targetForView(route.value)]
    readTarget = target
    saved.value = false
    await refresh()
  }
  const back = async () => {
    if (busy.value || pending.value || needsReadback.value) return
    const target = history.value.at(-1)
    history.value = history.value.slice(0, -1)
    if (target) await navigate(target, true)
  }
  const refresh = async () => {
    if (busy.value || pending.value) return
    busy.value = true
    try {
      const confirmingSave = needsReadback.value
      await read()
      if (confirmingSave) saved.value = true
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
      const metadata = result._meta?.['com.efitware/receipt']
      lastReceipt.value = typeof metadata === 'object' && metadata !== null && 'actionId' in metadata && typeof metadata.actionId === 'string' ? metadata.actionId : undefined
      if (pending.value.name === 'create_workout') {
        const content = result.structuredContent
        const id = typeof content === 'object' && content !== null && 'id' in content ? content.id : undefined
        if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id)) throw new Error('INVALID_CREATED_WORKOUT')
        if (route.value) history.value = [...history.value, targetForView(route.value)]
        sourceTemplateId.value = template.value?.record.id
        readTarget = { name: 'open_workout', arguments: { workoutId: id } }
      }
      pending.value = undefined
      needsReadback.value = true
      await read()
      needsReadback.value = false
      saved.value = true
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
    if (!validDay(date)) return
    pending.value = { name: 'create_workout', arguments: { date, sourceTemplateId: template.value.record.id,
      idempotencyKey: intentKey() } }
    return execute()
  }
  const createOccurrence = (scheduleId: string, date: string) => {
    if (!canWrite.value || pending.value || !validDay(date) || !/^[a-f0-9]{24}$/i.test(scheduleId)) return
    pending.value = { name: 'create_workout', arguments: { scheduleId, date, idempotencyKey: intentKey() } }
    return execute()
  }
  const updatePlanning = (patch: { enabled: boolean } | { status: 'active' | 'archived' }) => {
    const current = route.value
    if (!canWrite.value || pending.value || !current || (current.view !== 'program' && current.view !== 'schedule')) return
    pending.value = { name: `update_${current.view}`, arguments: { [`${current.view}Id`]: current.record.id,
      ...(current.view === 'schedule' ? { today: current.related.today } : {}), patch,
      expectedRevision: current.record.revision, idempotencyKey: intentKey() } }
    return execute()
  }
  const updateGoal = (status: 'active' | 'achieved' | 'abandoned') => {
    const current = route.value
    if (!canWrite.value || pending.value || current?.view !== 'goal') return
    pending.value = { name: 'update_goal', arguments: { goalId: current.record.id, patch: { status }, expectedRevision: current.record.revision, idempotencyKey: intentKey() } }
    return execute()
  }
  const addCheckIn = (input: { date: string, value?: string, note?: string }) => {
    const current = route.value
    if (!canWrite.value || pending.value || current?.view !== 'goal' || !validDay(input.date)) return
    pending.value = { name: 'create_goal_check_in', arguments: { goalId: current.record.id, ...input, idempotencyKey: intentKey() } }
    return execute()
  }
  const updateGoalPlan = (change: { status: 'active' | 'paused' | 'completed' | 'archived' } | { versionId: string }) => {
    const current = route.value
    if (!canWrite.value || pending.value || current?.view !== 'goal-plan' || current.record.managementMode !== 'manual') return
    pending.value = { name: 'versionId' in change ? 'activate_goal_plan_version' : 'set_goal_plan_status', arguments: { planId: current.record.id, ...change, expectedRevision: current.record.revision, idempotencyKey: intentKey() } }
    return execute()
  }
  const contextAction = (action: PendingAction) => {
    if (!canWrite.value || pending.value) return
    pending.value = { name: action.name, arguments: { ...action.arguments, idempotencyKey: intentKey() } }
    return execute()
  }
  const updateExercisePreference = (patch: { isFavorite?: boolean, hiddenFromSearch?: boolean }) => {
    const current = route.value
    if (current?.view !== 'exercise') return
    return contextAction({ name: 'update_exercise_preferences', arguments: { exerciseId: current.record.id, patch } })
  }
  const updatePreference = (patch: { unitSystem?: 'metric' | 'imperial', theme?: 'system' | 'light' | 'dark' }) => {
    if (route.value?.view !== 'context') return
    return contextAction({ name: 'update_preferences', arguments: { patch } })
  }
  const makeDefaultSpace = (id: string) => {
    const current = route.value
    if (current?.view !== 'context' || !current.record.trainingSpaces.some(space => space.id === id)) return
    return contextAction({ name: 'update_training_space', arguments: { trainingSpaceId: id, patch: { isDefault: true } } })
  }
  const saveMemory = (content: string) => {
    const current = route.value
    if (current?.view !== 'memory' || !content.trim() || content.length > 500) return
    return contextAction({ name: 'update_memory', arguments: { memoryId: current.record.id, content, expectedRevision: current.record.revision } })
  }
  const undoReceipt = (id: string) => {
    const current = route.value
    if (current?.view !== 'receipts' || !current.record.data.some(row => row.id === id && row.undoable)) return
    return contextAction({ name: 'undo_action', arguments: { actionId: id } })
  }
  const saveCommentary = (content: string) => {
    const current = route.value
    if (current?.view !== 'workout-review' || current.record.status !== 'completed' || !content.trim() || content.length > 2000) return
    return contextAction({ name: 'set_workout_commentary', arguments: { workoutId: current.record.id, content, expectedRevision: current.related.reflections.revision } })
  }
  const removeCommentary = () => {
    const current = route.value
    if (current?.view !== 'workout-review' || !current.related.reflections.revision) return
    return contextAction({ name: 'delete_workout_commentary', arguments: { workoutId: current.record.id, expectedRevision: current.related.reflections.revision } })
  }
  const setWorkoutStatus = (status: 'in_progress' | 'completed') => {
    const current = view.value?.workout
    if (!current || !canWrite.value) return
    if (status === 'in_progress' && current.status !== 'planned') return
    return contextAction({ name: status === 'in_progress' ? 'start_workout' : 'update_workout', arguments: { workoutId: current.id, ...(status === 'completed' ? { patch: { status } } : {}), expectedRevision: current.revision } })
  }
  const openSettings = (onboarding = false) => app.openLink({ url: `https://app.efitware.com/${onboarding ? 'onboarding' : 'settings'}` })
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
  return { route, lastReceipt, undoReceipt, saveCommentary, removeCommentary, setWorkoutStatus, openSettings, updateExercisePreference, updatePreference, makeDefaultSpace, saveMemory, updateGoal, addCheckIn, updateGoalPlan, back, backTarget, createOccurrence, updatePlanning, view, template, presentation, sourceTemplateId, createFromTemplate, sendFollowUp, navigate, host, connected, busy, error, saved, stale, pending, needsReadback, canWrite, start, close, mutate,
    retry: execute, refresh, open: (url = view.value && `https://app.efitware.com/workouts/${view.value.workout.date}/${view.value.workout.id}`) => url ? app.openLink({ url }) : undefined }
}
