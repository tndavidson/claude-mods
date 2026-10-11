export type Suggestion = { label: string; prompt: string }

declare module 'claude-code' {
  interface PluginState {
    'prompt-suggestions': {
      suggestions: Suggestion[]
      turnId: string | null
      isHidden: boolean
      isLoading: boolean
    }
  }
}
