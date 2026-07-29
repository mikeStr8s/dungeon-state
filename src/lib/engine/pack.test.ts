import { describe, expect, it } from 'vitest';
import { createWorld } from './world.ts';
import { validatePack, packFromState } from './packIO.ts';
import { parsePack } from '$lib/content/packFormat';
import sampleJson from '$lib/content/sample-dungeon.json';
import warrenJson from '$lib/content/goblin-warren.json';

const O = { realTs: 1 };

describe('validatePack', () => {
	it('accepts the bundled packs with no errors', () => {
		expect(validatePack(sampleJson).errors).toEqual([]);
		expect(validatePack(warrenJson).errors).toEqual([]);
	});

	it('reports every referential problem', () => {
		const bad = {
			id: 'b',
			name: 'B',
			startAt: 0,
			seed: 0,
			startRoom: 'nope',
			rooms: [
				{ id: 'r1', name: 'R1' },
				{ id: 'r1', name: 'dup' }
			],
			entities: [
				{ id: 'x', kind: 'creature', name: 'X', location: 'ghost', state: 'alive' },
				{ id: 'x', kind: 'weird', name: 'Dup', location: null, state: 's' },
				{
					id: 'm',
					kind: 'creature',
					name: 'M',
					location: null,
					state: 'alive',
					relationships: [{ type: 'memberOf', target: 'nofac' }]
				},
				{
					id: 'd',
					kind: 'door',
					name: 'D',
					location: 'r1',
					state: 'closed',
					relationships: [{ type: 'connects', target: 'noroom' }]
				}
			]
		};
		const { pack, errors } = validatePack(bad);
		expect(pack).toBeNull();
		const joined = errors.join('\n');
		expect(joined).toMatch(/duplicate room id "r1"/);
		expect(joined).toMatch(/startRoom "nope" is not a room/);
		expect(joined).toMatch(/location "ghost" is not a room/);
		expect(joined).toMatch(/duplicate entity id "x"/);
		expect(joined).toMatch(/invalid kind "weird"/);
		expect(joined).toMatch(/memberOf unknown faction "nofac"/);
		expect(joined).toMatch(/connects to unknown room "noroom"/);
	});
});

describe('packFromState', () => {
	it('round-trips the live world into a valid, re-loadable pack', () => {
		const w = createWorld(validatePack(warrenJson).pack!, O);
		const exported = packFromState(w);
		expect(validatePack(exported).errors).toEqual([]);
		expect(exported.startRoom).toBe('warren-mouth');
		// party is excluded from the pack but re-created on load
		expect(exported.entities.some((e) => e.kind === 'party')).toBe(false);
		const reloaded = createWorld(exported, O);
		expect(reloaded.entities['goblin-chief'].state).toBe('alive');
		expect(reloaded.entities.party.location).toBe('warren-mouth');
	});
});

describe('parsePack', () => {
	it('parses YAML to the same object as the equivalent JSON', () => {
		const yaml = 'id: p\nname: P\nstartAt: 600\nseed: 1\nrooms: []\nentities: []\n';
		expect(parsePack(yaml)).toEqual({
			id: 'p',
			name: 'P',
			startAt: 600,
			seed: 1,
			rooms: [],
			entities: []
		});
	});
});
