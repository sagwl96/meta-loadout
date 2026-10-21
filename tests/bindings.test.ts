import { describe, expect, test } from 'claude-code/testing'

import {
  INITIAL_PROFILES,
  appliedNameFor,
  bindingMapOf,
  effectiveName,
  governingName,
  knownBindings,
  levelOf,
  projectKeyOf,
  renamedInMap,
  withBinding,
  withoutName,
} from '../hooks/model'
import type { Bindings, Item } from '../types'

const NONE: Bindings = { chat: '', project: '', global: 'default' }
const ALL_SET: Bindings = { chat: 'c', project: 'p', global: 'g' }
const SKILL: Item = {
  id: 'skill:x',
  kind: 'skill',
  name: 'x',
  scope: 'user',
  origin: '',
  isLocked: false,
  isOn: true,
}
const entryItem = (source: 'user' | 'project' | 'local'): Item => ({
  ...SKILL,
  kind: 'permission',
  entry: { mode: 'element', source, path: ['permissions', 'deny'], value: 'Read(.env)' },
})

describe('levels', () => {
  test('the chat wins over the project, the project over the global profile', () => {
    expect(levelOf(ALL_SET)).toBe('chat')
    expect(levelOf({ ...ALL_SET, chat: '' })).toBe('project')
    expect(levelOf(NONE)).toBe('global')
    expect(effectiveName({ ...ALL_SET, chat: '' })).toBe('p')
  })

  test('user settings follow the global profile, project settings the project one', () => {
    expect(governingName(ALL_SET, 'user')).toBe('g')
    expect(governingName(ALL_SET, 'project')).toBe('p')
    expect(governingName(ALL_SET, 'local')).toBe('p')
    expect(governingName({ ...ALL_SET, project: '' }, 'local')).toBe('g')
  })

  test('a gate follows the chat; a settings entry never does', () => {
    expect(appliedNameFor(ALL_SET, SKILL)).toBe('c')
    expect(appliedNameFor(ALL_SET, entryItem('user'))).toBe('g')
    expect(appliedNameFor(ALL_SET, entryItem('project'))).toBe('p')
  })

  test('drops bindings to profiles that are gone', () => {
    expect(knownBindings(INITIAL_PROFILES, { chat: 'gone', project: 'vanilla', global: 'gone' })).toEqual({
      chat: '',
      project: 'vanilla',
      global: 'default',
    })
  })

  test('a worktree of a project keys to the project', () => {
    expect(projectKeyOf('/work/app/.claude/worktrees/fix')).toBe('/work/app')
    expect(projectKeyOf('/work/app')).toBe('/work/app')
  })
})

describe('binding maps', () => {
  test('keeps only valid names from the store', () => {
    expect(bindingMapOf({ a: 'ok', b: 'not ok!', c: 3 })).toEqual({ a: 'ok' })
    expect(bindingMapOf(['a'])).toEqual({})
  })

  test('sets, clears, renames and forgets a binding', () => {
    const map = withBinding({ a: 'x' }, 'b', 'y')

    expect(map).toEqual({ a: 'x', b: 'y' })
    expect(withBinding(map, 'a', '')).toEqual({ b: 'y' })
    expect(renamedInMap(map, 'x', 'z')).toEqual({ a: 'z', b: 'y' })
    expect(withoutName(map, 'y')).toEqual({ a: 'x' })
  })

  test('keeps the most recent 500 bindings', () => {
    const many = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`k${i}`, 'p']))
    const kept = withBinding(many, 'new', 'p')

    expect(Object.keys(kept)).toHaveLength(500)
    expect(kept.k0).toBeUndefined()
    expect(kept.new).toBe('p')
  })
})
