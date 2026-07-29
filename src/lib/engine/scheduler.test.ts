import { describe, expect, it } from 'vitest';
import { crossed, pendingTimers } from './scheduler.ts';
import { createWorld } from './world.ts';
import { apply } from './reducers.ts';
import { makeEvent } from './events.ts';
import { makeTestPack } from './testPack.ts';

describe('scheduler', () => {
	it('crosses on the half-open interval (from, to]', () => {
		expect(crossed(10, 0, 10)).toBe(true); // fires exactly at `to`
		expect(crossed(10, 10, 20)).toBe(false); // already passed at `from`
		expect(crossed(11, 10, 20)).toBe(true);
		expect(crossed(21, 10, 20)).toBe(false); // not yet
	});

	it('lists pending timers sorted by fire time', () => {
		let w = createWorld(makeTestPack(), { realTs: 1 });
		w = apply(w, makeEvent('LightLit', { lightId: 'torch', duration: 60 }, 600, { realTs: 2 }));
		const timers = pendingTimers(w);
		// effect ends at 610, torch burns out at 660 → effect first
		expect(timers.map((t) => t.entityId)).toEqual(['spell', 'torch']);
		expect(timers[0].at).toBe(610);
	});
});
