// Faction upkeep system. Deterministic bookkeeping only (doc: automate bookkeeping):
// controlled territory generates resources over time. Discretionary faction actions are
// never automatic — they are proposed for DM approval (see engine/factions.ts). Morale
// is deliberately not touched here; it changes only via approved actions or DM edits.

import { makeEvent } from '../events.ts';
import type { EventEnvelope, WorldState } from '../types.ts';
import type { System } from './index.ts';

export const factionUpkeepSystem: System = {
	name: 'faction-upkeep',
	priority: 30,
	run(state: WorldState, from: number, to: number): EventEnvelope[] {
		const events: EventEnvelope[] = [];
		for (const f of Object.values(state.entities)) {
			if (f.kind !== 'faction') continue;
			const regen = typeof f.data.resourceRegen === 'number' ? f.data.resourceRegen : 0;
			const territory = Array.isArray(f.data.territory) ? (f.data.territory as string[]) : [];
			if (regen <= 0 || territory.length === 0) continue;
			const hours = Math.floor(to / 60) - Math.floor(from / 60); // hour boundaries crossed
			if (hours <= 0) continue;
			const current = typeof f.data.resources === 'number' ? f.data.resources : 0;
			const gained = regen * territory.length * hours;
			const at = Math.floor(to / 60) * 60; // last boundary minute in the interval
			events.push(
				makeEvent(
					'EntityDataChanged',
					{ entityId: f.id, patch: { resources: current + gained } },
					at
				)
			);
		}
		return events;
	}
};
