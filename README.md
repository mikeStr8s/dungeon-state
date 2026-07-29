# Living Dungeon Engine

A persistent, event-sourced source-of-truth for running an evolving megadungeon. The
published adventure is the starting state; from session one the app **is** the dungeon and
its state evolves over in-game time. It automates the bookkeeping a DM hates — torches,
timers, patrols, wandering monsters, faction upkeep — and leaves the storytelling to you.

## What it is

- **Time drives everything.** Advancing the clock runs every subsystem; nothing changes
  otherwise. Party travel advances time too, so the world lives while you move through it.
- **Event-sourced.** Every change is an event in an append-only log; world state is the
  fold of that log. Nothing is ever deleted — so undo, rollback, and a full audit history
  come for free.
- **Automate bookkeeping, not storytelling.** Factions _propose_ explainable, rules-based
  actions; the DM approves, edits, or overrides. The engine never authors narrative.
- **Content-agnostic.** The engine hardcodes no adventure. Dungeons are content packs.

## Features

- **Persistent world & history** — everything is an entity; a living event log with
  filter, search, and **non-destructive rollback / undo**.
- **Time engine** — 1 min → long rest advances; torches burn out, spells expire, timers
  tick, with a "what changed" summary each advance.
- **Movement & exploration** — a room graph with travel times, party position, and
  fog-of-war (rooms flip explored as you go).
- **Monsters** — task-driven creatures (patrol routes) and seeded-random wandering
  encounters that appear across the dungeon over time.
- **Factions** — morale / resources / territory / diplomacy, with a rules engine that
  suggests recruit / fortify / raid / retreat / negotiate for DM approval.
- **Context dashboard** — current room (as-published vs current), notifications, timers,
  factions, proposals, and a global search across entities _and_ history.
- **Adventure import** — load/switch content packs (JSON **or** YAML) with full referential
  validation; export the live campaign back out as a pack.
- **Plugin framework** — register extra time-systems / faction rules through a stable API;
  ships a bundled **Environmental** plugin (rooms flood over time).

## Quickstart

Runtime is [**bun**](https://bun.sh).

```sh
bun install
bun run dev            # http://localhost:5173
```

Other scripts:

```sh
bun run test           # unit tests (vitest)
bun run test:e2e       # build + Puppeteer end-to-end flows (writes e2e/screenshots/)
bun run check          # type-check (svelte-check)
bun run lint           # prettier --check   (bun run format to fix)
bun run build          # production build
```

The e2e suite drives the system Chromium at `/usr/bin/chromium` (override with
`PUPPETEER_EXECUTABLE_PATH`).

## Tech

SvelteKit + **Svelte 5 (runes)**, TypeScript, bun, Vite. **Client-only** — no server:
state persists to **IndexedDB**, and saves/packs export as JSON files. A vendored,
framework-agnostic Tokyonight terminal theme lives in `src/lib/theme/`.

## Architecture

Four strictly separated layers:

- `src/lib/engine/` — pure TS, zero Svelte imports, fully unit-tested. The whole
  simulation: entities, events + reducers (`fold`), the time engine and its systems,
  factions, search, pack validation, and the plugin registry.
- `src/lib/persistence/` — IndexedDB adapter + save-file / pack export-import.
- `src/lib/state/worldStore.svelte.ts` — the reactive runes bridge (glue only).
- `src/routes/` + `src/lib/components/` — the dashboard UI. `src/lib/plugins/` — bundled
  plugins.

Deep architectural guidance (the event-sourcing rules, extension recipes, gotchas) is in
[`CLAUDE.md`](./CLAUDE.md). The original product vision is in
[`AI_GENERATED_PROMPT.md`](./AI_GENERATED_PROMPT.md).

## Extending

- **New adventure** — author a content pack (JSON/YAML: rooms, entities, optional
  `startRoom` + `wandering` table) and import it via the Library panel, or drop it in
  `src/lib/content/` and add it to `bundledPacks`.
- **New behavior** — implement a `System` and register it directly (`engine/systems/`) or
  ship it in a `Plugin` (`registerPlugin`); it joins the time pipeline by priority.

## Status

All 7 roadmap phases are delivered — persistent world, time engine, monsters/patrols,
factions, dashboard/search/history, adventure import, and plugins — covered by ~63 unit
tests and 11 screenshot-verified end-to-end flows.
