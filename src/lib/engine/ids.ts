// Unique id generation. Event ids only need to be unique within a save; they are
// never used to derive state, so a random uuid (with a counter fallback) is enough.

let counter = 0;

export function uid(prefix = 'e'): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `${prefix}_${crypto.randomUUID()}`;
	}
	counter += 1;
	return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
