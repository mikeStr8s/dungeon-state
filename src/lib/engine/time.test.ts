import { describe, expect, it } from 'vitest';
import { advanceTime } from './time.ts';
import { createWorld } from './world.ts';
import { apply } from './reducers.ts';
import { makeEvent } from './events.ts';
import { makeTestPack } from './testPack.ts';

function litWorld() {
	let w = createWorld(makeTestPack(), { realTs: 1 });
	w = apply(w, makeEvent('LightLit', { lightId: 'torch', duration: 60 }, 600, { realTs: 2 }));
	return w; // torch lit at 600 (burns out 660), effect ends 610
}

describe('time engine', () => {
	it('advances the clock', () => {
		const w = createWorld(makeTestPack(), { realTs: 1 });
		const { state } = advanceTime(w, 10, { realTs: 3 });
		expect(state.now).toBe(610);
	});

	it('expires an effect when the clock crosses its end', () => {
		const { state, notifications } = advanceTime(litWorld(), 10, { realTs: 3 }); // 600 → 610
		expect(state.entities.spell.state).toBe('expired');
		expect(state.entities.torch.state).toBe('lit'); // not yet 660
		expect(notifications.some((n) => n.message.includes('Bless'))).toBe(true);
	});

	it('burns out a torch and darkens its room', () => {
		const { state, notifications } = advanceTime(litWorld(), 60, { realTs: 3 }); // 600 → 660
		expect(state.entities.torch.state).toBe('spent');
		expect(state.entities.r1.data.light).toBe('dark');
		expect(notifications.some((n) => n.message.includes('burned out'))).toBe(true);
	});

	it('is deterministic: same input ⇒ same result', () => {
		const a = advanceTime(litWorld(), 60, { realTs: 3 });
		const b = advanceTime(litWorld(), 60, { realTs: 3 });
		expect(a.state.entities).toEqual(b.state.entities);
		expect(a.state.now).toBe(b.state.now);
		expect(a.newEvents.map((e) => [e.type, e.at, e.payload])).toEqual(
			b.newEvents.map((e) => [e.type, e.at, e.payload])
		);
	});

	it('no-ops on non-positive delta', () => {
		const w = litWorld();
		const { state, newEvents } = advanceTime(w, 0);
		expect(state).toBe(w);
		expect(newEvents).toHaveLength(0);
	});
});
