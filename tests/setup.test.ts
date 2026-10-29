import { describe, expect, test } from 'claude-code/testing'

import type { Item } from '../types'
import {
  candidatesOf,
  isRecalled,
  leanProfile,
  newCanaryWord,
  parsePicked,
  profileNameFor,
} from '../hooks/setup'

const item = (id: string, kind: Item['kind'], isLocked = false): Item => ({
  id,
  kind,
  name: id.slice(id.indexOf(':') + 1),
  scope: 'user',
  origin: 'here',
  isLocked,
  isOn: true,
})

const ITEMS = [
  item('skill:pdf', 'skill'),
  item('skill:meta-loadout:open', 'skill'),
  item('mcp:github', 'mcp'),
  item('mcp:ccd_session', 'mcp'),
  item('agent:Explore', 'agent'),
  item('skill:locked', 'skill', true),
  item('plugin:ecc@ecc', 'plugin'),
  item('setting:theme', 'setting'),
]

describe('profileNameFor', () => {
  test('names the profile after the folder, in profile-name characters', () => {
    expect(profileNameFor('/work/my app.v2')).toBe('my-app-v2')
    expect(profileNameFor('/')).toBe('project')
    expect(profileNameFor(`/w/${'a'.repeat(60)}`)).toHaveLength(40)
  })
})

describe('candidatesOf', () => {
  test('offers unlocked skills, agents and MCP servers, never its own or the app servers', () => {
    expect(candidatesOf(ITEMS).map(one => one.id)).toEqual(['skill:pdf', 'mcp:github', 'agent:Explore'])
  })
})

describe('parsePicked', () => {
  const candidates = candidatesOf(ITEMS)

  test('keeps the known ids from a JSON array wrapped in prose', () => {
    expect(parsePicked('Here:\n["mcp:github", "skill:nope"]\nDone', candidates)).toEqual(['mcp:github'])
  })

  test('refuses a reply with no array', () => {
    expect(() => parsePicked('none of them', candidates)).toThrow('list of ids')
  })
})

describe('leanProfile', () => {
  test('turns off only the candidates left out, on an on base', () => {
    expect(leanProfile('app', candidatesOf(ITEMS), ['skill:pdf'])).toEqual({
      name: 'app',
      base: 'on',
      overrides: { 'mcp:github': false, 'agent:Explore': false },
    })
  })
})

describe('canary', () => {
  test('makes a word and number code word', () => {
    expect(newCanaryWord(() => 0)).toBe('amber-0000')
    expect(newCanaryWord(() => 0.99999)).toBe('zephyr-9999')
  })

  test('recalls the word in any case, inside other text', () => {
    expect(isRecalled('The word is Amber-0042.', 'amber-0042')).toBe(true)
    expect(isRecalled('unknown', 'amber-0042')).toBe(false)
  })
})
