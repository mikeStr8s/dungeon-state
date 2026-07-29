import { beforeEach, describe, expect, it } from 'vitest';
import {
	registerPlugin,
	resetPlugins,
	plugins,
	isPluginEnabled,
	setPluginEnabled,
	pluginSystems,
	pluginFactionRules
} from './plugins.ts';
import { activeSystems, builtinSystems } from './systems/index.ts';
import type { System } from './systems/index.ts';
import type { FactionRule } from './factions.ts';

const sys = (name: string, priority: number): System => ({ name, priority, run: () => [] });
const rule: FactionRule = () => [];

describe('plugin registry', () => {
	beforeEach(() => resetPlugins());

	it('registers a plugin once (dedupes by id)', () => {
		registerPlugin({ id: 'p', name: 'P', description: '', systems: [sys('x', 5)] });
		registerPlugin({ id: 'p', name: 'P again', description: '' });
		expect(plugins().map((p) => p.id)).toEqual(['p']);
	});

	it('contributes systems only while enabled', () => {
		registerPlugin({ id: 'p', name: 'P', description: '', systems: [sys('x', 5)] });
		expect(pluginSystems().map((s) => s.name)).toEqual(['x']);
		setPluginEnabled('p', false);
		expect(isPluginEnabled('p')).toBe(false);
		expect(pluginSystems()).toEqual([]);
	});

	it('merges + priority-sorts plugin systems with the built-ins', () => {
		registerPlugin({ id: 'p', name: 'P', description: '', systems: [sys('mid', 12)] });
		const names = activeSystems().map((s) => s.name);
		expect(names).toContain('mid');
		expect(names.length).toBe(builtinSystems.length + 1);
		// priority order is preserved
		const priorities = activeSystems().map((s) => s.priority);
		expect([...priorities]).toEqual([...priorities].sort((a, b) => a - b));
	});

	it('contributes faction rules only while enabled', () => {
		registerPlugin({ id: 'p', name: 'P', description: '', factionRules: [rule] });
		expect(pluginFactionRules()).toHaveLength(1);
		setPluginEnabled('p', false);
		expect(pluginFactionRules()).toEqual([]);
	});
});
