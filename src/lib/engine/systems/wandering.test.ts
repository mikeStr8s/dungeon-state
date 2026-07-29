import { describe, expect, it } from 'vitest';
import { createWorld } from '../world.ts';
import { isOccupied } from '../world.ts';
import { advanceTime } from '../time.ts';
import { rngAt } from '../rng.ts';
import type { ContentPack } from '../pack.ts';

const O = { realTs: 1 };

function wanderPack(chance: number): ContentPack {
	return {
		id: 'w',
		name: 'Wander',
		startAt: 600,
		seed: 1,
		rooms: ['a', 'b'].map((id) => ({ id, name: id, originalText: id })),
		entities: [],
		wandering: {
			chancePerCheck: chance,
			checkEvery: 10,
			table: [{ key: 'rat', name: 'Giant Rat', data: { hp: 7 } }]
		}
	};
}

describe('rngAt', () => {
	it('is deterministic per (seed, tick, salt) and varies with each', () => {
		expect(rngAt(1, 610, 1)).toBe(rngAt(1, 610, 1));
		expect(rngAt(1, 610, 1)).not.toBe(rngAt(1, 620, 1));
		expect(rngAt(1, 610, 1)).not.toBe(rngAt(1, 610, 2));
		const v = rngAt(1, 610, 1);
		expect(v).toBeGreaterThanOrEqual(0);
		expect(v).toBeLessThan(1);
	});
});

describe('wandering system', () => {
	it('spawns a monster at a check boundary when the roll hits', () => {
		const { state, newEvents } = advanceTime(createWorld(wanderPack(1), O), 10, O); // check at 610
		const spawns = newEvents.filter((e) => e.type === 'EntitySpawned');
		expect(spawns).toHaveLength(1);
		expect(state.entities['wander-610-rat']).toBeDefined();
		expect(state.entities['wander-610-rat'].kind).toBe('creature');
	});

	it('never spawns when the chance is zero', () => {
		const { newEvents } = advanceTime(createWorld(wanderPack(0), O), 60, O);
		expect(newEvents.some((e) => e.type === 'EntitySpawned')).toBe(false);
	});

	it('is reproducible: same seed + advance ⇒ same spawns', () => {
		const a = advanceTime(createWorld(wanderPack(0.5), O), 120, O);
		const b = advanceTime(createWorld(wanderPack(0.5), O), 120, O);
		expect(Object.keys(a.state.entities).sort()).toEqual(Object.keys(b.state.entities).sort());
	});

	it('a spawned hostile makes its room occupied', () => {
		const { state } = advanceTime(createWorld(wanderPack(1), O), 10, O);
		const spawn = state.entities['wander-610-rat'];
		expect(isOccupied(state, spawn.location!)).toBe(true);
	});
});
