import { describe, expect, it } from 'vitest';
import { createWorld } from './world.ts';
import { apply } from './reducers.ts';
import { proposeFactionActions, factionMembers } from './factions.ts';
import type { ContentPack } from './pack.ts';

const O = { realTs: 1 };

// one faction holding "hq", with a door out to non-territory "out"
function factionPack(facData: Record<string, unknown> = {}): ContentPack {
	return {
		id: 'f',
		name: 'F',
		startAt: 600,
		seed: 1,
		rooms: [
			{ id: 'hq', name: 'HQ', originalText: 'hq' },
			{ id: 'out', name: 'Out', originalText: 'out' }
		],
		entities: [
			{
				id: 'fac',
				kind: 'faction',
				name: 'Warband',
				location: null,
				state: 'active',
				data: {
					morale: 60,
					resources: 20,
					resourceRegen: 2,
					territory: ['hq'],
					objective: 'hold',
					relations: {},
					...facData
				}
			},
			{
				id: 'door1',
				kind: 'door',
				name: 'Gate',
				location: 'hq',
				state: 'closed',
				data: { travelTime: 1 },
				relationships: [{ type: 'connects', target: 'out' }]
			}
		]
	};
}

// two mutually hostile factions for diplomacy tests
function rivalPack(): ContentPack {
	const p = factionPack({ morale: 50, relations: { rival: 'enemy' } });
	p.entities.push({
		id: 'rival',
		kind: 'faction',
		name: 'Rivals',
		location: null,
		state: 'active',
		data: { morale: 50, resources: 5, territory: ['out'], relations: { fac: 'enemy' } }
	});
	return p;
}

describe('proposeFactionActions', () => {
	it('suggests recruit + fortify with explainable reasons', () => {
		const proposals = proposeFactionActions(createWorld(factionPack(), O));
		const kinds = proposals.map((p) => p.kind);
		expect(kinds).toContain('recruit');
		expect(kinds).toContain('fortify');
		expect(proposals.every((p) => p.reason.length > 0)).toBe(true);
	});

	it('is deterministic', () => {
		const w = createWorld(factionPack(), O);
		expect(proposeFactionActions(w).map((p) => p.id)).toEqual(
			proposeFactionActions(w).map((p) => p.id)
		);
	});

	it('does not suggest recruit when resources are too low', () => {
		const proposals = proposeFactionActions(createWorld(factionPack({ resources: 5 }), O));
		expect(proposals.map((p) => p.kind)).not.toContain('recruit');
	});

	it('approving recruit spawns a member and deducts resources', () => {
		let w = createWorld(factionPack(), O);
		const recruit = proposeFactionActions(w).find((p) => p.kind === 'recruit')!;
		for (const ev of recruit.build(w)) w = apply(w, ev);
		const members = factionMembers(w, 'fac');
		expect(members).toHaveLength(1);
		expect(members[0].location).toBe('hq');
		expect(w.entities.fac.data.resources).toBe(5); // 20 - 15
	});

	it('suggests negotiate between enemies and approving sets relations neutral', () => {
		let w = createWorld(rivalPack(), O);
		const negotiate = proposeFactionActions(w).find(
			(p) => p.kind === 'negotiate' && p.factionId === 'fac'
		)!;
		expect(negotiate).toBeDefined();
		for (const ev of negotiate.build(w)) w = apply(w, ev);
		expect((w.entities.fac.data.relations as Record<string, string>).rival).toBe('neutral');
		expect((w.entities.rival.data.relations as Record<string, string>).fac).toBe('neutral');
	});
});
