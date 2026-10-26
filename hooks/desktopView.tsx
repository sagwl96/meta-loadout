import type { Elements } from 'claude-code'

import type { Item, Kind, Profile, Scope } from '../types'
import { KIND_LABELS, LEVELS, SCOPES, isFixedProfile, levelOf } from './model'
import { projectLabel } from './project'
import {
  ACTION_KEY_PREFIX,
  ACTION_LABELS,
  ALL,
  NAME_FIELDS,
  PICKER_KEY_PREFIX,
  PROFILE_KEY_PREFIX,
  UNSET_KEY_PREFIX,
  actionsOf,
  bindingLabel,
  chatAccessLabel,
  clipEnd,
  isUnsettable,
  fileLinkOf,
  linesOf,
  matchesQuery,
  withToggledSection,
} from './view'
import type { ItemLine, PaneActions, PaneModel, SectionLine } from './view'

export type DesktopElements = Pick<
  Elements['desktop'],
  'Box' | 'Text' | 'Button' | 'Input' | 'Select' | 'Link'
>

const DESKTOP_PAGE_SIZE = 40
// One accent (the app's own orange) for what matters now: the applied profile,
// section titles, counts of what is on. Everything else stays neutral.
const ACCENT = 'claude'
const CARD = { borderStyle: 'round', borderColor: 'promptBorder', padding: 1, gap: 1 } as const
const HERO = { ...CARD, borderColor: ACCENT } as const
const CHIP = { borderStyle: 'round', paddingX: 1 } as const
const KINDS_IN_GROUPS: readonly Kind[] = ['skill', 'agent', 'mcp']
const STANDALONE = 'Standalone'
const NAMESPACE_END = ':'
const ROW_HOVER = { backgroundColor: 'subtle' } as const
const sourceOf = ({ name }: Item) =>
  name.includes(NAMESPACE_END) ? name.slice(0, name.indexOf(NAMESPACE_END)) : STANDALONE

