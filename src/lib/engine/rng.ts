// Seeded, deterministic RNG (mulberry32). The world stores the seed and current
// cursor so a replayed event log reproduces every roll exactly. No M1 system rolls
// dice yet, but the plumbing exists for wandering monsters / random events later.

export interface RngState {
	seed: number;
	cursor: number;
}

export function createRng(seed: number): RngState {
	return { seed: seed >>> 0, cursor: 0 };
}

/** Returns the next float in [0, 1) and the advanced state (pure — no mutation). */
export function nextFloat(state: RngState): { value: number; state: RngState } {
	const cursor = state.cursor + 1;
	let t = (state.seed + cursor * 0x6d2b79f5) >>> 0;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	return { value, state: { seed: state.seed, cursor } };
}

/**
 * Stateless, deterministic draw in [0, 1) keyed by (seed, tick, salt). Used by
 * time-driven systems (e.g. wandering monsters) so a roll depends only on absolute
 * in-game time — no cursor to thread through events, and replay reproduces exactly.
 * `salt` distinguishes independent draws at the same tick.
 */
export function rngAt(seed: number, tick: number, salt = 0): number {
	let t = (seed + Math.imul(tick, 0x9e3779b1) + Math.imul(salt, 0x85ebca6b)) >>> 0;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [min, max] inclusive. */
export function nextInt(
	state: RngState,
	min: number,
	max: number
): { value: number; state: RngState } {
	const { value, state: next } = nextFloat(state);
	return { value: min + Math.floor(value * (max - min + 1)), state: next };
}
