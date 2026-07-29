// Pure reducers. `apply(state, event)` is the single place state changes; `fold`
// rebuilds a world from an event log. No side effects, no I/O, no randomness beyond
// the seeded rng carried in state.

import { createRng } from './rng.ts';
import type {
	EffectExpiredPayload,
	EffectStartedPayload,
	EntityDataChangedPayload,
	EntityMovedPayload,
	EntitySpawnedPayload,
	EntityStateChangedPayload,
	LightExpiredPayload,
	LightExtinguishedPayload,
	LightLitPayload,
	NoteAddedPayload,
	RolledBackPayload,
	TimeAdvancedPayload,
	WorldInitializedPayload
} from './events.ts';
import type { Canon, Entity, EventEnvelope, WorldState } from './types.ts';

export function emptyWorld(): WorldState {
	return {
		now: 0,
		rng: createRng(0),
		entities: {},
		canon: { packId: '', packName: '', entities: {} },
		log: [],
		lastNotifications: [],
		wandering: null,
		initialized: false
	};
}

/** Room light is 'bright' if any lit light source sits in it, else 'dark'. */
function recomputeRoomLight(entities: Record<string, Entity>, roomId: string | null): void {
	if (!roomId) return;
	const room = entities[roomId];
	if (!room || room.kind !== 'room') return;
	const anyLit = Object.values(entities).some(
		(e) => e.kind === 'light' && e.location === roomId && e.state === 'lit'
	);
	room.data = { ...room.data, light: anyLit ? 'bright' : 'dark' };
}

function cloneEntity(e: Entity): Entity {
	return { ...e, data: { ...e.data }, relationships: [...e.relationships] };
}

