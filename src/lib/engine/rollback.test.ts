import { describe, expect, it } from 'vitest';
import { createWorld } from './world.ts';
import { apply, fold, activeEvents, activeEventIds } from './reducers.ts';
import { makeEvent } from './events.ts';
import type { ContentPack } from './pack.ts';

const O = { realTs: 1 };

function pack(): ContentPack {
	return {
		id: 'r',
		name: 'R',
		startAt: 600,
		seed: 1,
		rooms: [{ id: 'a', name: 'A', originalText: 'a' }],
		entities: [
			{ id: 'mob', kind: 'creature', name: 'Mob', location: 'a', state: 'alive', data: {} }
		]
	};
}

describe('rollback', () => {
	it('re-derives state without cancelled events but keeps the full log', () => {
		let w = createWorld(pack(), O);
		const initId = w.log[0].id;
		w = apply(w, makeEvent('EntityStateChanged', { entityId: 'mob', state: 'dead' }, 600, O));
		expect(w.entities.mob.state).toBe('dead');

		w = apply(w, makeEvent('RolledBack', { toEventId: initId }, 600, O));
		const rebuilt = fold(w.log);
		expect(rebuilt.entities.mob.state).toBe('alive'); // defeat cancelled
		expect(rebuilt.log).toHaveLength(3); // init + defeat + marker all retained (audit)
		expect(activeEventIds(rebuilt.log).size).toBe(1); // only the init event is active
	});

	it('ignores a marker pointing at an unknown id', () => {
		let w = createWorld(pack(), O);
		w = apply(w, makeEvent('EntityStateChanged', { entityId: 'mob', state: 'dead' }, 600, O));
		w = apply(w, makeEvent('RolledBack', { toEventId: 'nope' }, 600, O));
		expect(fold(w.log).entities.mob.state).toBe('dead'); // no truncation
	});

	it('stays consistent when new events are appended after a rollback', () => {
		let w = createWorld(pack(), O);
		const initId = w.log[0].id;
		w = apply(w, makeEvent('EntityStateChanged', { entityId: 'mob', state: 'dead' }, 600, O));
		w = apply(w, makeEvent('RolledBack', { toEventId: initId }, 600, O));
		w = apply(w, makeEvent('EntityStateChanged', { entityId: 'mob', state: 'fled' }, 600, O));
		const rebuilt = fold(w.log);
		expect(rebuilt.entities.mob.state).toBe('fled');
		expect(activeEvents(rebuilt.log).map((e) => e.type)).toEqual([
			'WorldInitialized',
			'EntityStateChanged'
		]);
	});
});
