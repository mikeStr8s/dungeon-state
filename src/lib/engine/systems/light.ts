// Torch / light-source system (doc: Torch System). A lit light burns for its
// duration; when the clock crosses its expiry it goes out, which the reducer turns
// into the room going dark.

import { makeEvent } from '../events.ts';
import { crossed } from '../scheduler.ts';
import type { EventEnvelope, WorldState } from '../types.ts';
import type { System } from './index.ts';

export const lightSystem: System = {
	name: 'light',
	priority: 10,
	run(state: WorldState, from: number, to: number): EventEnvelope[] {
		const events: EventEnvelope[] = [];
		for (const e of Object.values(state.entities)) {
			if (e.kind !== 'light' || e.state !== 'lit') continue;
			const expiresAt = e.data.expiresAt;
			if (typeof expiresAt === 'number' && crossed(expiresAt, from, to)) {
				events.push(makeEvent('LightExpired', { lightId: e.id }, expiresAt));
			}
		}
		return events;
	}
};
