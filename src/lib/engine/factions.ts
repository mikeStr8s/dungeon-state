// Faction proposal engine (doc: Faction Engine — "propose logical actions… the DM
// approves, edits, or overrides. Prefer explainable, rules-based suggestions"). Pure and
// deterministic: given the world it derives a list of suggested actions, each carrying a
// human-readable `reason` and a `build` that produces the committed events on approval.
// Proposals are NOT events — only an approval commits state.

import { makeEvent } from './events.ts';
import { uid } from './ids.ts';
import { pluginFactionRules } from './plugins.ts';
import type { Entity, EventEnvelope, WorldState } from './types.ts';
import { exitsFrom, hostilesIn } from './world.ts';

// tunable rule thresholds
const RECRUIT_COST = 15;
const FORTIFY_COST = 5;
const MORALE_LOW = 35;
const MORALE_HIGH = 65;

export type ProposalKind = 'recruit' | 'fortify' | 'raid' | 'retreat' | 'negotiate' | string;

/** A plugin-supplied proposal generator: given a faction, suggest actions. */
export type FactionRule = (state: WorldState, faction: Entity) => FactionProposal[];

export interface FactionProposal {
	/** stable across renders so the UI can track dismissal. */
	id: string;
	factionId: string;
	kind: ProposalKind;
	title: string;
	reason: string;
	/** events committed if the DM approves; built against live state at approval time. */
	build: (state: WorldState) => EventEnvelope[];
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d);
const list = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const relations = (f: Entity): Record<string, string> =>
	f.data.relations && typeof f.data.relations === 'object'
		? (f.data.relations as Record<string, string>)
		: {};

export function factions(state: WorldState): Entity[] {
	return Object.values(state.entities).filter((e) => e.kind === 'faction');
}

function isMemberOf(e: Entity, factionId: string): boolean {
	return e.relationships.some((r) => r.type === 'memberOf' && r.target === factionId);
}

export function factionMembers(state: WorldState, factionId: string): Entity[] {
	return Object.values(state.entities).filter(
		(e) => e.kind === 'creature' && e.state !== 'dead' && isMemberOf(e, factionId)
	);
}

export function territoryOf(f: Entity): string[] {
	return list(f.data.territory);
}

/** Alive hostiles in a room that do NOT belong to the given faction. */
function enemiesIn(state: WorldState, roomId: string, factionId: string): Entity[] {
	return hostilesIn(state, roomId).filter((c) => !isMemberOf(c, factionId));
}

function roomName(state: WorldState, id: string): string {
	return state.entities[id]?.name ?? id;
}

/** All proposals across all factions — built-in rules merged with enabled-plugin rules. */
export function proposeFactionActions(state: WorldState): FactionProposal[] {
	const rules = pluginFactionRules();
	const out: FactionProposal[] = [];
	for (const f of factions(state)) {
		out.push(...builtinProposalsFor(state, f));
		for (const rule of rules) out.push(...rule(state, f));
	}
	return out;
}

