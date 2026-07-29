// Event definitions + factory. Every change to the world is an event; state is the
// fold of the log (reducers.ts). Payload shapes are typed per event.

import { uid } from './ids.ts';
import type { Entity, EventEnvelope, EventType } from './types.ts';
import type { ContentPack } from './pack.ts';

export interface WorldInitializedPayload {
	pack: ContentPack;
}
export interface TimeAdvancedPayload {
	from: number;
	to: number;
}
export interface LightLitPayload {
	lightId: string;
	/** burn duration in minutes. */
	duration: number;
}
export interface LightExtinguishedPayload {
	lightId: string;
}
export interface LightExpiredPayload {
	lightId: string;
}
export interface EffectStartedPayload {
	effectId: string;
	/** in-game minute the effect ends. */
	endsAt: number;
}
export interface EffectExpiredPayload {
	effectId: string;
}
export interface EntityStateChangedPayload {
	entityId: string;
	state: string;
}
export interface EntityMovedPayload {
	entityId: string;
	/** destination room id. */
	toRoom: string;
}
export interface EntitySpawnedPayload {
	/** the fully-formed entity to add to the world (e.g. a wandering monster). */
	entity: Entity;
}
export interface EntityDataChangedPayload {
	entityId: string;
	/** shallow-merged into the entity's `data` (morale, resources, territory, hp…). */
	patch: Record<string, unknown>;
}
export interface RolledBackPayload {
	/** cancels every event after this one (exclusive); state re-derives without them. */
	toEventId: string;
}
export interface NoteAddedPayload {
	entityId: string;
	text: string;
}

export interface PayloadMap {
	WorldInitialized: WorldInitializedPayload;
	TimeAdvanced: TimeAdvancedPayload;
	LightLit: LightLitPayload;
	LightExtinguished: LightExtinguishedPayload;
	LightExpired: LightExpiredPayload;
	EffectStarted: EffectStartedPayload;
	EffectExpired: EffectExpiredPayload;
	EntityStateChanged: EntityStateChangedPayload;
	EntityMoved: EntityMovedPayload;
	EntitySpawned: EntitySpawnedPayload;
	EntityDataChanged: EntityDataChangedPayload;
	RolledBack: RolledBackPayload;
	NoteAdded: NoteAddedPayload;
}

/** Build a well-formed event envelope. `realTs` is injectable for deterministic tests. */
export function makeEvent<T extends EventType>(
	type: T,
	payload: PayloadMap[T],
	at: number,
	opts: { causedBy?: string; realTs?: number } = {}
): EventEnvelope<PayloadMap[T]> {
	return {
		id: uid(),
		at,
		realTs: opts.realTs ?? Date.now(),
		type,
		payload,
		causedBy: opts.causedBy
	};
}
