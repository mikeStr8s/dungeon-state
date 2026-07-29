// IndexedDB adapter. The event log is the source of truth; this stores it append-only
// and hands it back in insertion order so fold() reconstructs identical state. Events
// share the same `at` (e.g. init and first action both at startAt), so we key by an
// auto-increment sequence — never by `at` — to preserve causal order.

import { openDB, type IDBPDatabase } from 'idb';
import type { EventEnvelope } from '$lib/engine';

const DB_NAME = 'dungeon-state';
const STORE = 'events';
const VERSION = 1;

let dbp: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
	if (!dbp) {
		dbp = openDB(DB_NAME, VERSION, {
			upgrade(d) {
				d.createObjectStore(STORE, { autoIncrement: true });
			}
		});
	}
	return dbp;
}

/** Append events in order. Sequential adds keep the auto-increment keys monotonic. */
export async function appendEvents(events: EventEnvelope[]): Promise<void> {
	if (events.length === 0) return;
	const d = await db();
	const tx = d.transaction(STORE, 'readwrite');
	for (const ev of events) await tx.store.add(ev);
	await tx.done;
}

/** All events, in the order they were appended. */
export async function loadEvents(): Promise<EventEnvelope[]> {
	const d = await db();
	return (await d.getAll(STORE)) as EventEnvelope[];
}

export async function clearEvents(): Promise<void> {
	const d = await db();
	await d.clear(STORE);
}

/** Replace the entire log (used by save-file import). */
export async function replaceEvents(events: EventEnvelope[]): Promise<void> {
	await clearEvents();
	await appendEvents(events);
}