function builtinProposalsFor(state: WorldState, f: Entity): FactionProposal[] {
	const proposals: FactionProposal[] = [];
	const morale = num(f.data.morale);
	const resources = num(f.data.resources);
	const territory = territoryOf(f);
	const rels = relations(f);

	// recruit — spend resources to add a member in home territory
	if (resources >= RECRUIT_COST && morale >= MORALE_LOW && territory.length > 0) {
		const room = territory[0];
		proposals.push({
			id: `${f.id}:recruit`,
			factionId: f.id,
			kind: 'recruit',
			title: `Recruit — ${f.name}`,
			reason: `Resources (${resources}) ≥ cost (${RECRUIT_COST}); reinforce the ranks in ${roomName(state, room)}.`,
			build: (s) => {
				const recruit: Entity = {
					id: uid('recruit'),
					kind: 'creature',
					name: `${f.name} Recruit`,
					location: room,
					state: 'alive',
					data: { disposition: 'hostile', task: 'guard', hp: 10 },
					relationships: [{ type: 'memberOf', target: f.id }]
				};
				return [
					makeEvent('EntitySpawned', { entity: recruit }, s.now),
					makeEvent(
						'EntityDataChanged',
						{
							entityId: f.id,
							patch: { resources: num(s.entities[f.id]?.data.resources) - RECRUIT_COST }
						},
						s.now
					)
				];
			}
		});
	}

	// fortify — seal an unlocked door that exposes territory to the outside
	for (const room of territory) {
		const exit = exitsFrom(state, room).find((x) => x.passable && !territory.includes(x.toRoom));
		if (!exit) continue;
		proposals.push({
			id: `${f.id}:fortify:${exit.connectionId}`,
			factionId: f.id,
			kind: 'fortify',
			title: `Fortify — ${f.name}`,
			reason: `${roomName(state, room)} is exposed via ${roomName(state, exit.connectionId)}; seal it (cost ${FORTIFY_COST}).`,
			build: (s) => [
				makeEvent('EntityStateChanged', { entityId: exit.connectionId, state: 'locked' }, s.now),
				makeEvent(
					'EntityDataChanged',
					{
						entityId: f.id,
						patch: { resources: num(s.entities[f.id]?.data.resources) - FORTIFY_COST }
					},
					s.now
				)
			]
		});
		break; // one fortify suggestion per faction
	}

	// raid — high morale + an enemy's territory adjacent to ours → send a member
	if (morale >= MORALE_HIGH) {
		const enemyIds = Object.entries(rels)
			.filter(([, v]) => v === 'enemy')
			.map(([k]) => k);
		outer: for (const room of territory) {
			for (const exit of exitsFrom(state, room)) {
				const target = state.entities[exit.toRoom];
				const ownerEnemy = enemyIds.find((eid) =>
					territoryOf(state.entities[eid] ?? ({} as Entity)).includes(exit.toRoom)
				);
				if (target && ownerEnemy) {
					const member = factionMembers(state, f.id)[0];
					if (!member) break outer;
					const enemyName = state.entities[ownerEnemy]?.name ?? ownerEnemy;
					proposals.push({
						id: `${f.id}:raid:${exit.toRoom}`,
						factionId: f.id,
						kind: 'raid',
						title: `Raid — ${f.name}`,
						reason: `High morale (${morale}); strike ${enemyName} in ${roomName(state, exit.toRoom)}.`,
						build: (s) => [
							makeEvent('EntityMoved', { entityId: member.id, toRoom: exit.toRoom }, s.now)
						]
					});
					break outer;
				}
			}
		}
	}

	// retreat — low morale + enemies inside our territory → pull members to safety
	if (morale <= MORALE_LOW) {
		const threatened = territory.find((r) => enemiesIn(state, r, f.id).length > 0);
		if (threatened) {
			const safe = territory.find((r) => enemiesIn(state, r, f.id).length === 0) ?? territory[0];
			const exposed = factionMembers(state, f.id).filter((m) => m.location === threatened);
			if (exposed.length > 0 && safe !== threatened) {
				proposals.push({
					id: `${f.id}:retreat`,
					factionId: f.id,
					kind: 'retreat',
					title: `Retreat — ${f.name}`,
					reason: `Morale low (${morale}) with hostiles in ${roomName(state, threatened)}; fall back to ${roomName(state, safe)}.`,
					build: (s) =>
						factionMembers(s, f.id)
							.filter((m) => m.location === threatened)
							.map((m) => makeEvent('EntityMoved', { entityId: m.id, toRoom: safe }, s.now))
				});
			}
		}
	}

	// negotiate — moderate morale + an enemy relation → open talks (both sides → neutral)
	if (morale > MORALE_LOW && morale < MORALE_HIGH) {
		const enemyId = Object.entries(rels).find(([, v]) => v === 'enemy')?.[0];
		if (enemyId && state.entities[enemyId]) {
			const enemyName = state.entities[enemyId].name;
			proposals.push({
				id: `${f.id}:negotiate:${enemyId}`,
				factionId: f.id,
				kind: 'negotiate',
				title: `Negotiate — ${f.name}`,
				reason: `Stalemate with ${enemyName}; open talks and stand down.`,
				build: (s) => {
					const self = s.entities[f.id];
					const enemy = s.entities[enemyId];
					return [
						makeEvent(
							'EntityDataChanged',
							{
								entityId: f.id,
								patch: { relations: { ...relations(self), [enemyId]: 'neutral' } }
							},
							s.now
						),
						makeEvent(
							'EntityDataChanged',
							{
								entityId: enemyId,
								patch: { relations: { ...relations(enemy), [f.id]: 'neutral' } }
							},
							s.now
						)
					];
				}
			});
		}
	}

	return proposals;
}
