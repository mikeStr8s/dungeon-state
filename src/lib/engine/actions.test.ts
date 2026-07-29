import { describe, expect, it } from 'vitest';
import { createWorld } from './world.ts';
import { exitsFrom } from './world.ts';
import { moveParty, defeatCreature } from './actions.ts';
import { apply } from './reducers.ts';
import { makeEvent } from './events.ts';
import { makeTestPack } from './testPack.ts';

const O = { realTs: 1 };

describe('exitsFrom', () => {
	it('finds the exit from both sides of a connection', () => {
		const w = createWorld(makeTestPack(), O);
		const fromR1 = exitsFrom(w, 'r1');
		expect(fromR1.map((x) => x.toRoom)).toEqual(['r2']);
		expect(fromR1[0]).toMatchObject({ connectionId: 'door', travelTime: 4, passable: true });
		// reverse direction: door is located in r1 but still an exit of r2
		expect(exitsFrom(w, 'r2').map((x) => x.toRoom)).toEqual(['r1']);
	});

	it('flags a locked connection as not passable', () => {
		let w = createWorld(makeTestPack(), O);
		w = apply(w, makeEvent('EntityStateChanged', { entityId: 'door', state: 'locked' }, 600, O));
		expect(exitsFrom(w, 'r1')[0]).toMatchObject({ passable: false, blockedBy: 'locked' });
	});
});

describe('moveParty', () => {
	it('advances the clock by travel time, moves the party, and marks the room explored', () => {
		const w = createWorld(makeTestPack(), O);
		expect(w.entities.r2.state).toBe('unexplored');
		const { state, newEvents } = moveParty(w, 'door', O);
		expect(state.now).toBe(604); // 600 + travelTime 4
		expect(state.entities.party.location).toBe('r2');
		expect(state.entities.r2.state).toBe('explored');
		const types = newEvents.map((e) => e.type);
		expect(types).toContain('TimeAdvanced');
		expect(types).toContain('EntityMoved');
		expect(types).toContain('EntityStateChanged');
	});

	it('resolves timers crossed while in transit', () => {
		let w = createWorld(makeTestPack(), O);
		// torch expires at 604; traveling 4 minutes crosses it mid-journey
		w = apply(w, makeEvent('LightLit', { lightId: 'torch', duration: 4 }, 600, O));
		const { state, newEvents } = moveParty(w, 'door', O);
		expect(newEvents.map((e) => e.type)).toContain('LightExpired');
		expect(state.entities.torch.state).toBe('spent');
	});

	it('refuses a blocked connection (no-op)', () => {
		let w = createWorld(makeTestPack(), O);
		w = apply(w, makeEvent('EntityStateChanged', { entityId: 'door', state: 'locked' }, 600, O));
		const { state, newEvents } = moveParty(w, 'door', O);
		expect(newEvents).toHaveLength(0);
		expect(state.now).toBe(600);
		expect(state.entities.party.location).toBe('r1');
	});
});

describe('defeatCreature', () => {
	it('marks the creature dead', () => {
		const w = createWorld(makeTestPack(), O);
		// no creature in the test pack; just assert the builder shape
		const [ev] = defeatCreature(w, 'creature-x', O);
		expect(ev.type).toBe('EntityStateChanged');
		expect(ev.payload).toEqual({ entityId: 'creature-x', state: 'dead' });
	});
});
