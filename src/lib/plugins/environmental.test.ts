import { beforeEach, describe, expect, it } from 'vitest';
import {
	advanceTime,
	createWorld,
	registerPlugin,
	resetPlugins,
	setPluginEnabled
} from '$lib/engine';
import type { ContentPack } from '$lib/engine';
import { environmentalPlugin } from './environmental.ts';

const O = { realTs: 1 };

function floodPack(floodRate: number): ContentPack {
	return {
		id: 'f',
		name: 'F',
		startAt: 600,
		seed: 1,
		rooms: [{ id: 'cave', name: 'Cave', originalText: 'wet', data: { floodRate } }],
		entities: []
	};
}

describe('environmental plugin', () => {
	beforeEach(() => {
		resetPlugins();
		registerPlugin(environmentalPlugin);
	});

	it('raises flood by floodRate per hour crossed', () => {
		const { state } = advanceTime(createWorld(floodPack(20), O), 60, O);
		expect(state.entities.cave.data.flood).toBe(20);
	});

	it('accrues across multiple hours and caps at 100', () => {
		const { state } = advanceTime(createWorld(floodPack(40), O), 300, O); // 5h × 40 = 200 → 100
		expect(state.entities.cave.data.flood).toBe(100);
	});

	it('does nothing for rooms without a flood rate', () => {
		const { state } = advanceTime(createWorld(floodPack(0), O), 120, O);
		expect(state.entities.cave.data.flood).toBeUndefined();
	});

	it('does nothing while the plugin is disabled', () => {
		setPluginEnabled('environmental', false);
		const { state } = advanceTime(createWorld(floodPack(20), O), 120, O);
		expect(state.entities.cave.data.flood).toBeUndefined();
	});
});
