import { describe, expect, it } from 'vitest';
import { createWorld } from './world.ts';
import { apply, fold } from './reducers.ts';
import { makeEvent } from './events.ts';
import { makeTestPack } from './testPack.ts';

describe('reducers', () => {
	it('initializes a world from a pack', () => {
		const w = createWorld(makeTestPack(), { realTs: 1 });
		expect(w.now).toBe(600);
		expect(w.initialized).toBe(true);
		expect(w.entities.r1.kind).toBe('room');
		expect(w.entities.torch.state).toBe('unlit');
		expect(w.canon.entities.torch.state).toBe('unlit'); // canon captured
	});

	it('does not mutate the input state', () => {
		const w = createWorld(makeTestPack(), { realTs: 1 });
		const before = w.entities.torch.state;
		const ev = makeEvent('LightLit', { lightId: 'torch', duration: 60 }, 600, { realTs: 2 });
		apply(w, ev);
		expect(w.entities.torch.state).toBe(before); // original untouched
	});

	it('lighting a torch makes its room bright; canon stays as published', () => {
		let w = createWorld(makeTestPack(), { realTs: 1 });
		w = apply(w, makeEvent('LightLit', { lightId: 'torch', duration: 60 }, 600, { realTs: 2 }));
		expect(w.entities.torch.state).toBe('lit');
		expect(w.entities.r1.data.light).toBe('bright');
		expect(w.canon.entities.r1.data.light).toBe('dark'); // overlay only
	});

	it('places the party at startRoom and marks it explored (canon stays unexplored)', () => {
		const w = createWorld(makeTestPack(), { realTs: 1 });
		expect(w.entities.party.kind).toBe('party');
		expect(w.entities.party.location).toBe('r1');
		expect(w.entities.r1.state).toBe('explored');
		expect(w.canon.entities.party).toBeUndefined(); // party is campaign state, not canon
		expect(w.canon.entities.r1.state).toBe('unexplored');
	});

	it('EntityMoved relocates an entity and recomputes light in both rooms', () => {
		let w = createWorld(makeTestPack(), { realTs: 1 });
		w = apply(w, makeEvent('LightLit', { lightId: 'torch', duration: 60 }, 600, { realTs: 2 }));
		expect(w.entities.r1.data.light).toBe('bright');
		w = apply(w, makeEvent('EntityMoved', { entityId: 'torch', toRoom: 'r2' }, 600, { realTs: 3 }));
		expect(w.entities.torch.location).toBe('r2');
		expect(w.entities.r1.data.light).toBe('dark'); // light left
		expect(w.entities.r2.data.light).toBe('bright'); // light arrived
	});

	it('EntitySpawned adds an entity and is idempotent on replay', () => {
		let w = createWorld(makeTestPack(), { realTs: 1 });
		const goblin = {
			id: 'goblin-1',
			kind: 'creature' as const,
			name: 'Goblin',
			location: 'r2',
			state: 'alive',
			data: { disposition: 'hostile' },
			relationships: []
		};
		w = apply(w, makeEvent('EntitySpawned', { entity: goblin }, 600, { realTs: 2 }));
		expect(w.entities['goblin-1'].name).toBe('Goblin');
		// replaying the same spawn must not duplicate or overwrite
		const before = w.entities['goblin-1'];
		w = apply(
			w,
			makeEvent('EntitySpawned', { entity: { ...goblin, name: 'Changed' } }, 600, { realTs: 3 })
		);
		expect(w.entities['goblin-1'].name).toBe(before.name);
	});

	it('EntityDataChanged shallow-merges into entity data', () => {
		let w = createWorld(makeTestPack(), { realTs: 1 });
		w = apply(
			w,
			makeEvent(
				'EntityDataChanged',
				{ entityId: 'torch', patch: { duration: 99, note: 'x' } },
				600,
				{
					realTs: 2
				}
			)
		);
		expect(w.entities.torch.data.duration).toBe(99);
		expect(w.entities.torch.data.note).toBe('x');
		// unrelated existing data survives the merge
		expect(w.entities.torch.name).toBe('Torch');
	});

	it('fold rebuilds identical state from the log', () => {
		let w = createWorld(makeTestPack(), { realTs: 1 });
		w = apply(w, makeEvent('LightLit', { lightId: 'torch', duration: 60 }, 600, { realTs: 2 }));
		const rebuilt = fold(w.log);
		expect(rebuilt.entities).toEqual(w.entities);
		expect(rebuilt.now).toBe(w.now);
	});
});
