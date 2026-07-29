import { describe, expect, it } from 'vitest';
import { createWorld } from '../world.ts';
import { advanceTime } from '../time.ts';
import type { ContentPack } from '../pack.ts';

const O = { realTs: 1 };

function upkeepPack(): ContentPack {
	return {
		id: 'u',
		name: 'U',
		startAt: 600,
		seed: 1,
		rooms: [
			{ id: 'a', name: 'A', originalText: 'a' },
			{ id: 'b', name: 'B', originalText: 'b' }
		],
		entities: [
			{
				id: 'fac',
				kind: 'faction',
				name: 'Warband',
				location: null,
				state: 'active',
				data: { morale: 50, resources: 10, resourceRegen: 3, territory: ['a', 'b'] }
			}
		]
	};
}

describe('faction upkeep system', () => {
	it('regenerates resources per territory room per hour crossed', () => {
		const { state } = advanceTime(createWorld(upkeepPack(), O), 60, O); // one hour
		expect(state.entities.fac.data.resources).toBe(16); // 10 + 3 regen · 2 rooms
	});

	it('accrues across multiple hours in one advance', () => {
		const { state } = advanceTime(createWorld(upkeepPack(), O), 120, O); // two hours
		expect(state.entities.fac.data.resources).toBe(22); // 10 + 3·2·2
	});

	it('does nothing before an hour boundary and stays out of notifications', () => {
		const { state, notifications } = advanceTime(createWorld(upkeepPack(), O), 30, O);
		expect(state.entities.fac.data.resources).toBe(10);
		expect(notifications.some((n) => /res/i.test(n.message))).toBe(false);
	});

	it('resource-only upkeep is non-notable even when it fires', () => {
		const { notifications } = advanceTime(createWorld(upkeepPack(), O), 60, O);
		// the faction resource bump must not appear in the "what changed" summary
		expect(notifications.some((n) => n.message.includes('Warband'))).toBe(false);
	});
});
