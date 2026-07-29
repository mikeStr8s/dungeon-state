// Content-pack validation + export. Validation collects *all* problems (shape +
// referential integrity) so the import UI can show a full report. `packFromState`
// snapshots the live world back into a reusable pack (authoring round-trip). Kept
// separate from pack.ts (pure types) to avoid a cycle with world.ts.

import { ENTITY_KINDS } from './types.ts';
import type { Entity, WorldState } from './types.ts';
import type { ContentPack, EntityDef, RoomDef } from './pack.ts';
import { partyRoom } from './world.ts';

export interface PackValidation {
	pack: ContentPack | null;
	errors: string[];
}

const obj = (v: unknown): Record<string, unknown> | null =>
	v && typeof v === 'object' ? (v as Record<string, unknown>) : null;

/** Validate arbitrary imported data into a ContentPack, gathering every error. */
export function validatePack(raw: unknown): PackValidation {
	const errors: string[] = [];
	const p = obj(raw);
	if (!p) return { pack: null, errors: ['Pack must be an object'] };

	if (typeof p.id !== 'string') errors.push('id must be a string');
	if (typeof p.name !== 'string') errors.push('name must be a string');
	if (typeof p.startAt !== 'number') errors.push('startAt must be a number');
	if (typeof p.seed !== 'number') errors.push('seed must be a number');

	const rooms = Array.isArray(p.rooms) ? p.rooms : (errors.push('rooms must be an array'), []);
	const entities = Array.isArray(p.entities)
		? p.entities
		: (errors.push('entities must be an array'), []);

	const roomIds = new Set<string>();
	rooms.forEach((r, i) => {
		const room = obj(r);
		if (!room || typeof room.id !== 'string') return errors.push(`rooms[${i}].id must be a string`);
		if (roomIds.has(room.id)) errors.push(`duplicate room id "${room.id}"`);
		roomIds.add(room.id);
		if (typeof room.name !== 'string') errors.push(`room "${room.id}" needs a name`);
	});

	// collect faction ids first so memberOf / relations can be checked
	const factionIds = new Set<string>();
	for (const e of entities) {
		const ent = obj(e);
		if (ent && ent.kind === 'faction' && typeof ent.id === 'string') factionIds.add(ent.id);
	}

	const allIds = new Set<string>(roomIds);
	entities.forEach((e, i) => {
		const ent = obj(e);
		if (!ent || typeof ent.id !== 'string')
			return errors.push(`entities[${i}].id must be a string`);
		const id = ent.id;
		if (allIds.has(id)) errors.push(`duplicate entity id "${id}"`);
		allIds.add(id);
		if (typeof ent.kind !== 'string' || !(ENTITY_KINDS as readonly string[]).includes(ent.kind))
			errors.push(`entity "${id}" has invalid kind "${String(ent.kind)}"`);
		if (typeof ent.name !== 'string') errors.push(`entity "${id}" needs a name`);
		if (typeof ent.state !== 'string') errors.push(`entity "${id}" needs a state`);
		if (!(ent.location === null || (typeof ent.location === 'string' && roomIds.has(ent.location))))
			errors.push(`entity "${id}" location "${String(ent.location)}" is not a room`);

		const rels = Array.isArray(ent.relationships) ? ent.relationships : [];
		for (const rel of rels) {
			const r = obj(rel);
			if (!r || typeof r.type !== 'string' || typeof r.target !== 'string') {
				errors.push(`entity "${id}" has a malformed relationship`);
				continue;
			}
			if (r.type === 'connects' && !roomIds.has(r.target))
				errors.push(`entity "${id}" connects to unknown room "${r.target}"`);
			if (r.type === 'memberOf' && !factionIds.has(r.target))
				errors.push(`entity "${id}" is memberOf unknown faction "${r.target}"`);
		}

		if (ent.kind === 'faction') {
			const data = obj(ent.data) ?? {};
			const territory = Array.isArray(data.territory) ? data.territory : [];
			for (const t of territory)
				if (typeof t !== 'string' || !roomIds.has(t))
					errors.push(`faction "${id}" territory "${String(t)}" is not a room`);
			const relations = obj(data.relations) ?? {};
			for (const k of Object.keys(relations))
				if (!factionIds.has(k)) errors.push(`faction "${id}" relates to unknown faction "${k}"`);
		}
	});

	if (p.startRoom !== undefined && !(typeof p.startRoom === 'string' && roomIds.has(p.startRoom)))
		errors.push(`startRoom "${String(p.startRoom)}" is not a room`);

	if (p.wandering !== undefined) {
		const w = obj(p.wandering);
		if (!w) errors.push('wandering must be an object');
		else {
			if (typeof w.checkEvery !== 'number' || w.checkEvery <= 0)
				errors.push('wandering.checkEvery must be a positive number');
			if (typeof w.chancePerCheck !== 'number' || w.chancePerCheck < 0 || w.chancePerCheck > 1)
				errors.push('wandering.chancePerCheck must be in [0, 1]');
			if (!Array.isArray(w.table) || w.table.length === 0)
				errors.push('wandering.table must be a non-empty array');
			else
				w.table.forEach((d, i) => {
					const def = obj(d);
					if (!def || typeof def.key !== 'string' || typeof def.name !== 'string')
						errors.push(`wandering.table[${i}] needs a key and name`);
				});
		}
	}

	return { pack: errors.length === 0 ? (raw as ContentPack) : null, errors };
}

/** For bundled packs: a dev-time invariant — throws if the pack is malformed. */
export function parseValidPackOrThrow(raw: unknown): ContentPack {
	const { pack, errors } = validatePack(raw);
	if (!pack) throw new Error(`Invalid content pack:\n${errors.join('\n')}`);
	return pack;
}

/** Snapshot the live world into a reusable content pack (authoring export). */
export function packFromState(state: WorldState): ContentPack {
	const rooms: RoomDef[] = [];
	const entities: EntityDef[] = [];
	for (const e of Object.values(state.entities) as Entity[]) {
		if (e.kind === 'room') {
			rooms.push({
				id: e.id,
				name: e.name,
				originalText: typeof e.data.originalText === 'string' ? e.data.originalText : '',
				light: typeof e.data.light === 'string' ? e.data.light : undefined
			});
		} else if (e.kind !== 'party') {
			entities.push({
				id: e.id,
				kind: e.kind,
				name: e.name,
				location: e.location,
				state: e.state,
				data: { ...e.data },
				relationships: [...e.relationships]
			});
		}
	}
	return {
		id: state.canon.packId || 'exported',
		name: state.canon.packName || 'Exported Pack',
		startAt: state.now,
		seed: state.rng.seed,
		startRoom: partyRoom(state)?.id,
		wandering: state.wandering ?? undefined,
		rooms,
		entities
	};
}
