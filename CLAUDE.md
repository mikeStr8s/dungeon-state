# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Living Dungeon Engine** — a Dungeon Master's tool that acts as the persistent source
of truth for an evolving megadungeon. The published adventure is the initial state; from
session one, the app _is_ the dungeon and its state evolves over in-game time. It
automates bookkeeping (torches, patrols, factions, timers) — it never authors narrative.

**All 7 roadmap phases are built** (the original vision is in `AI_GENERATED_PROMPT.md`):
persistent world + event log, time engine (torches/spells), movement & fog-of-war
exploration, monsters (patrols) + wandering encounters, factions (propose → DM approves),
context dashboard + global search + filterable history + non-destructive rollback/undo,
adventure import (JSON/YAML) + library + export, and a plugin framework (bundled
environmental/flooding plugin). ~63 unit tests + 11 Puppeteer e2e flows, all green.

## Commands (runtime is **bun**)

```sh
bun run dev            # dev server
bun run build          # prod build (adapter-auto; "no platform detected" warning is expected)
bun run preview        # serve the prod build
bun run check          # svelte-kit sync + svelte-check (types)
bun run lint           # prettier --check
bun run format         # prettier --write
bun run test           # vitest run (unit — engine + persistence + plugins)
bun run test:watch     # vitest watch
bun run test:e2e       # vite build + Puppeteer flows against a preview server
```

Run a single unit test: `bunx vitest run src/lib/engine/time.test.ts` (or `-t "<name>"`
to filter). E2E Chromium: `puppeteer-core` drives `/usr/bin/chromium` — override with
`PUPPETEER_EXECUTABLE_PATH`. E2E screenshots land in `e2e/screenshots/` (gitignored).

## Architecture — event-sourced spine

Everything hinges on one idea: **time drives everything, and every change is an event.**
State is never authoritative — it is the fold of an append-only event log.

Layers (strictly separated):

- `src/lib/engine/` — pure TS, **zero Svelte imports**, fully unit-tested. The whole
  simulation lives here (entities, events/reducers, time + systems, factions, search,
  pack validation, plugin registry).
- `src/lib/persistence/` — IndexedDB adapter + JSON save-file/pack export/import. Browser-only.
- `src/lib/state/worldStore.svelte.ts` — Svelte 5 runes bridge. Reactivity + persistence
  glue ONLY; no simulation logic.
- `src/lib/plugins/` — bundled example plugins (app layer); `src/routes/` +
  `src/lib/components/` — dashboard UI.

### The event-sourcing rules (do not violate)

1. **All state change flows through events → reducers.** `apply(state, event)` in
   `engine/reducers.ts` is the single place state mutates, and it is **pure/immutable**
   (clones entities, returns new state). Never mutate `WorldState` directly elsewhere.
   The event set: `WorldInitialized`, `TimeAdvanced`, `Light{Lit,Extinguished,Expired}`,
   `Effect{Started,Expired}`, `EntityStateChanged`, `EntityMoved`, `EntitySpawned`,
   `EntityDataChanged` (generic data-merge), `NoteAdded`, `RolledBack`.
2. **`WorldInitialized` carries the whole content pack.** Always log entry 0; its reducer
   builds entities + captures immutable `canon`, and (if the pack has `startRoom`) creates
   the `party` entity. Persistence only stores events — folding reconstructs everything.
3. **Canon vs overlay:** `state.canon.entities` is the "as published" snapshot (never
   changes); `state.entities` is the live overlay. UI shows both (`RoomPanel.svelte`).
4. **Time is the only driver.** `advanceTime(state, deltaMinutes)` in `engine/time.ts`
   appends `TimeAdvanced`, then iterates **`activeSystems()`** (built-ins + enabled plugin
   systems, priority-sorted) applying each produced event so later systems see earlier
   ones' effects. Returns a notification summary (filtered by `isNotable`). Party travel
   advances time too, so patrols/wandering/factions all tick during movement.
