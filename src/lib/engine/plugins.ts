// Plugin extension-point registry (doc Phase 7: "future modules should be easy to add").
// A plugin registers time-driven `System`s and/or faction proposal rules through this
// stable API — the built-ins flow through the same seam (see systems/index.ts, factions.ts).
// No arbitrary-code eval: plugins are modules, not untrusted uploads. Enabling/disabling is
// runtime config (it only affects *future* advances) — never event-sourced.
//
// Imports here are type-only, so systems/factions can import the merge helpers at call time
// without a runtime import cycle.

import type { System } from './systems/index.ts';
import type { FactionRule } from './factions.ts';

export interface Plugin {
	id: string;
	name: string;
	description: string;
	systems?: System[];
	factionRules?: FactionRule[];
}

const registered: Plugin[] = [];
const disabled = new Set<string>();

export function registerPlugin(plugin: Plugin): void {
	if (!registered.some((p) => p.id === plugin.id)) registered.push(plugin);
}

export function plugins(): Plugin[] {
	return [...registered];
}

/** Clear the registry (test isolation). */
export function resetPlugins(): void {
	registered.length = 0;
	disabled.clear();
}

export function isPluginEnabled(id: string): boolean {
	return !disabled.has(id);
}

export function setPluginEnabled(id: string, on: boolean): void {
	if (on) disabled.delete(id);
	else disabled.add(id);
}

/** Systems contributed by all enabled plugins. */
export function pluginSystems(): System[] {
	return registered.filter((p) => !disabled.has(p.id)).flatMap((p) => p.systems ?? []);
}

/** Faction proposal rules contributed by all enabled plugins. */
export function pluginFactionRules(): FactionRule[] {
	return registered.filter((p) => !disabled.has(p.id)).flatMap((p) => p.factionRules ?? []);
}
