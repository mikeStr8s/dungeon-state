import { describe, expect, it } from 'vitest';
import { createWorld } from '../world.ts';
import { advanceTime } from '../time.ts';
import { apply } from '../reducers.ts';
import { makeEvent } from '../events.ts';
import type { ContentPack } from '../pack.ts';

const O = { realTs: 1 };

// three-room loop a→b→c→a; the mob steps every 10 minutes, phase-anchored at 600
function patrolPack(data: Record<string, unknown> = {}): ContentPack {
	return {
		id: 'p',
		name: 'Patrol',
		startAt: 600,
		seed: 1,
		rooms: ['a', 'b', 'c'].map((id) => ({ id, name: id, originalText: id })),
		entities: [
			{
				id: 'mob',
				kind: 'creature',
				name: 'Mob',
				location: 'a',
				state: 'alive',
				data: {
					disposition: 'hostile',
					task: 'patrol',
					route: ['a', 'b', 'c'],
					stepEvery: 10,
					routeAnchor: 600,
					...data
				}
			}
		]
	};
}

describe('patrol system', () => {
	it('steps one room per stepEvery boundary', () => {
		const { state } = advanceTime(createWorld(patrolPack(), O), 10, O); // 600 → 610
		expect(state.entities.mob.location).toBe('b');
	});

	it('takes every boundary crossed in a single advance', () => {
		const { state, newEvents } = advanceTime(createWorld(patrolPack(), O), 25, O); // 610, 620
		expect(state.entities.mob.location).toBe('c');
		expect(newEvents.filter((e) => e.type === 'EntityMoved')).toHaveLength(2);
	});

	it('cycles back to the start of the route', () => {
		const { state } = advanceTime(createWorld(patrolPack(), O), 30, O); // 610,620,630 → b,c,a
		expect(state.entities.mob.location).toBe('a');
	});

	it('does not move a dead creature', () => {
		let w = createWorld(patrolPack(), O);
		w = apply(w, makeEvent('EntityStateChanged', { entityId: 'mob', state: 'dead' }, 600, O));
		expect(advanceTime(w, 30, O).state.entities.mob.location).toBe('a');
	});

	it('does not move a guard-task creature', () => {
		const { state } = advanceTime(createWorld(patrolPack({ task: 'guard' }), O), 30, O);
		expect(state.entities.mob.location).toBe('a');
	});

	it('recovers onto the route if moved off it', () => {
		let w = createWorld(patrolPack(), O);
		w = apply(w, makeEvent('EntityMoved', { entityId: 'mob', toRoom: 'c' }, 600, O));
		// from a non-anchor position it still steps to the next route room on the boundary
		const { state } = advanceTime(w, 10, O);
		expect(['a', 'b', 'c']).toContain(state.entities.mob.location);
		expect(state.entities.mob.location).not.toBe('c');
	});
});