/** Apply one event, returning a new state. The incoming state is never mutated. */
export function apply(state: WorldState, event: EventEnvelope): WorldState {
	const entities: Record<string, Entity> = {};
	for (const [id, e] of Object.entries(state.entities)) entities[id] = cloneEntity(e);
	let { now, rng, canon } = state;

	switch (event.type) {
		case 'WorldInitialized': {
			const { pack } = event.payload as WorldInitializedPayload;
			const built: Record<string, Entity> = {};
			for (const room of pack.rooms) {
				built[room.id] = {
					id: room.id,
					kind: 'room',
					name: room.name,
					location: null,
					state: 'unexplored',
					data: {
						...(room.data ?? {}),
						originalText: room.originalText,
						light: room.light ?? 'dark'
					},
					relationships: []
				};
			}
			for (const def of pack.entities) {
				built[def.id] = {
					id: def.id,
					kind: def.kind,
					name: def.name,
					location: def.location,
					state: def.state,
					data: { ...(def.data ?? {}) },
					relationships: [...(def.relationships ?? [])]
				};
			}
			// derive initial room lighting from any lit sources in the pack
			for (const id of Object.keys(built)) {
				if (built[id].kind === 'room') recomputeRoomLight(built, id);
			}
			// canon = "as published": snapshot before adding campaign-only state (party,
			// exploration) so the original baseline stays clean.
			const canonSnapshot: Canon = {
				packId: pack.id,
				packName: pack.name,
				entities: structuredClone(built)
			};
			if (pack.startRoom && built[pack.startRoom]) {
				built['party'] = {
					id: 'party',
					kind: 'party',
					name: 'The Party',
					location: pack.startRoom,
					state: 'active',
					data: {},
					relationships: []
				};
				built[pack.startRoom].state = 'explored';
			}
			return {
				now: pack.startAt,
				rng: createRng(pack.seed),
				entities: built,
				canon: canonSnapshot,
				log: [...state.log, event],
				lastNotifications: [],
				wandering: pack.wandering ?? null,
				initialized: true
			};
		}

		case 'TimeAdvanced': {
			now = (event.payload as TimeAdvancedPayload).to;
			break;
		}

		case 'LightLit': {
			const { lightId, duration } = event.payload as LightLitPayload;
			const light = entities[lightId];
			if (light && light.kind === 'light') {
				light.state = 'lit';
				light.data = {
					...light.data,
					ignitedAt: event.at,
					duration,
					expiresAt: event.at + duration
				};
				recomputeRoomLight(entities, light.location);
			}
			break;
		}

		case 'LightExtinguished': {
			const { lightId } = event.payload as LightExtinguishedPayload;
			const light = entities[lightId];
			if (light && light.kind === 'light') {
				light.state = 'unlit';
				recomputeRoomLight(entities, light.location);
			}
			break;
		}

		case 'LightExpired': {
			const { lightId } = event.payload as LightExpiredPayload;
			const light = entities[lightId];
			if (light && light.kind === 'light') {
				light.state = 'spent';
				recomputeRoomLight(entities, light.location);
			}
			break;
		}

		case 'EffectStarted': {
			const { effectId, endsAt } = event.payload as EffectStartedPayload;
			const effect = entities[effectId];
			if (effect && effect.kind === 'effect') {
				effect.state = 'active';
				effect.data = { ...effect.data, endsAt };
			}
			break;
		}

		case 'EffectExpired': {
			const { effectId } = event.payload as EffectExpiredPayload;
			const effect = entities[effectId];
			if (effect && effect.kind === 'effect') effect.state = 'expired';
			break;
		}

		case 'EntityStateChanged': {
			const { entityId, state: newState } = event.payload as EntityStateChangedPayload;
			const target = entities[entityId];
			if (target) target.state = newState;
			break;
		}

		case 'EntityMoved': {
			const { entityId, toRoom } = event.payload as EntityMovedPayload;
			const target = entities[entityId];
			if (target) {
				const from = target.location;
				target.location = toRoom;
				// a moving light source changes lighting in both the room it left and entered
				if (target.kind === 'light') {
					recomputeRoomLight(entities, from);
					recomputeRoomLight(entities, toRoom);
				}
			}
			break;
		}

		case 'EntitySpawned': {
			const { entity } = event.payload as EntitySpawnedPayload;
			// idempotent: replaying the log must not double-spawn
			if (!entities[entity.id]) {
				entities[entity.id] = cloneEntity(entity);
				if (entity.kind === 'light') recomputeRoomLight(entities, entity.location);
			}
			break;
		}

		case 'RolledBack':
			// a marker only — state is re-derived from activeEvents(); no-op here
			break;

		case 'EntityDataChanged': {
			const { entityId, patch } = event.payload as EntityDataChangedPayload;
			const target = entities[entityId];
			if (target) target.data = { ...target.data, ...patch };
			break;
		}

		case 'NoteAdded': {
			const { entityId, text } = event.payload as NoteAddedPayload;
			const target = entities[entityId];
			if (target) {
				const notes = Array.isArray(target.data.notes) ? (target.data.notes as string[]) : [];
				target.data = { ...target.data, notes: [...notes, text] };
			}
			break;
		}
	}

	return {
		now,
		rng,
		entities,
		canon,
		log: [...state.log, event],
		lastNotifications: state.lastNotifications,
		wandering: state.wandering,
		initialized: state.initialized
	};
}

/**
 * The events that actually drive state, honoring rollback markers. A `RolledBack{toEventId}`
 * truncates the active list back to (and including) that event; the marker itself and the
 * cancelled events stay in the stored log (audit) but do not affect derived state.
 */
export function activeEvents(events: EventEnvelope[]): EventEnvelope[] {
	const active: EventEnvelope[] = [];
	for (const ev of events) {
		if (ev.type === 'RolledBack') {
			const toId = (ev.payload as RolledBackPayload).toEventId;
			const cut = active.findIndex((e) => e.id === toId);
			if (cut >= 0) active.length = cut + 1; // keep up to and including toId
		} else {
			active.push(ev);
		}
	}
	return active;
}

/** Ids of events currently driving state (excludes rolled-back + marker events). */
export function activeEventIds(events: EventEnvelope[]): Set<string> {
	return new Set(activeEvents(events).map((e) => e.id));
}

/**
 * Rebuild a world from an event log. State is derived from the *active* events (rollback
 * markers honored), but `log` retains the full history so audit/export lose nothing.
 */
export function fold(events: EventEnvelope[]): WorldState {
	const derived = activeEvents(events).reduce((s, e) => apply(s, e), emptyWorld());
	return { ...derived, log: [...events] };
}
