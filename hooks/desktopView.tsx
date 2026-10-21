import type { Elements } from 'claude-code'

import type { Item, Kind, Profile, Scope } from '../types'
import { KIND_LABELS, SCOPES, isFixedProfile } from './model'
import { projectLabel } from './project'
import {
  ACTION_KEY_PREFIX,
  ALL,
  NAME_FIELDS,
  PICKER_KEY_PREFIX,
  PROFILE_KEY_PREFIX,
  actionsOf,
  clipEnd,
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
const CARD = { borderStyle: 'round', borderColor: 'promptBorder', padding: 1, gap: 1 } as const
const KINDS_IN_GROUPS: readonly Kind[] = ['skill', 'agent', 'mcp']
const STANDALONE = 'Standalone'
const NAMESPACE_END = ':'
const ROW_HOVER = { backgroundColor: 'subtle' } as const
const ACTION_LABELS = {
  apply: 'Apply',
  duplicate: 'Duplicate',
  rename: 'Rename',
  delete: 'Delete',
} as const
const sourceOf = ({ name }: Item) =>
  name.includes(NAMESPACE_END) ? name.slice(0, name.indexOf(NAMESPACE_END)) : STANDALONE

const CREATE_OPTIONS = [
  { value: 'off', label: 'Everything off' },
  { value: 'on', label: 'Everything on' },
]
const NAME_NOTICE_LIMIT = 200
const APPLIED_SUFFIX = ' (applied)'

export const drawDesktopPane = (
  { Box, Text, Button, Input, Select, Link }: DesktopElements,
  { items, root, projects, profiles, profile, applied, isOn, view }: PaneModel,
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
        label={`${isOpen ? '▾' : '▸'} ${KIND_LABELS[kind]}`}
        // a search shows every matching section open, so a press would change view.open unseen
        onPress={() =>
          view.query.trim() === ''
            ? actions.onView({ open: withToggledSection(view.open, kind), page })
            : undefined
        }
      />
      <Box flexDirection="row" gap={2} alignItems="center">
        <Text backgroundColor="subtle">{` ${count - offCount}/${count} on `}</Text>
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
        hover={ROW_HOVER}
      >
        <Box flexDirection="column" flexShrink={1}>
          <Text dimColor={!isItemOn} wrap="truncate-end">
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
          <Text backgroundColor="subtle">{` ${item.scope} `}</Text>
          {item.isLocked ? (
            <Text dimColor>Locked</Text>
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
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text dimColor>{source}</Text>
            <Box flexDirection="row" gap={2} alignItems="center">
              <Text dimColor>{`${onCount}/${among.length} on`}</Text>
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
    <Box flexDirection="column" gap={1} padding={1}>
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Box flexDirection="row" gap={2} alignItems="center">
          <Text bold>Meta Loadout</Text>
          <Text color="success">{` ${applied} `}</Text>
        </Box>
        <Button key="refresh" plain label="Refresh" onPress={actions.onRefresh} />
      </Box>
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
          key="profile-select"
          label="Profile"
          options={profileOptions}
          value={profile.name}
          onSelect={name =>
            actions.onView({ viewed: name, ...(view.edit === 'menu' ? { edit: 'none' as const } : {}) })
          }
        />
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
            variant={action === 'apply' ? 'primary' : 'secondary'}
            onPress={() => actions.onAction(profile.name, action)}
          />,
        ])}
      </Box>
      {view.edit === 'new' && drawNameField('new', actions.onCreate)}
      {isCreating && (
        <Box flexDirection="row" gap={1} alignItems="flex-end">
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
      {view.notice !== '' && <Text dimColor>{clipEnd(view.notice, NAME_NOTICE_LIMIT)}</Text>}
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
