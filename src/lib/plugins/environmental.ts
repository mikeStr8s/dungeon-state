// Bundled example plugin: Environmental Hazards (doc Phase 3 "Environmental System" —
// delivered here as a plugin to prove the extension registry). A room with `data.floodRate`
// fills with water over time. Emits only the standard EntityDataChanged event, so a save
// folds correctly even without the plugin loaded.

import { makeEvent } from '$lib/engine';
import type { EventEnvelope, Plugin, System, WorldState } from '$lib/engine';

const floodSystem: System = {
	name: 'environmental-flood',
	priority: 35,
	run(state: WorldState, from: number, to: number): EventEnvelope[] {
		const hours = Math.floor(to / 60) - Math.floor(from / 60); // whole hours crossed
		if (hours <= 0) return [];
		const at = Math.floor(to / 60) * 60;
		const events: EventEnvelope[] = [];
		for (const e of Object.values(state.entities)) {
			if (e.kind !== 'room') continue;
			const rate = typeof e.data.floodRate === 'number' ? e.data.floodRate : 0;
			if (rate <= 0) continue;
			const current = typeof e.data.flood === 'number' ? e.data.flood : 0;
			if (current >= 100) continue;
			const next = Math.min(100, current + rate * hours);
			events.push(makeEvent('EntityDataChanged', { entityId: e.id, patch: { flood: next } }, at));
		}
		return events;
	}
};

export const environmentalPlugin: Plugin = {
	id: 'environmental',
	name: 'Environmental Hazards',
	description: 'Rooms with a flood rate fill with water over time.',
	systems: [floodSystem]
};
