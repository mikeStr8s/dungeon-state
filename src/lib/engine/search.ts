// Global search (doc: "Everything should be searchable"). Pure and UI-agnostic: matches a
// query across every live entity AND the humanized event history, returning categorized,
// navigable results. Clock formatting is left to the UI (results carry the raw `at`).

import { activeEventIds } from './reducers.ts';
import { describeEvent } from './time.ts';
import type { Entity, WorldState } from './types.ts';

export interface SearchResult {
	kind: 'entity' | 'event';
	id: string;
	title: string;
	subtitle: string;
	/** entity kind, or 'event'. */
	category: string;
	/** room to navigate to when clicked (entity results). */
	roomId?: string;
	/** in-game minute (event results). */
	at?: number;
}

const MAX_RESULTS = 50;

/** Every string worth matching on an entity. */
function entityHaystack(e: Entity): string {
	const dataBits = Object.values(e.data)
		.map((v) => (Array.isArray(v) ? v.join(' ') : String(v)))
		.join(' ');
	return `${e.name} ${e.kind} ${e.state} ${e.id} ${dataBits}`.toLowerCase();
}

export function search(state: WorldState, query: string): SearchResult[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const results: SearchResult[] = [];

	for (const e of Object.values(state.entities)) {
		if (entityHaystack(e).includes(q)) {
			results.push({
				kind: 'entity',
				id: e.id,
				title: e.name,
				subtitle: `${e.kind} · ${e.state}`,
				category: e.kind,
				roomId: e.kind === 'room' ? e.id : (e.location ?? undefined)
			});
		}
	}

	// only the active log is meaningful to search (rolled-back events are cancelled)
	const active = activeEventIds(state.log);
	for (const ev of state.log) {
		if (!active.has(ev.id)) continue;
		const text = describeEvent(ev, state);
		if (text.toLowerCase().includes(q) || ev.type.toLowerCase().includes(q)) {
			results.push({
				kind: 'event',
				id: ev.id,
				title: text,
				subtitle: ev.type,
				category: 'event',
				at: ev.at
			});
		}
	}

	// entities before events; stable within each group
	results.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'entity' ? -1 : 1));
	return results.slice(0, MAX_RESULTS);
}
