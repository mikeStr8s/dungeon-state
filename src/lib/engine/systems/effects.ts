// Spell / effect-duration system (doc: Spell System). An active effect expires when
// the clock crosses its end minute.

import { makeEvent } from '../events.ts';
import { crossed } from '../scheduler.ts';
import type { EventEnvelope, WorldState } from '../types.ts';
import type { System } from './index.ts';

export const effectSystem: System = {
	name: 'effects',
	priority: 20,
	run(state: WorldState, from: number, to: number): EventEnvelope[] {
		const events: EventEnvelope[] = [];
		for (const e of Object.values(state.entities)) {
			if (e.kind !== 'effect' || e.state !== 'active') continue;
			const endsAt = e.data.endsAt;
			if (typeof endsAt === 'number' && crossed(endsAt, from, to)) {
				events.push(makeEvent('EffectExpired', { effectId: e.id }, endsAt));
			}
		}
		return events;
	}
};
