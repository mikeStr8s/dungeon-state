// Shared timing primitive. A "timer" is anything that should fire when the in-game
// clock crosses its `at` minute. Torch expiry and spell expiry are both timers, so
// both systems reuse this instead of reimplementing crossing logic.

import type { Entity, WorldState } from './types.ts';

export interface Timer {
	entityId: string;
	/** in-game minute the timer fires. */
	at: number;
	label: string;
}

/** True when `at` falls in the half-open interval (from, to] — i.e. crossed this tick. */
export function crossed(at: number, from: number, to: number): boolean {
	return at > from && at <= to;
}

/** Collect timers still pending in the given state, sorted by fire time. */
export function pendingTimers(state: WorldState): Timer[] {
	const timers: Timer[] = [];
	for (const e of Object.values(state.entities)) {
		const t = timerFor(e);
		if (t) timers.push(t);
	}
	return timers.sort((a, b) => a.at - b.at);
}

function timerFor(e: Entity): Timer | null {
	if (e.kind === 'light' && e.state === 'lit' && typeof e.data.expiresAt === 'number') {
		return { entityId: e.id, at: e.data.expiresAt, label: `${e.name} burns out` };
	}
	if (e.kind === 'effect' && e.state === 'active' && typeof e.data.endsAt === 'number') {
		return { entityId: e.id, at: e.data.endsAt, label: `${e.name} ends` };
	}
	return null;
}
