// Time Engine — the application's heart (doc: "Time drives everything"). Advancing
// time runs every system in order and returns a summary of what changed. Nothing in
// the world changes except through this pipeline (or explicit DM actions).

import { makeEvent } from './events.ts';
import type {
	EffectExpiredPayload,
	EntityDataChangedPayload,
	EntityMovedPayload,
	EntitySpawnedPayload,
	EntityStateChangedPayload,
	LightExpiredPayload,
	LightExtinguishedPayload,
	LightLitPayload,
	NoteAddedPayload,
	TimeAdvancedPayload
} from './events.ts';
import { apply } from './reducers.ts';
import { activeSystems } from './systems/index.ts';
import type { EventEnvelope, Notification, WorldState } from './types.ts';

/** Named advancement presets (minutes). Custom durations pass a raw number. */
export const DURATIONS = {
	minute: 1,
	tenMinutes: 10,
	hour: 60,
	shortRest: 60,
	longRest: 480
} as const;

export interface AdvanceResult {
	state: WorldState;
	/** events appended by this advance (TimeAdvanced + system-derived). */
	newEvents: EventEnvelope[];
	notifications: Notification[];
}

/**
 * Advance the clock by `delta` minutes. Deterministic: the same input state and delta
 * always produce the same resulting entities, clock, and event payloads. (Only `id`
 * and `realTs` on envelopes vary between runs; they carry no simulation meaning.)
 */
export function advanceTime(
	state: WorldState,
	delta: number,
	opts: { realTs?: number } = {}
): AdvanceResult {
	if (delta <= 0) return { state, newEvents: [], notifications: [] };

	const from = state.now;
	const to = from + delta;
	const newEvents: EventEnvelope[] = [];

	const tAdv = makeEvent('TimeAdvanced', { from, to } satisfies TimeAdvancedPayload, to, {
		realTs: opts.realTs
	});
	let working = apply(state, tAdv);
	newEvents.push(tAdv);

	for (const system of activeSystems()) {
		const produced = system.run(working, from, to);
		// stable order so replay is deterministic regardless of object-key iteration
		produced.sort((a, b) => a.at - b.at || a.type.localeCompare(b.type));
		for (const ev of produced) {
			const stamped =
				opts.realTs !== undefined
					? { ...ev, realTs: opts.realTs, causedBy: tAdv.id }
					: { ...ev, causedBy: tAdv.id };
			working = apply(working, stamped);
			newEvents.push(stamped);
		}
	}

	const notifications = newEvents
		.filter((e) => isNotable(e))
		.map((e) => toNotification(e, working));
	working = { ...working, lastNotifications: notifications };

	return { state: working, newEvents, notifications };
}

function toNotification(event: EventEnvelope, state: WorldState): Notification {
	return { at: event.at, message: describeEvent(event, state), sourceEventId: event.id };
}

function name(state: WorldState, id: string): string {
	return state.entities[id]?.name ?? id;
}

/** Events that are noise, not news — excluded from the "What changed" summary. */
export function isNotable(event: EventEnvelope): boolean {
	if (event.type === 'TimeAdvanced') return false;
	// routine faction upkeep (resources-only data patch) is bookkeeping, not news
	if (event.type === 'EntityDataChanged') {
		const keys = Object.keys((event.payload as EntityDataChangedPayload).patch);
		if (keys.length === 1 && keys[0] === 'resources') return false;
	}
	return true;
}

/**
 * Humanize an event into a DM-facing sentence. Shared by the notifications summary and
 * the History panel so both render from one formatter.
 */
export function describeEvent(event: EventEnvelope, state: WorldState): string {
	const p = event.payload;
	switch (event.type) {
		case 'WorldInitialized':
			return `Campaign started.`;
		case 'TimeAdvanced':
			return `Time advanced.`;
		case 'LightLit':
			return `${name(state, (p as LightLitPayload).lightId)} lit.`;
		case 'LightExtinguished':
			return `${name(state, (p as LightExtinguishedPayload).lightId)} extinguished.`;
		case 'LightExpired':
			return `${name(state, (p as LightExpiredPayload).lightId)} burned out.`;
		case 'EffectExpired':
			return `${name(state, (p as EffectExpiredPayload).effectId)} wore off.`;
		case 'EntityMoved': {
			const m = p as EntityMovedPayload;
			return `${name(state, m.entityId)} moved to ${name(state, m.toRoom)}.`;
		}
		case 'EntitySpawned': {
			const s = p as EntitySpawnedPayload;
			return `${s.entity.name} appeared in ${name(state, s.entity.location ?? '')}.`;
		}
		case 'EntityDataChanged': {
			const d = p as EntityDataChangedPayload;
			const parts = Object.entries(d.patch).map(([k, v]) =>
				k === 'relations' ? 'relations' : `${k} → ${v}`
			);
			return `${name(state, d.entityId)}: ${parts.join(', ')}.`;
		}
		case 'EntityStateChanged': {
			const c = p as EntityStateChangedPayload;
			return `${name(state, c.entityId)} → ${c.state}.`;
		}
		case 'NoteAdded':
			return `Note added to ${name(state, (p as NoteAddedPayload).entityId)}.`;
		case 'RolledBack':
			return `Rolled back to an earlier point.`;
		default:
			return event.type;
	}
}
