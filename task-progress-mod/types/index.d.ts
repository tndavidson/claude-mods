export type TaskProgress = {
  task: string
  stage: string | null
  percent: number
  etaMinutes: number | null
  startedAt: number
  updatedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'task-progress': {
      task: TaskProgress | null
      now: number
      isHidden: boolean
    }
  }
}
