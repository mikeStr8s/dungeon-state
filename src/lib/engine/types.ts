// Core data model. Everything in the world is an Entity; world state is derived by
// folding an append-only event log. See reducers.ts (fold) and events.ts.

import type { RngState } from './rng.ts';
import type { WanderingConfig } from './pack.ts';

/** The single source of truth for valid entity kinds (used by pack validation). */
export const ENTITY_KINDS = [
	'room',
	'door',
	'creature',
	'light',
	'effect',
	'trap',
	'treasure',
	'container',
	'faction',
	'patrol',
	'region',
	'party'
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface Relationship {
	/** e.g. 'guards', 'memberOf', 'connects'. */
	type: string;
	/** target entity id. */
	target: string;
}

export interface Entity {
	id: string;
	kind: EntityKind;
	name: string;
	/** id of the containing room/region, or null for top-level entities. */
	location: string | null;
	/** current state label, e.g. 'lit' | 'spent' | 'closed' | 'alive'. */
	state: string;
	/** kind-specific fields (duration, hp, endsAt, originalText, …). */
	data: Record<string, unknown>;
	relationships: Relationship[];
}

/** Immutable "as published" snapshot. The overlay (live entities) evolves; this does not. */
export interface Canon {
	packId: string;
	packName: string;
	/** original entity states, keyed by id — the source-material baseline. */
	entities: Record<string, Entity>;
}

export interface WorldState {
	/** in-game clock, in minutes. The only time that matters. */
	now: number;
	rng: RngState;
	/** live overlay — entities as they are *now*. */
	entities: Record<string, Entity>;
	canon: Canon;
	/** full applied event log, in chronological order. */
	log: EventEnvelope[];
	/** notifications produced by the most recent time advance. */
	lastNotifications: Notification[];
	/** runtime pack config for the wandering-monster system, if any. */
	wandering: WanderingConfig | null;
	initialized: boolean;
}

export interface Notification {
	at: number;
	message: string;
	/** event id that produced it, for click-through. */
	sourceEventId: string;
}

export type EventType =
	| 'WorldInitialized'
	| 'TimeAdvanced'
	| 'LightLit'
	| 'LightExtinguished'
	| 'LightExpired'
	| 'EffectStarted'
	| 'EffectExpired'
	| 'EntityStateChanged'
	| 'EntityMoved'
	| 'EntitySpawned'
	| 'EntityDataChanged'
	| 'RolledBack'
	| 'NoteAdded';

export interface EventEnvelope<P = unknown> {
	id: string;
	/** in-game minute at which the event occurs. */
	at: number;
	/** wall-clock timestamp (ms) when recorded — for the audit trail, not for logic. */
	realTs: number;
	type: EventType;
	payload: P;
	/** id of the event that caused this one (system-derived events reference their trigger). */
	causedBy?: string;
}
