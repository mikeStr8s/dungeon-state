// Patrol system (doc: Patrol System — routes, schedules, destinations). Creatures with
// a `patrol` task step along a cyclic route. Timing is phase-anchored to absolute time
// (`routeAnchor + k·stepEvery`) and stateless: a creature's route position is derived
// from its current `location`, so nothing per-creature needs to be stored between ticks.

import { makeEvent } from '../events.ts';
import type { EventEnvelope, WorldState } from '../types.ts';
import type { System } from './index.ts';

export const patrolSystem: System = {
	name: 'patrol',
	priority: 15,
	run(state: WorldState, from: number, to: number): EventEnvelope[] {
		const events: EventEnvelope[] = [];
		for (const e of Object.values(state.entities)) {
			if (e.kind !== 'creature' || e.state === 'dead') continue;
			if (e.data.task !== 'patrol') continue;
			const route = Array.isArray(e.data.route) ? (e.data.route as string[]) : [];
			const stepEvery = typeof e.data.stepEvery === 'number' ? e.data.stepEvery : 0;
			if (route.length < 2 || stepEvery <= 0) continue;
			const anchor = typeof e.data.routeAnchor === 'number' ? e.data.routeAnchor : 0;

			// step boundaries in the half-open interval (from, to]
			const firstK = Math.floor((from - anchor) / stepEvery) + 1;
			const lastK = Math.floor((to - anchor) / stepEvery);
			let pos = route.indexOf(e.location ?? '');
			if (pos < 0) pos = 0; // recover if the creature was moved off its route
			for (let k = firstK; k <= lastK; k++) {
				const t = anchor + k * stepEvery;
				pos = (pos + 1) % route.length;
				events.push(makeEvent('EntityMoved', { entityId: e.id, toRoom: route[pos] }, t));
			}
		}
		return events;
	}
};
