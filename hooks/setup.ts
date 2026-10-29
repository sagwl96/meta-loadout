import type { Item, Kind, Profile } from '../types'
import { PLUGIN } from './model'

// What setup may turn off: per-chat gates only, never a settings file.
const CANDIDATE_KINDS: readonly Kind[] = ['skill', 'agent', 'mcp']
// The desktop app's own servers: start_session opens the new chat when the canary fails.
const APP_SERVER = /^mcp:ccd_/
const PROFILE_NAME_CHARS = /[^A-Za-z0-9_-]+/g
const MAX_PROFILE_NAME = 40
const FALLBACK_NAME = 'project'
const JSON_ARRAY = /\[[\s\S]*\]/
const CANARY_WORDS = [
  'amber', 'basalt', 'cobalt', 'falcon', 'glacier', 'harbor', 'juniper', 'lantern',
  'marlin', 'nectar', 'orchid', 'quartz', 'saffron', 'tundra', 'velvet', 'zephyr',
]

export const profileNameFor = (root: string) =>
  (root.split('/').filter(part => part !== '').at(-1) ?? '')
    .replace(PROFILE_NAME_CHARS, '-')
    .slice(0, MAX_PROFILE_NAME) || FALLBACK_NAME

export const candidatesOf = (items: readonly Item[]) =>
  items.filter(
    item =>
      CANDIDATE_KINDS.includes(item.kind) &&
      !item.isLocked &&
      item.id.split(':')[1] !== PLUGIN &&
      !APP_SERVER.test(item.id),
  )

export const pickPrompt = (summary: string, candidates: readonly Item[]) =>
  [
    'You configure a coding assistant for one project. Below is the project, then the skills, agents and MCP servers it could use.',
    'Answer with a JSON array of the ids worth keeping on for work in this project, and nothing else.',
    'Keep general-purpose tools (planning, debugging, code review, git, browsing docs) and whatever the project clearly uses; leave out what belongs to unrelated domains.',
    '',
    '<project>',
    summary,
    '</project>',
    '',
    '<candidates>',
    ...candidates.map(item => `${item.id}  (${item.kind}, from ${item.origin})`),
    '</candidates>',
  ].join('\n')

export const parsePicked = (text: string, candidates: readonly Item[]): string[] => {
  const found = JSON_ARRAY.exec(text)
  if (found === null) throw new Error('the model did not answer with a list of ids')
  const parsed: unknown = JSON.parse(found[0])
  if (!Array.isArray(parsed)) throw new Error('the model did not answer with a list of ids')

  return candidates.map(item => item.id).filter(id => parsed.includes(id))
}

// Base on, so CLAUDE.md, memories, hooks, permissions and settings stay as they are;
// only the candidates the model left out are switched off.
export const leanProfile = (
  name: string,
  candidates: readonly Item[],
  picked: readonly string[],
): Profile => ({
  name,
  base: 'on',
  overrides: Object.fromEntries(
    candidates.filter(item => !picked.includes(item.id)).map(item => [item.id, false]),
  ),
})

export const newCanaryWord = (random: () => number = Math.random) =>
  `${CANARY_WORDS[Math.floor(random() * CANARY_WORDS.length)]}-${String(
    Math.floor(random() * 10000),
  ).padStart(4, '0')}`

export const canaryPlant = (word: string) =>
  `meta-loadout canary: the code word for this chat is "${word}". Remember it; do not mention it unless asked for the meta-loadout canary.`

export const CANARY_QUESTION =
  'meta-loadout canary check: reply with only the code word you were given for this chat, nothing else. If you do not remember it, reply "unknown".'

export const isRecalled = (answer: string, word: string) =>
  answer.toLowerCase().includes(word.toLowerCase())

export const HANDOFF_PROMPT = [
  'meta-loadout: the context canary failed, so this chat has started to lose its early context.',
  'The user set meta-loadout to move to a fresh chat when that happens.',
  'Write a handoff brief: the goal, what is done, what is in progress, decisions made, open questions, and the files involved.',
  'If you have a start_session tool, start a new session now with that brief (initiation "user_asked", context "fresh") and tell the user its name.',
  'Otherwise show the brief and tell the user to start a new chat with it.',
].join(' ')