5. **Determinism:** seeded RNG (`engine/rng.ts`, in world). Time-driven randomness uses
   the stateless `rngAt(seed, minute, salt)` so replay reproduces exactly. `id`/`realTs`
   on events are non-semantic; `makeEvent` takes an injectable `realTs` for tests.
6. **Rollback is non-destructive.** Never physically delete events. `store.rollbackTo` /
   `undo` append a `RolledBack{toEventId}` marker; `fold` derives state from
   `activeEvents(log)` (markers honored) but keeps the **full** log for audit
   (`activeEventIds` marks which are live so History greys the cancelled ones).

### Extending the engine

- **New behavior over time — prefer a plugin or a system.** Implement the `System`
  interface (`run(state, from, to) => Event[]`), then either add it to `builtinSystems`
  in `engine/systems/index.ts` or ship it in a `Plugin` via `registerPlugin`
  (`engine/plugins.ts`) — `activeSystems()` merges both by `priority` (lower first).
  Timers fire on the half-open interval via `crossed(at, from, to)` (`engine/scheduler.ts`).
- **New plugin:** a `Plugin { id, name, description, systems?, factionRules? }`; register
  it as an import side-effect (see `src/lib/plugins/index.ts`, imported once by the store).
  Enable/disable is runtime config, never event-sourced. Plugins should emit **existing**
  event types so a save folds even without the plugin loaded.
- **New faction suggestion:** add a `FactionRule` (built-in in `engine/factions.ts` or via
  a plugin) — `proposeFactionActions` merges them. Proposals are derived, not events;
  approving one commits its `build(state)` events.
- **New event type** (rare — most changes reuse the generic `EntityDataChanged` /
  `EntityStateChanged`): add to `EventType` (`types.ts`) + `PayloadMap`/payload
  (`events.ts`) + a `case` in `apply` (`reducers.ts`). Entities are generic
  `{ kind, state, data, relationships }` records — no schema migration.
- **Content packs** (`src/lib/content/`, JSON/YAML) are validated by `validatePack`
  (`engine/packIO.ts`, full referential checks) and never contain engine logic.
  `packFromState` exports the live world back to a pack.

### Persistence ordering gotcha

`persistence/db.ts` keys the event store by **auto-increment (insertion order)** and
`loadEvents()` returns that order. Many events share the same in-game `at`, so **never
sort the stored log by `at`** — causal insertion order is what makes `fold` correct.
(History _display_ sorts by `at` for readability; the log itself must not be reordered.)

## Project conventions / gotchas

- **Import extensions:** relative imports use explicit `.ts` (e.g. `./events.ts`) — tsconfig
  has `rewriteRelativeImportExtensions`. But `$lib/*` alias imports must have **no
  extension** (`$lib/state/worldStore.svelte`, not `.svelte.ts`). Mixing this up fails
  `svelte-check`.
- **Svelte 5 runes mode is forced** for app code (`vite.config.ts`). Runes state outside
  `.svelte` components lives in `.svelte.ts` modules (see the store).
- **Browser-only code** (IndexedDB, downloads) must be guarded by `import { browser }
from '$app/environment'`; the store's `init()` runs from `onMount`. SSR renders the
  "Loading campaign…" shell.
- **Theme:** a vendored, framework-agnostic Tokyonight terminal theme in `src/lib/theme/`
  (imported in `+layout.svelte`). Style with its tokens/classes (`--color-*`, `.panel`,
  `.grid-2`, button `.danger`/`.secondary`) rather than hardcoded colors.
- **E2E selectors:** UI elements the Puppeteer suite drives carry `data-testid`. Keep them
  stable when editing components (`e2e/run.ts` depends on them). New engine features get an
  inline-pack unit test (don't mutate the shared `engine/testPack.ts`) plus, ideally, an
  e2e flow with a screenshot.
