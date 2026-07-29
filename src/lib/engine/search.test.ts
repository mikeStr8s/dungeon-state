import { describe, expect, it } from 'vitest';
import { createWorld } from './world.ts';
import { apply } from './reducers.ts';
import { makeEvent } from './events.ts';
import { search } from './search.ts';
import type { ContentPack } from './pack.ts';

const O = { realTs: 1 };

function pack(): ContentPack {
	return {
		id: 's',
		name: 'S',
		startAt: 600,
		seed: 1,
		rooms: [{ id: 'crypt', name: 'The Crypt', originalText: 'dark' }],
		entities: [
			{
				id: 'vamp',
				kind: 'creature',
				name: 'Vampire Lord',
				location: 'crypt',
				state: 'alive',
				data: { note: 'ancient horror', disposition: 'hostile' }
			}
		]
	};
}

describe('search', () => {
	it('returns nothing for an empty query', () => {
		expect(search(createWorld(pack(), O), '   ')).toEqual([]);
	});

	it('matches an entity by name', () => {
		const r = search(createWorld(pack(), O), 'vampire');
		expect(r.some((x) => x.kind === 'entity' && x.id === 'vamp' && x.roomId === 'crypt')).toBe(
			true
		);
	});

	it('matches an entity by a data field', () => {
		const r = search(createWorld(pack(), O), 'ancient');
		expect(r.map((x) => x.id)).toContain('vamp');
	});

	it('matches an event by its humanized text', () => {
		let w = createWorld(pack(), O);
		w = apply(w, makeEvent('NoteAdded', { entityId: 'vamp', text: 'staked' }, 600, O));
		const r = search(w, 'note added');
		expect(r.some((x) => x.kind === 'event')).toBe(true);
	});

	it('lists entity results before event results', () => {
		let w = createWorld(pack(), O);
		w = apply(w, makeEvent('NoteAdded', { entityId: 'vamp', text: 'x' }, 600, O));
		const r = search(w, 'vamp'); // matches the entity and the "Note added to Vampire Lord" event
		const firstEvent = r.findIndex((x) => x.kind === 'event');
		const lastEntity = r.map((x) => x.kind).lastIndexOf('entity');
		expect(lastEntity).toBeLessThan(firstEvent);
	});
});
