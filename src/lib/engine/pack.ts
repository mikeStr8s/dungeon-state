// Content-pack schema. A pack is the "as published" adventure: rooms and their
// initial entities. The engine is content-agnostic (no DotMM specifics) — a pack is
// just data folded into the world by the WorldInitialized event.

import type { EntityKind, Relationship } from './types.ts';

export interface EntityDef {
	id: string;
	kind: EntityKind;
	name: string;
	location: string | null;
	state: string;
	data?: Record<string, unknown>;
	relationships?: Relationship[];
}

export interface RoomDef {
	id: string;
	name: string;
	/** immutable source-material description. */
	originalText: string;
	/** initial light level: 'dark' | 'dim' | 'bright'. */
	light?: string;
	/** extra room data merged into the room entity (e.g. plugin config like floodRate). */
	data?: Record<string, unknown>;
}

/** One entry in a pack's wandering-monster table. */
export interface WanderDef {
	/** stable key used in the spawned entity's id. */
	key: string;
	name: string;
	/** extra creature data (task, disposition, hp…); merged onto the spawned entity. */
	data?: Record<string, unknown>;
}

export interface WanderingConfig {
	/** probability [0,1] a check produces an encounter. */
	chancePerCheck: number;
	/** minutes between checks; a check fires on clock minutes divisible by this. */
	checkEvery: number;
	table: WanderDef[];
}

export interface ContentPack {
	id: string;
	name: string;
	/** in-game minute the campaign starts at (e.g. 600 = 10:00). */
	startAt: number;
	/** rng seed for deterministic simulation. */
	seed: number;
	/** room the party begins in; created + marked explored on init. Optional. */
	startRoom?: string;
	/** optional wandering-monster generation config. */
	wandering?: WanderingConfig;
	rooms: RoomDef[];
	entities: EntityDef[];
}
