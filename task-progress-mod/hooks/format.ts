import type { TaskProgress } from '../types'

const MINUTE_MS = 60_000

export type Report = {
  task: string
  percent: number
  etaMinutes: number | null
  stage: string | null
  done: boolean
}

export type ParsedReport = { ok: true; value: Report } | { ok: false; error: string }

/** Reads the model's `report_progress` input into a Report, or says what is wrong with it. */
export function parseReport(input: unknown): ParsedReport {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'input must be an object' }
  const raw = input as Record<string, unknown>
  const task = typeof raw.task === 'string' ? raw.task.trim() : ''
  if (task === '') return { ok: false, error: 'task must be a non-empty string' }
  const done = raw.done === true
  if (raw.percent !== undefined && typeof raw.percent !== 'number') {
    return { ok: false, error: 'percent must be a number' }
  }
  if (raw.etaMinutes !== undefined && raw.etaMinutes !== null) {
    if (typeof raw.etaMinutes !== 'number' || raw.etaMinutes < 0) {
      return { ok: false, error: 'etaMinutes must be a number of 0 or more' }
    }
  }
  const percent = done ? 100 : clampPercent(typeof raw.percent === 'number' ? raw.percent : 0)
  const etaMinutes = typeof raw.etaMinutes === 'number' ? Math.round(raw.etaMinutes) : null
  const stage = typeof raw.stage === 'string' && raw.stage.trim() !== '' ? raw.stage.trim() : null
  return { ok: true, value: { task, percent, etaMinutes, stage, done } }
}

export function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

/** Minutes left: the last reported ETA less the time since that report, never below 0. */
export function minutesLeft(task: TaskProgress, now: number): number | null {
  if (task.etaMinutes === null) return null
  const elapsedSince = Math.max(0, now - task.updatedAt) / MINUTE_MS
  return Math.max(0, Math.round(task.etaMinutes - elapsedSince))
}

export function etaLabel(minutes: number | null): string {
  if (minutes === null) return ''
  if (minutes === 0) return 'under a minute'
  return `~${minutes} min left`
}

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatAge(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `updated ${seconds}s ago`
  return `updated ${Math.floor(seconds / 60)} min ago`
}

export function isStale(task: TaskProgress, now: number, staleAfterMinutes: number): boolean {
  return now - task.updatedAt >= staleAfterMinutes * MINUTE_MS
}

/** A bar of `width` cells, the first `percent` of them filled. */
export function barText(percent: number, width: number): string {
  const filled = Math.round((clampPercent(percent) / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}
