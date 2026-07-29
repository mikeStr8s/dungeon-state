// Wandering-monster system (doc: Random Event System — wandering monsters). On each
// check boundary it rolls the seeded, stateless `rngAt` (keyed by absolute minute); a
// hit spawns a creature from the pack's wandering table into a random room. Because the
// resulting EntitySpawned event captures the full entity, replay is exact regardless of
// the roll — the RNG only matters at generation time.

import { makeEvent } from '../events.ts';
import { rngAt } from '../rng.ts';
import type { Entity, EventEnvelope, WorldState } from '../types.ts';
import type { System } from './index.ts';

// independent draws at the same tick
const SALT_HIT = 1;
const SALT_PICK = 2;
const SALT_ROOM = 3;

export const wanderingSystem: System = {
	name: 'wandering',
	priority: 40,
	run(state: WorldState, from: number, to: number): EventEnvelope[] {
		const cfg = state.wandering;
		if (!cfg || cfg.table.length === 0 || cfg.checkEvery <= 0) return [];
		const rooms = Object.values(state.entities).filter((e) => e.kind === 'room');
		if (rooms.length === 0) return [];
		const seed = state.rng.seed;
		const events: EventEnvelope[] = [];

		// check boundaries t = k·checkEvery in the half-open interval (from, to]
		const firstK = Math.floor(from / cfg.checkEvery) + 1;
		const lastK = Math.floor(to / cfg.checkEvery);
		for (let k = firstK; k <= lastK; k++) {
			const t = k * cfg.checkEvery;
			if (rngAt(seed, t, SALT_HIT) >= cfg.chancePerCheck) continue;
			const def = cfg.table[Math.floor(rngAt(seed, t, SALT_PICK) * cfg.table.length)];
			const room = rooms[Math.floor(rngAt(seed, t, SALT_ROOM) * rooms.length)];
			const entity: Entity = {
				id: `wander-${t}-${def.key}`,
				kind: 'creature',
				name: def.name,
				location: room.id,
				state: 'alive',
				data: { wandering: true, disposition: 'hostile', task: 'guard', ...(def.data ?? {}) },
				relationships: []
			};
			events.push(makeEvent('EntitySpawned', { entity }, t));
		}
		return events;
	}
};
