// DM actions as pure engine builders. Each takes the current world and returns the
// events the action produces; the state bridge applies + persists them. Keeps all
// simulation logic in the engine (the store stays glue).

import { makeEvent } from './events.ts';
import { apply } from './reducers.ts';
import { advanceTime, type AdvanceResult } from './time.ts';
import { exitVia, party } from './world.ts';
import type { EventEnvelope, Notification, WorldState } from './types.ts';

type Opts = { realTs?: number };

/**
 * Move the party through a connection. Traversal takes the connection's travel time, so
 * this advances the clock first (resolving any torches/effects that expire in transit),
 * then relocates the party and marks the destination explored. No-ops if the party is
 * unplaced or the exit is blocked/unknown (the UI disables blocked exits).
 */
export function moveParty(state: WorldState, connectionId: string, opts: Opts = {}): AdvanceResult {
	const p = party(state);
	if (!p?.location) return { state, newEvents: [], notifications: [] };
	const exit = exitVia(state, p.location, connectionId);
	if (!exit || !exit.passable) return { state, newEvents: [], notifications: [] };

	const { state: advanced, newEvents, notifications } = advanceTime(state, exit.travelTime, opts);
	let s = advanced;
	const events: EventEnvelope[] = [...newEvents];

	const move = makeEvent('EntityMoved', { entityId: 'party', toRoom: exit.toRoom }, s.now, opts);
	s = apply(s, move);
	events.push(move);

	const dest = s.entities[exit.toRoom];
	if (dest && dest.state === 'unexplored') {
		const explore = makeEvent(
			'EntityStateChanged',
			{ entityId: exit.toRoom, state: 'explored' },
			s.now,
			opts
		);
		s = apply(s, explore);
		events.push(explore);
	}

	const arrival: Notification = {
		at: s.now,
		message: `Party moved to ${dest?.name ?? exit.toRoom}.`,
		sourceEventId: move.id
	};
	return { state: s, newEvents: events, notifications: [...notifications, arrival] };
}

/** Mark a creature defeated. */
export function defeatCreature(state: WorldState, id: string, opts: Opts = {}): EventEnvelope[] {
	return [makeEvent('EntityStateChanged', { entityId: id, state: 'dead' }, state.now, opts)];
}

/** Set a door/connection state (open | closed | locked | barricaded). */
export function setDoorState(
	state: WorldState,
	id: string,
	doorState: string,
	opts: Opts = {}
): EventEnvelope[] {
	return [makeEvent('EntityStateChanged', { entityId: id, state: doorState }, state.now, opts)];
}

/** Merge a patch into an entity's data (morale, resources, hp, relations…). */
export function setEntityData(
	state: WorldState,
	id: string,
	patch: Record<string, unknown>,
	opts: Opts = {}
): EventEnvelope[] {
	return [makeEvent('EntityDataChanged', { entityId: id, patch }, state.now, opts)];
}

/** Attach a note to any entity. */
export function addNote(
	state: WorldState,
	id: string,
	text: string,
	opts: Opts = {}
): EventEnvelope[] {
	return [makeEvent('NoteAdded', { entityId: id, text }, state.now, opts)];
}

/** Light a torch/light source; burns for its `data.duration` (default 60). */
export function lightSource(state: WorldState, id: string, opts: Opts = {}): EventEnvelope[] {
	const light = state.entities[id];
	const duration = typeof light?.data.duration === 'number' ? light.data.duration : 60;
	return [makeEvent('LightLit', { lightId: id, duration }, state.now, opts)];
}

/** Extinguish a lit source. */
export function extinguishSource(state: WorldState, id: string, opts: Opts = {}): EventEnvelope[] {
	return [makeEvent('LightExtinguished', { lightId: id }, state.now, opts)];
}

/** Non-destructive rollback marker: cancels every event after `toEventId`. */
export function rollbackEvent(
	state: WorldState,
	toEventId: string,
	opts: Opts = {}
): EventEnvelope {
	return makeEvent('RolledBack', { toEventId }, state.now, opts);
}