const CREATE_OPTIONS = [
  { value: 'off', label: 'Everything off' },
  { value: 'on', label: 'Everything on' },
]
const NAME_NOTICE_LIMIT = 200
const APPLIED_SUFFIX = ' (applied)'
const LEVEL_HINTS = {
  chat: 'This chat only',
  project: 'Every chat in this project',
  global: 'Everywhere else',
} as const
const capitalized = (word: string) => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`

export const drawDesktopPane = (
  { Box, Text, Button, Input, Select, Link }: DesktopElements,
  {
    items,
    root,
    projects,
    profiles,
    profile,
    applied,
    bindings,
    isOn,
    view,
    isChatUnlocked,
  }: PaneModel,
  actions: PaneActions,
) => {
  const query = view.query.trim()
  const lines = linesOf(items, isOn, view, query)
  const pages = Math.max(1, Math.ceil(lines.length / DESKTOP_PAGE_SIZE))
  const page = Math.min(view.page, pages - 1)
  const shownLines = lines.slice(page * DESKTOP_PAGE_SIZE, (page + 1) * DESKTOP_PAGE_SIZE)
  const shownProject = view.project === '' ? root : view.project
  const isRenaming =
    view.edit === 'rename' &&
    !isFixedProfile(view.target) &&
    profiles.some(one => one.name === view.target)
  const isCreating = view.edit === 'create-on' || view.edit === 'create-off'
  const createBase = view.edit === 'create-on' ? 'on' : 'off'
  const profileOptions = profiles.map((one: Profile) => ({
    value: one.name,
    label: one.name === applied ? `${one.name}${APPLIED_SUFFIX}` : one.name,
  }))
  const projectOptions = [...new Set([root, ...projects, shownProject])].map(path => ({
    value: path,
    label: projectLabel(path, root),
  }))
  const scopeOptions = [
    { value: ALL, label: 'All scopes' },
    ...SCOPES.filter(scope => items.some(item => item.scope === scope)).map(scope => ({
      value: scope,
      label: scope,
    })),
  ]

  const chip = (key: string, label: string, color?: string) => (
    <Box key={key} {...CHIP} borderColor={color ?? 'promptBorder'}>
      <Text color={color} wrap="truncate-end">
        {label}
      </Text>
    </Box>
  )

  const title = (label: string, hint?: string) => (
    <Box flexDirection="column">
      <Text bold color={ACCENT}>
        {label}
      </Text>
      {hint !== undefined && <Text dimColor>{hint}</Text>}
    </Box>
  )

  const drawNameField = (edit: keyof typeof NAME_FIELDS, onSubmit: (name: string) => void) => (
    <Box flexDirection="row" gap={1} alignItems="flex-end">
      <Input
        key={NAME_FIELDS[edit].key}
        label={`${NAME_FIELDS[edit].verb} "${view.target}"`}
        placeholder="name"
        {...(edit === 'rename' ? { value: view.target } : {})}
        submitLabel={NAME_FIELDS[edit].submitLabel}
        autoFocus
        onSubmit={onSubmit}
      />
      <Button
        key="cancel-edit"
        label="Cancel"
        variant="secondary"
        onPress={() => actions.onView({ edit: 'none' })}
      />
    </Box>
  )

  const inScope = (kind: Kind) =>
    items.filter(
      item =>
        item.kind === kind &&
        (view.scope === ALL || item.scope === view.scope) &&
        matchesQuery(item, query),
    )

  const drawBulk = (key: string, among: readonly Item[]) => {
    const free = among.filter(item => !item.isLocked)
    const drawOne = (isTarget: boolean, label: string) => {
      const ids = free.filter(item => isOn(item) !== isTarget).map(item => item.id)

      return ids.length === 0 ? null : (
        <Button
          key={`${isTarget ? 'bulk-on' : 'bulk-off'}:${key}`}
          plain
          label={label}
          onPress={() => actions.onSetMany(ids, isTarget)}
        />
      )
    }

    return (
      <Box flexDirection="row" gap={1}>
        {drawOne(true, 'All on')}
        {drawOne(false, 'All off')}
      </Box>
    )
  }

  const drawSectionHeader = ({ kind, isOpen, count, offCount }: SectionLine) => (
    <Box flexDirection="row" justifyContent="space-between" alignItems="center">
      <Button
        key={`section:${kind}`}
        plain
        label={`${isOpen ? '▾' : '▸'}  ${KIND_LABELS[kind]}`}
        // a search shows every matching section open, so a press would change view.open unseen
        onPress={() =>
          view.query.trim() === ''
            ? actions.onView({ open: withToggledSection(view.open, kind), page })
            : undefined
        }
      />
      <Box flexDirection="row" gap={2} alignItems="center">
        {chip(`count:${kind}`, `${count - offCount} of ${count} on`, offCount < count ? ACCENT : undefined)}
        {isOpen && drawBulk(kind, inScope(kind))}
      </Box>
    </Box>
  )

  const drawItem = ({ item }: ItemLine) => {
    const isItemOn = isOn(item)
    const fileLink = fileLinkOf(item.origin)

    return (
      <Box
        key={`row:${item.id}`}
        flexDirection="row"
        gap={2}
        justifyContent="space-between"
        alignItems="center"
        paddingX={1}
        hover={ROW_HOVER}
      >
        <Box flexDirection="column" flexShrink={1}>
          <Text bold={isItemOn} dimColor={!isItemOn} wrap="truncate-end">
            {item.name}
          </Text>
          <Text dimColor wrap="truncate-start">
            {fileLink === undefined ? (
              item.origin
            ) : (
              <Link href={fileLink} label={item.origin} />
            )}
          </Text>
        </Box>
        <Box flexDirection="row" gap={2} alignItems="center">
          {chip(`scope:${item.id}`, item.scope)}
          {item.isLocked ? (
            <Text dimColor italic>
              Locked
            </Text>
          ) : (
            <Button
              key={`toggle:${item.id}`}
              label={isItemOn ? 'On' : 'Off'}
              variant={isItemOn ? 'primary' : 'secondary'}
              onPress={() => actions.onToggle(item.id)}
            />
          )}
        </Box>
      </Box>
    )
  }

  const drawRows = (kind: Kind, rows: ItemLine[]) => {
    if (!KINDS_IN_GROUPS.includes(kind)) return rows.map(drawItem)
    const sources = [...new Set(rows.map(({ item }) => sourceOf(item)))]

    return sources.map(source => {
      const among = inScope(kind).filter(item => sourceOf(item) === source)
      const onCount = among.filter(isOn).length

      return (
        <Box key={`group:${kind}:${source}`} flexDirection="column" gap={1}>
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            paddingTop={1}
          >
            <Text bold>{source}</Text>
            <Box flexDirection="row" gap={2} alignItems="center">
              <Text dimColor>{`${onCount} of ${among.length} on`}</Text>
              {among.length > 1 && drawBulk(`${kind}:${source}`, among)}
            </Box>
          </Box>
          {rows.filter(({ item }) => sourceOf(item) === source).map(drawItem)}
        </Box>
      )
    })
  }

  const drawCards = () => {
    const groups: { header?: SectionLine; rows: ItemLine[] }[] = []
    for (const line of shownLines) {
      const last = groups[groups.length - 1]
      if ('kind' in line) groups.push({ header: line, rows: [] })
      else if (line.isInSection && last !== undefined) last.rows.push(line)
      else groups.push({ rows: [line] })
    }

    return groups.map(({ header, rows }) =>
      header === undefined ? (
        <Box key={`loose:${rows[0]?.item.id}`}>{rows.map(drawItem)}</Box>
      ) : (
        <Box key={`card:${header.kind}`} flexDirection="column" {...CARD}>
          {drawSectionHeader(header)}
          {drawRows(header.kind, rows)}
        </Box>
      ),
    )
  }

  return (
    <Box flexDirection="column" gap={2} padding={1}>
      <Box key="hero" flexDirection="column" {...HERO}>
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1}
        >
          <Box flexDirection="column">
            <Text bold color={ACCENT}>
              Meta Loadout
            </Text>
            <Text dimColor>Profiles for your skills, MCP servers, plugins and settings</Text>
          </Box>
          <Box flexDirection="row" gap={1} alignItems="center">
            <Button
              key="chat-access"
              variant={isChatUnlocked ? 'primary' : 'secondary'}
              label={chatAccessLabel(isChatUnlocked)}
              onPress={() => actions.onChatAccess(!isChatUnlocked)}
            />
            <Button key="refresh" variant="secondary" label="Refresh" onPress={actions.onRefresh} />
          </Box>
        </Box>
        <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
          <Text dimColor>Applied</Text>
          {chip('applied', applied, ACCENT)}
          <Text dimColor>
            {levelOf(bindings) === 'global' ? 'globally' : `for this ${levelOf(bindings)}`}
          </Text>
        </Box>
      </Box>
      <Box key="levels" flexDirection="column" {...CARD}>
        {title('Where it applies', 'The most specific level that is set wins.')}
        <Box flexDirection="row" gap={2} flexWrap="wrap">
          {LEVELS.map(level => {
            const isWinning = levelOf(bindings) === level

            return (
              <Box
                key={`binding:${level}`}
                flexDirection="column"
                {...CHIP}
                paddingY={1}
                minWidth={22}
                borderColor={isWinning ? ACCENT : 'promptBorder'}
              >
                <Box flexDirection="row" justifyContent="space-between" gap={1}>
                  <Text bold color={isWinning ? ACCENT : undefined}>
                    {capitalized(level)}
                  </Text>
                  {isUnsettable(bindings, level) && (
                    <Button
                      key={`${UNSET_KEY_PREFIX}${level}`}
                      plain
                      label="Unset"
                      onPress={() => actions.onUnset(level)}
                    />
                  )}
                </Box>
                <Text>{bindingLabel(bindings, level)}</Text>
                <Text dimColor>{LEVEL_HINTS[level]}</Text>
              </Box>
            )
          })}
        </Box>
      </Box>
      <Box key="profile-card" flexDirection="column" {...CARD}>
        {title('Profile', 'Pick a profile to see and change what it turns on.')}
        <Box flexDirection="row" gap={2} alignItems="flex-end" flexWrap="wrap">
          <Select
            key="profile-select"
            label="Profile"
            options={profileOptions}
            value={profile.name}
            onSelect={name =>
              actions.onView({
                viewed: name,
                ...(view.edit === 'menu' ? { edit: 'none' as const } : {}),
              })
            }
          />
          {actionsOf(profile.name).flatMap(action => [
            ...(action === 'duplicate'
              ? [
                  <Button
                    key="new-profile-from-scratch"
                    label="New profile"
                    variant="secondary"
                    onPress={() => actions.onView({ edit: 'create-off' })}
                  />,
                ]
              : []),
            <Button
              key={`${ACTION_KEY_PREFIX}${action}`}
              label={ACTION_LABELS[action]}
              variant={action === 'apply-chat' ? 'primary' : 'secondary'}
              onPress={() => actions.onAction(profile.name, action)}
            />,
          ])}
        </Box>
        {view.edit === 'new' && drawNameField('new', actions.onCreate)}
        {isCreating && (
          <Box flexDirection="row" gap={1} alignItems="flex-end" flexWrap="wrap">
            <Input
              key="create-profile-name"
              label="New profile name"
              placeholder="name"
              submitLabel="create"
              autoFocus
              onSubmit={name => actions.onCreateNew(name, createBase)}
            />
            <Select
              key="create-base"
              label="Start with"
              options={CREATE_OPTIONS}
              value={createBase}
              onSelect={value =>
                actions.onView({ edit: value === 'on' ? 'create-on' : 'create-off' })
              }
            />
            <Button
              key="cancel-create"
              label="Cancel"
              variant="secondary"
              onPress={() => actions.onView({ edit: 'none' })}
            />
          </Box>
        )}
        {isRenaming && drawNameField('rename', actions.onRename)}
      </Box>
      {view.notice !== '' && (
        <Box key="notice" {...CHIP} paddingY={1} borderColor={ACCENT}>
          <Text>{clipEnd(view.notice, NAME_NOTICE_LIMIT)}</Text>
        </Box>
      )}
      <Box key="filters" flexDirection="column" {...CARD}>
        {title('Elements', `In ${projectLabel(shownProject, root)}`)}
        <Box flexDirection="row" gap={2} alignItems="flex-end" flexWrap="wrap">
          <Input
            key="search"
            label="Search skills, plugins, MCP…"
            placeholder="Search skills, plugins, MCP…"
            value={view.query}
            onInput={value => actions.onView({ query: value, page: 0 })}
            onSubmit={value => actions.onView({ query: value, page: 0 })}
          />
          {view.query !== '' && (
            <Button
              key="search-clear"
              label="Clear"
              variant="secondary"
              onPress={() => actions.onView({ query: '', page: 0 })}
            />
          )}
          <Select
            key={`${PICKER_KEY_PREFIX}project`}
            label="Project"
            options={projectOptions}
            value={shownProject}
            onSelect={actions.onProject}
          />
          <Select
            key={`${PICKER_KEY_PREFIX}scope`}
            label="Scope"
            options={scopeOptions}
            value={view.scope}
            onSelect={value =>
              actions.onView({ scope: value as Scope | 'all', page: 0, picker: 'none' })
            }
          />
        </Box>
      </Box>
      {lines.length === 0 && (
        <Text dimColor>
          {query === '' ? 'Nothing here in this scope.' : `No elements match “${query}”.`}
        </Text>
      )}
      {drawCards()}
      {pages > 1 && (
        <Box flexDirection="row" gap={2} justifyContent="center" alignItems="center">
          <Button
            key="prev"
            label="Prev"
            variant="secondary"
            onPress={() => actions.onView({ page: Math.max(0, page - 1) })}
          />
          <Text dimColor>
            page {page + 1}/{pages}
          </Text>
          <Button
            key="next"
            label="Next"
            variant="secondary"
            onPress={() => actions.onView({ page: Math.min(pages - 1, page + 1) })}
          />
        </Box>
      )}
    </Box>
  )
}
