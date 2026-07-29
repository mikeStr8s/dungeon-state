// World construction + read-only selectors for the UI. All mutation goes through
// events/reducers; these helpers only query the folded state.

import { makeEvent } from './events.ts';
import type { WorldInitializedPayload } from './events.ts';
import type { ContentPack } from './pack.ts';
import { apply, emptyWorld } from './reducers.ts';
import { pendingTimers } from './scheduler.ts';
import type { EventEnvelope, Entity, WorldState } from './types.ts';

/** The single event that seeds a new campaign from a content pack. */
export function initEvent(pack: ContentPack, opts: { realTs?: number } = {}): EventEnvelope {
	return makeEvent(
		'WorldInitialized',
		{ pack } satisfies WorldInitializedPayload,
		pack.startAt,
		opts
	);
}

/** Build a fresh world from a pack (equivalent to folding just its init event). */
export function createWorld(pack: ContentPack, opts: { realTs?: number } = {}): WorldState {
	return apply(emptyWorld(), initEvent(pack, opts));
}

export function entitiesInRoom(state: WorldState, roomId: string): Entity[] {
	return Object.values(state.entities).filter((e) => e.location === roomId);
}

export function rooms(state: WorldState): Entity[] {
	return Object.values(state.entities).filter((e) => e.kind === 'room');
}

export function activeLights(state: WorldState): Entity[] {
	return Object.values(state.entities).filter((e) => e.kind === 'light' && e.state === 'lit');
}

export function activeEffects(state: WorldState): Entity[] {
	return Object.values(state.entities).filter((e) => e.kind === 'effect' && e.state === 'active');
}

/** Pending timers with minutes remaining until they fire, soonest first. */
export function timersRemaining(
	state: WorldState
): { entityId: string; label: string; at: number; remaining: number }[] {
	return pendingTimers(state).map((t) => ({ ...t, remaining: t.at - state.now }));
}

/** The canon (as-published) version of an entity, if any. */
export function canonEntity(state: WorldState, id: string): Entity | undefined {
	return state.canon.entities[id];
}

/** Default connection travel time (minutes) when a connection omits `data.travelTime`. */
export const DEFAULT_TRAVEL = 5;

/** Connection states that block traversal. */
const BLOCKED_STATES = new Set(['locked', 'barricaded']);

export interface Exit {
	connectionId: string;
	toRoom: string;
	travelTime: number;
	passable: boolean;
	/** connection state when blocked, e.g. 'locked'. */
	blockedBy?: string;
}

/** The party entity (the players' avatar in the dungeon), if placed. */
export function party(state: WorldState): Entity | undefined {
	return state.entities['party'];
}

/** The room the party is currently in, if any. */
export function partyRoom(state: WorldState): Entity | undefined {
	const p = party(state);
	return p?.location ? state.entities[p.location] : undefined;
}

/**
 * Exits leading out of `roomId`. A door/portal touches both the room it is located in
 * and the room its `connects` relationship targets, so traversal works from either side.
 */
export function exitsFrom(state: WorldState, roomId: string): Exit[] {
	const exits: Exit[] = [];
	for (const e of Object.values(state.entities)) {
		if (e.kind !== 'door') continue;
		const connects = e.relationships.find((r) => r.type === 'connects')?.target;
		const travelTime = typeof e.data.travelTime === 'number' ? e.data.travelTime : DEFAULT_TRAVEL;
		const passable = !BLOCKED_STATES.has(e.state);
		const blockedBy = passable ? undefined : e.state;
		if (e.location === roomId && connects) {
			exits.push({ connectionId: e.id, toRoom: connects, travelTime, passable, blockedBy });
		} else if (connects === roomId && e.location) {
			exits.push({ connectionId: e.id, toRoom: e.location, travelTime, passable, blockedBy });
		}
	}
	return exits;
}

/** Resolve a specific exit from `roomId` via `connectionId`, if it exists. */
export function exitVia(state: WorldState, roomId: string, connectionId: string): Exit | undefined {
	return exitsFrom(state, roomId).find((x) => x.connectionId === connectionId);
}

/** Alive, non-friendly creatures currently in a room. */
export function hostilesIn(state: WorldState, roomId: string): Entity[] {
	return Object.values(state.entities).filter(
		(e) =>
			e.kind === 'creature' &&
			e.location === roomId &&
			e.state !== 'dead' &&
			e.data.disposition !== 'friendly' &&
			e.data.disposition !== 'neutral'
	);
}

/** A room is "occupied" when at least one alive hostile creature is present. Derived,
 * not stored — it must not collide with the exploration value in `room.state`. */
export function isOccupied(state: WorldState, roomId: string): boolean {
	return hostilesIn(state, roomId).length > 0;
}
