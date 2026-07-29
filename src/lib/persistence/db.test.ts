import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { appendEvents, clearEvents, loadEvents, replaceEvents } from './db.ts';
import { apply, createWorld, fold, makeEvent } from '$lib/engine';
import { makeTestPack } from '$lib/engine/testPack';

function campaignLog() {
	let w = createWorld(makeTestPack(), { realTs: 1 });
	w = apply(w, makeEvent('LightLit', { lightId: 'torch', duration: 60 }, 600, { realTs: 2 }));
	return w;
}

describe('persistence', () => {
	beforeEach(async () => {
		await clearEvents();
	});

	it('round-trips: append → load → fold reproduces state', async () => {
		const w = campaignLog();
		await appendEvents(w.log);
		const loaded = await loadEvents();
		expect(loaded).toHaveLength(w.log.length);
		expect(loaded.map((e) => e.type)).toEqual(w.log.map((e) => e.type)); // order preserved
		expect(fold(loaded).entities).toEqual(w.entities);
	});

	it('replaceEvents swaps the whole log', async () => {
		await appendEvents(campaignLog().log);
		const other = createWorld(makeTestPack(), { realTs: 9 });
		await replaceEvents(other.log);
		const loaded = await loadEvents();
		expect(loaded).toHaveLength(other.log.length);
		expect(loaded[0].type).toBe('WorldInitialized');
	});
});
