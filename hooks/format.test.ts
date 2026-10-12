import { describe, expect, test } from 'claude-code/testing'
import type { TaskProgress } from '../types'
import {
  barText,
  etaLabel,
  formatAge,
  formatClock,
  isStale,
  minutesLeft,
  parseReport,
} from './format'

const MIN = 60_000

const task = (overrides: Partial<TaskProgress> = {}): TaskProgress => ({
  task: 'Benchmark',
  stage: 'load test',
  percent: 58,
  etaMinutes: 6,
  startedAt: 0,
  updatedAt: 8 * MIN,
  ...overrides,
})

describe('parseReport', () => {
  test('accepts a full report and clamps percent', () => {
    const parsed = parseReport({ task: ' Deploy ', percent: 140, etaMinutes: 2.6, stage: 'push' })
    expect(parsed).toEqual({
      ok: true,
      value: { task: 'Deploy', percent: 100, etaMinutes: 3, stage: 'push', done: false },
    })
  })

  test('fills optional fields and reads done', () => {
    expect(parseReport({ task: 'Build', done: true })).toEqual({
      ok: true,
      value: { task: 'Build', percent: 100, etaMinutes: null, stage: null, done: true },
    })
    expect(parseReport({ task: 'Build' })).toEqual({
      ok: true,
      value: { task: 'Build', percent: 0, etaMinutes: null, stage: null, done: false },
    })
  })

  test('rejects a missing task or bad numbers', () => {
    expect(parseReport({})).toEqual({ ok: false, error: 'task must be a non-empty string' })
    expect(parseReport({ task: 'x', percent: 'half' })).toEqual({ ok: false, error: 'percent must be a number' })
    expect(parseReport({ task: 'x', etaMinutes: -1 })).toEqual({ ok: false, error: 'etaMinutes must be a number of 0 or more' })
    expect(parseReport(null)).toEqual({ ok: false, error: 'input must be an object' })
  })
})

describe('time', () => {
  test('minutesLeft counts down from the last report', () => {
    expect(minutesLeft(task(), 8 * MIN)).toBe(6)
    expect(minutesLeft(task(), 10.4 * MIN)).toBe(4)
    expect(minutesLeft(task(), 30 * MIN)).toBe(0)
    expect(minutesLeft(task({ etaMinutes: null }), 8 * MIN)).toBe(null)
  })

  test('etaLabel reads in minutes', () => {
    expect(etaLabel(6)).toBe('~6 min left')
    expect(etaLabel(1)).toBe('~1 min left')
    expect(etaLabel(0)).toBe('under a minute')
    expect(etaLabel(null)).toBe('')
  })

  test('formatClock gives m:ss and h:mm:ss', () => {
    expect(formatClock(8 * MIN + 12_000)).toBe('8:12')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(62 * MIN + 3_000)).toBe('1:02:03')
  })

  test('formatAge reads seconds then minutes', () => {
    expect(formatAge(41_000)).toBe('updated 41s ago')
    expect(formatAge(3 * MIN + 10_000)).toBe('updated 3 min ago')
  })

  test('isStale after the configured minutes', () => {
    expect(isStale(task(), 8 * MIN + 2 * MIN, 3)).toBe(false)
    expect(isStale(task(), 8 * MIN + 3 * MIN, 3)).toBe(true)
  })
})

describe('barText', () => {
  test('fills cells by percent', () => {
    expect(barText(50, 10)).toBe('█████░░░░░')
    expect(barText(0, 4)).toBe('░░░░')
    expect(barText(100, 4)).toBe('████')
    expect(barText(58, 10)).toBe('██████░░░░')
  })
})
